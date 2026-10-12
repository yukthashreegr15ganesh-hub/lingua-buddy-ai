"""
FastAPI Backend for LINGUA BUDDY AI.
Provides REST endpoints for multilingual language switching, structured 5-phase lessons,
voice-first pronunciation evaluation, spaced repetition, 15 conversation scenarios, and scheduling.
"""

from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from languages_data import (
    LANGUAGES_REGISTRY,
    EXPLANATION_LANGUAGES,
    TOPICS,
    CONVERSATION_SCENARIOS,
    get_language_by_code,
    localize_vocab_item,
)
from database import (
    init_db,
    get_user_profile,
    update_user_profile,
    ensure_language_initialized,
    get_all_languages_with_progress,
    get_language_vocabulary_with_progress,
    record_vocabulary_attempt,
    record_completed_lesson,
    save_conversation_session,
    get_recent_lessons,
    get_recent_conversations,
    get_conn,
)
from ai_tutor import (
    get_ai_status,
    set_runtime_api_key,
    evaluate_speaking_attempt,
    generate_conversation_turn,
)

app = FastAPI(title="Lingua Buddy AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    profile = get_user_profile()
    ensure_language_initialized(profile.get("active_language", "ta"))


class ProfileUpdateRequest(BaseModel):
    learner_name: Optional[str] = None
    active_language: Optional[str] = None
    explanation_language: Optional[str] = None
    proficiency_level: Optional[str] = None
    understanding_comfort: Optional[str] = None
    learning_reason: Optional[str] = None
    daily_duration_minutes: Optional[int] = None
    preferred_time: Optional[str] = None
    scheduled_days: Optional[List[str]] = None
    reminder_enabled: Optional[bool] = None
    speaking_speed: Optional[float] = None
    show_native_script: Optional[bool] = None
    onboarding_completed: Optional[bool] = None


class SwitchLanguageRequest(BaseModel):
    language_code: str
    explanation_language: Optional[str] = None


class EvaluateSpeechRequest(BaseModel):
    language_code: str
    explanation_language: str = "en"
    word_id: Optional[str] = None
    user_transcript: str
    target_romanized: str
    target_native: str = ""
    pronunciation_guide: str = ""
    target_meaning: str = ""
    mode: str = "repeat"
    record_progress: bool = True


class CompleteLessonRequest(BaseModel):
    language_code: str
    duration_minutes: int
    proficiency_level: str
    new_words: List[str]
    recalled_words: List[str]
    mistake_words: List[str]
    conversation_turns: int
    accuracy_score: int
    recommended_next: str = "Everyday Sentence Building & Role-Play"


class ConversationTurnRequest(BaseModel):
    language_code: str
    explanation_language: str = "en"
    proficiency_level: str = "Beginner"
    scenario_id: str
    user_message: str = ""
    turn_index: int = 0
    history: List[Dict[str, Any]] = []


class SaveConversationRequest(BaseModel):
    language_code: str
    scenario_id: str
    scenario_title: str
    proficiency_level: str
    messages: List[Dict[str, Any]]
    corrections_count: int = 0


class ConfigureAIRequest(BaseModel):
    provider: str = "gemini"
    api_key: str = ""
    model: str = ""


class AddCustomLanguageRequest(BaseModel):
    code: str
    name: str
    native_name: str
    region: str = "Additional Languages"
    bcp47: str = "en-US"
    word_order: str = "SVO"
    cultural_note: str = ""


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "Lingua Buddy AI Backend"}


@app.get("/api/ai/status")
def api_ai_status() -> Dict[str, Any]:
    return get_ai_status()


@app.post("/api/ai/configure")
def api_ai_configure(req: ConfigureAIRequest) -> Dict[str, Any]:
    return set_runtime_api_key(req.provider, req.api_key, req.model)


@app.get("/api/bootstrap")
def bootstrap_app() -> Dict[str, Any]:
    profile = get_user_profile()
    active_code = profile["active_language"]
    exp_code = profile["explanation_language"]
    ensure_language_initialized(active_code)

    languages = get_all_languages_with_progress(exp_code)
    active_lang_summary = next((l for l in languages if l["code"] == active_code), languages[0])
    vocab = get_language_vocabulary_with_progress(active_code, exp_code)
    recent_lessons = get_recent_lessons(active_code, limit=5)
    recent_conversations = get_recent_conversations(active_code, limit=5)

    return {
        "profile": profile,
        "activeLanguage": active_lang_summary,
        "languages": languages,
        "explanationLanguages": EXPLANATION_LANGUAGES,
        "topics": TOPICS,
        "scenarios": CONVERSATION_SCENARIOS,
        "vocabulary": vocab,
        "recentLessons": recent_lessons,
        "recentConversations": recent_conversations,
        "aiStatus": get_ai_status(),
    }


@app.post("/api/profile")
def save_profile(req: ProfileUpdateRequest) -> Dict[str, Any]:
    updates = {k: v for k, v in req.dict().items() if v is not None}
    update_user_profile(updates)
    return bootstrap_app()


@app.post("/api/languages/switch")
def switch_language(req: SwitchLanguageRequest) -> Dict[str, Any]:
    updates: Dict[str, Any] = {"active_language": req.language_code}
    if req.explanation_language:
        updates["explanation_language"] = req.explanation_language
    ensure_language_initialized(req.language_code)
    update_user_profile(updates)
    return bootstrap_app()


@app.post("/api/languages/custom")
def add_custom_language(req: AddCustomLanguageRequest) -> Dict[str, Any]:
    import json
    conn = get_conn()
    cur = conn.cursor()
    starter_vocab = [
        {
            "id": f"{req.code}_w1",
            "conceptKey": "hello",
            "topic": "Greetings",
            "level": "Beginner",
            "nativeText": f"Hello ({req.native_name})",
            "romanized": "Hello",
            "pronunciationGuide": "Hel-lo",
            "meanings": {"en": "Hello / Greetings"},
            "exampleNative": f"Hello!",
            "exampleRomanized": "Hello!",
            "exampleMeaning": "Hello!",
            "grammarNote": f"Starter greeting for {req.name}.",
        }
    ]
    cur.execute(
        """
        INSERT OR REPLACE INTO custom_languages (
            code, name, native_name, region, bcp47, word_order,
            speech_support_level, speech_notes, cultural_note, vocabulary_json
        ) VALUES (?, ?, ?, ?, ?, ?, 'phonetic-fallback', ?, ?, ?)
        """,
        (
            req.code.lower().strip(),
            req.name.strip(),
            req.native_name.strip() or req.name.strip(),
            req.region,
            req.bcp47,
            req.word_order,
            "Custom language using phonetic synthesis and Romanized pronunciation.",
            req.cultural_note,
            json.dumps(starter_vocab),
        ),
    )
    conn.commit()
    conn.close()
    return bootstrap_app()


@app.get("/api/lesson/plan")
def get_structured_lesson_plan(
    language_code: str = Query("ta"),
    duration_minutes: int = Query(30),
    explanation_language: str = Query("en"),
    topic_filter: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Build a personalized, structured 5-phase lesson plan scaled to the chosen duration
    (default 30-minute breakdown: 0-5m Revision, 5-12m New Vocabulary, 12-20m Sentence Practice,
    20-27m Real-Life Conversation, 27-30m Memory Test).
    """
    lp = ensure_language_initialized(language_code)
    proficiency = lp.get("proficiency_level", "Beginner")
    vocab = get_language_vocabulary_with_progress(language_code, explanation_language)
    lang_info = get_language_by_code(language_code)

    # Scale phase timings proportionally to duration_minutes (base 30 mins)
    scale = max(10, duration_minutes) / 30.0
    p1_end = max(2, round(5 * scale))
    p2_end = max(p1_end + 2, round(12 * scale))
    p3_end = max(p2_end + 3, round(20 * scale))
    p4_end = max(p3_end + 2, round(27 * scale))
    p5_end = max(p4_end + 1, duration_minutes)

    # 1. Select Revision items (prioritize difficult or due words; if first lesson, do introductory check)
    learned_items = [v for v in vocab if v["isLearned"]]
    due_or_difficult = [
        v for v in learned_items if v["masteryStatus"] in ("difficult", "review_due") or v["mistakeCount"] > 0
    ]
    revision_pool = due_or_difficult + [v for v in learned_items if v not in due_or_difficult]
    is_first_lesson = len(learned_items) == 0

    if is_first_lesson:
        revision_items = vocab[:2]
    else:
        revision_items = revision_pool[: min(4, len(revision_pool))]

    # 2. Select New Vocabulary (5 to 8 items, prioritizing unmastered words matching level/topic)
    target_new_count = 5 if duration_minutes <= 15 else (6 if duration_minutes <= 30 else 8)
    unmastered = [v for v in vocab if v["masteryStatus"] != "mastered"]
    if topic_filter:
        topic_matches = [v for v in vocab if v["topic"].lower() == topic_filter.lower()]
        if topic_matches:
            unmastered = topic_matches + [v for v in unmastered if v not in topic_matches]

    new_vocab_items = unmastered[:target_new_count]
    if len(new_vocab_items) < 5:
        new_vocab_items = vocab[:target_new_count]

    # 3. Sentence Practice items (practical sentences built from the day's vocabulary)
    sentence_items = new_vocab_items[: min(5, len(new_vocab_items))]

    # 4. Real-Life Conversation Scenario matching today's vocabulary
    default_scenario = CONVERSATION_SCENARIOS[0]
    for sc in CONVERSATION_SCENARIOS:
        if any(sc["category"].lower() == v["topic"].lower() for v in new_vocab_items):
            default_scenario = sc
            break

    # 5. Memory Test questions (meaning recall, sentence completion, listening comprehension, spoken response)
    quiz_source = (revision_items + new_vocab_items)[:5]
    memory_test_questions = []
    all_meanings = [v["meaning"] for v in vocab]

    for idx, qitem in enumerate(quiz_source):
        distractors = [m for m in all_meanings if m != qitem["meaning"]][:3]
        options = [qitem["meaning"]] + distractors
        # Deterministic rotation based on index so correct answer isn't always first
        rot = idx % len(options)
        options = options[rot:] + options[:rot]

        q_type = ["spoken_response", "meaning_recall", "listening_comprehension", "sentence_completion"][idx % 4]
        memory_test_questions.append(
            {
                "id": f"lt_{qitem['id']}_{idx}",
                "wordId": qitem["id"],
                "questionType": q_type,
                "prompt": (
                    f"Say '{qitem['meaning']}' aloud in {lang_info['name']}"
                    if q_type == "spoken_response"
                    else (
                        f"Listen and choose the meaning of '{qitem['romanized']}'"
                        if q_type == "listening_comprehension"
                        else (
                            f"Complete the spoken phrase: {qitem['exampleRomanized']}"
                            if q_type == "sentence_completion"
                            else f"What does '{qitem['romanized']}' mean?"
                        )
                    )
                ),
                "targetRomanized": qitem["romanized"] if q_type != "sentence_completion" else qitem["exampleRomanized"],
                "targetNative": qitem["nativeText"] if q_type != "sentence_completion" else qitem["exampleNative"],
                "pronunciationGuide": qitem["pronunciationGuide"],
                "correctMeaning": qitem["meaning"],
                "options": options,
                "hint": f"Syllables: {qitem['pronunciationGuide']} ({qitem['topic']})",
            }
        )

    phases = [
        {
            "id": "revision",
            "phaseNumber": 1,
            "title": "Introductory Speaking Check" if is_first_lesson else "Warm-Up & Spaced Revision",
            "minuteRange": f"Minutes 0–{p1_end}",
            "description": (
                f"Welcome to your first {lang_info['name']} session! Let's try speaking two foundational greetings aloud."
                if is_first_lesson
                else "Recall and speak phrases from your previous sessions, prioritizing words due for review."
            ),
            "items": revision_items,
        },
        {
            "id": "vocabulary",
            "phaseNumber": 2,
            "title": "New Spoken Vocabulary",
            "minuteRange": f"Minutes {p1_end}–{p2_end}",
            "description": f"Learn {len(new_vocab_items)} practical {lang_info['name']} expressions through listening and repeating—no script memorization required.",
            "items": new_vocab_items,
        },
        {
            "id": "sentences",
            "phaseNumber": 3,
            "title": "Sentence Formation & Oral Practice",
            "minuteRange": f"Minutes {p2_end}–{p3_end}",
            "description": "Practice full natural sentences aloud and build spoken fluency with guided hints.",
            "items": sentence_items,
        },
        {
            "id": "conversation",
            "phaseNumber": 4,
            "title": "Real-Life Role-Play Conversation",
            "minuteRange": f"Minutes {p3_end}–{p4_end}",
            "description": f"Practice a live dialogue with Buddy in Scenario: {default_scenario['title']}.",
            "scenario": default_scenario,
        },
        {
            "id": "memory_test",
            "phaseNumber": 5,
            "title": "Memory & Speaking Check",
            "minuteRange": f"Minutes {p4_end}–{p5_end}",
            "description": "Quick spoken recall, listening comprehension, and meaning check to lock in today's phrases.",
            "questions": memory_test_questions,
        },
    ]

    return {
        "languageCode": language_code,
        "languageName": lang_info["name"],
        "nativeName": lang_info["nativeName"],
        "bcp47": lang_info["bcp47"],
        "speechSupportLevel": lang_info["speechSupportLevel"],
        "speechNotes": lang_info["speechNotes"],
        "culturalNote": lang_info["culturalNote"],
        "proficiencyLevel": proficiency,
        "durationMinutes": duration_minutes,
        "isFirstLesson": is_first_lesson,
        "phases": phases,
    }


@app.post("/api/lesson/evaluate")
def evaluate_lesson_speech(req: EvaluateSpeechRequest) -> Dict[str, Any]:
    result = evaluate_speaking_attempt(
        language_code=req.language_code,
        explanation_lang=req.explanation_language,
        user_transcript=req.user_transcript,
        target_romanized=req.target_romanized,
        target_native=req.target_native,
        pronunciation_guide=req.pronunciation_guide,
        target_meaning=req.target_meaning,
        mode=req.mode,
    )
    if req.record_progress and req.word_id:
        record_vocabulary_attempt(req.language_code, req.word_id, result["isCorrect"])
    return result


@app.post("/api/lesson/complete")
def complete_lesson(req: CompleteLessonRequest) -> Dict[str, Any]:
    summary = record_completed_lesson(
        language_code=req.language_code,
        duration_minutes=req.duration_minutes,
        proficiency_level=req.proficiency_level,
        new_words=req.new_words,
        recalled_words=req.recalled_words,
        mistake_words=req.mistake_words,
        conversation_turns=req.conversation_turns,
        accuracy_score=req.accuracy_score,
        recommended_next=req.recommended_next,
    )
    return {
        "summary": summary,
        "bootstrap": bootstrap_app(),
    }


@app.post("/api/conversation/turn")
async def api_conversation_turn(req: ConversationTurnRequest) -> Dict[str, Any]:
    return await generate_conversation_turn(
        language_code=req.language_code,
        explanation_lang=req.explanation_language,
        proficiency_level=req.proficiency_level,
        scenario_id=req.scenario_id,
        user_message=req.user_message,
        turn_index=req.turn_index,
        history=req.history,
    )


@app.post("/api/conversation/save")
def api_save_conversation(req: SaveConversationRequest) -> Dict[str, Any]:
    saved = save_conversation_session(
        language_code=req.language_code,
        scenario_id=req.scenario_id,
        scenario_title=req.scenario_title,
        proficiency_level=req.proficiency_level,
        messages=req.messages,
        corrections_count=req.corrections_count,
    )
    return {
        "saved": saved,
        "recentConversations": get_recent_conversations(req.language_code, limit=5),
    }


@app.get("/api/vocabulary/{language_code}")
def api_get_vocabulary(language_code: str, explanation_language: str = Query("en")) -> Dict[str, Any]:
    vocab = get_language_vocabulary_with_progress(language_code, explanation_language)
    return {
        "languageCode": language_code,
        "vocabulary": vocab,
        "topics": TOPICS,
    }


@app.get("/api/quiz/{language_code}")
def api_get_revision_quiz(language_code: str, explanation_language: str = Query("en")) -> Dict[str, Any]:
    vocab = get_language_vocabulary_with_progress(language_code, explanation_language)
    lang_info = get_language_by_code(language_code)

    # Prioritize difficult and due words, then learned words, then starter words
    difficult_or_due = [v for v in vocab if v["masteryStatus"] in ("difficult", "review_due") or v["mistakeCount"] > 0]
    learned = [v for v in vocab if v["isLearned"] and v not in difficult_or_due]
    unlearned = [v for v in vocab if not v["isLearned"]]

    pool = (difficult_or_due + learned + unlearned)[:8]
    all_meanings = [v["meaning"] for v in vocab]

    questions = []
    for idx, item in enumerate(pool):
        distractors = [m for m in all_meanings if m != item["meaning"]][:3]
        options = [item["meaning"]] + distractors
        rot = (idx + 1) % len(options)
        options = options[rot:] + options[:rot]

        mode = ["speaking", "listening", "meaning", "sentence"][idx % 4]
        questions.append(
            {
                "id": f"quiz_{item['id']}_{idx}",
                "wordId": item["id"],
                "mode": mode,
                "topic": item["topic"],
                "masteryStatus": item["masteryStatus"],
                "mistakeCount": item["mistakeCount"],
                "nativeText": item["nativeText"],
                "romanized": item["romanized"],
                "pronunciationGuide": item["pronunciationGuide"],
                "meaning": item["meaning"],
                "exampleNative": item["exampleNative"],
                "exampleRomanized": item["exampleRomanized"],
                "exampleMeaning": item["exampleMeaning"],
                "options": options,
            }
        )

    return {
        "languageCode": language_code,
        "languageName": lang_info["name"],
        "bcp47": lang_info["bcp47"],
        "learnedCount": len([v for v in vocab if v["isLearned"]]),
        "dueCount": len(difficult_or_due),
        "questions": questions,
    }


# Serve built React frontend in production when ../frontend/dist exists
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

