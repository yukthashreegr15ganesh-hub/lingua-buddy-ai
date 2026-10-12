"""
Configurable AI Tutor & Phonetic Evaluation Engine for LINGUA BUDDY AI.
Supports live Gemini / OpenAI API integration via server-side environment variables,
with an honest, transparent, grammar-aware multilingual fallback tutor engine.
"""

import os
import re
import json
from difflib import SequenceMatcher
from typing import Dict, List, Any, Optional
import httpx
from dotenv import load_dotenv

from languages_data import (
    get_language_by_code,
    localize_vocab_item,
    CONVERSATION_SCENARIOS,
    EXPLANATION_LANGUAGES,
)

load_dotenv()

# Runtime configurable keys (server-side only, never exposed to frontend)
_RUNTIME_CONFIG = {
    "gemini_api_key": os.getenv("GEMINI_API_KEY", "").strip(),
    "openai_api_key": os.getenv("OPENAI_API_KEY", "").strip(),
    "openai_base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip(),
    "model": os.getenv("LLM_MODEL", "").strip(),
}


def get_ai_status() -> Dict[str, Any]:
    """Return honest status of the AI integration without exposing any keys."""
    if _RUNTIME_CONFIG["gemini_api_key"]:
        return {
            "liveAiConfigured": True,
            "provider": "Google Gemini API",
            "model": _RUNTIME_CONFIG["model"] or "gemini-2.5-flash",
            "mode": "live_llm",
            "message": "Connected to live Google Gemini API for dynamic conversation and personalized coaching.",
            "setupInstructions": None,
        }
    if _RUNTIME_CONFIG["openai_api_key"]:
        return {
            "liveAiConfigured": True,
            "provider": "OpenAI-Compatible LLM API",
            "model": _RUNTIME_CONFIG["model"] or "gpt-4o-mini",
            "mode": "live_llm",
            "message": "Connected to live OpenAI-compatible LLM API for dynamic conversation and coaching.",
            "setupInstructions": None,
        }
    return {
        "liveAiConfigured": False,
        "provider": "Built-in Multilingual Tutor Engine (Local Mode)",
        "model": "lingua-buddy-local-v1",
        "mode": "local_fallback",
        "message": (
            "Running in Built-in Multilingual Tutor Mode. No external LLM API key is currently configured. "
            "Lessons, spaced repetition, phonetic evaluation, and scenario dialogues work offline using verified language data."
        ),
        "setupInstructions": (
            "To enable live cloud LLM generation, set GEMINI_API_KEY or OPENAI_API_KEY in backend/.env "
            "or enter your key in Settings -> AI Tutor Connection."
        ),
    }


def set_runtime_api_key(provider: str, api_key: str, model: str = "") -> Dict[str, Any]:
    """Allow configuring the server-side API key at runtime without hardcoding."""
    clean_key = api_key.strip()
    if provider == "gemini":
        _RUNTIME_CONFIG["gemini_api_key"] = clean_key
    elif provider == "openai":
        _RUNTIME_CONFIG["openai_api_key"] = clean_key
    if model.strip():
        _RUNTIME_CONFIG["model"] = model.strip()
    return get_ai_status()


def normalize_phonetic(text: str) -> str:
    """
    Normalize Romanized or native text for fair spoken/phonetic comparison.
    Handles common Indic and global transliteration equivalences (aa/a, ee/i, oo/u, th/t, dh/d, zh/l, ph/f).
    """
    if not text:
        return ""
    s = text.lower().strip()
    # Remove punctuation
    s = re.sub(r"[^\w\s]", " ", s)
    # Normalize common Romanization variations so learners aren't penalized for spelling variants
    replacements = [
        ("aa", "a"),
        ("ee", "i"),
        ("oo", "u"),
        ("th", "t"),
        ("dh", "d"),
        ("bh", "b"),
        ("gh", "g"),
        ("kh", "k"),
        ("ph", "p"),
        ("zh", "l"),
        ("sh", "s"),
        ("chh", "ch"),
        ("ng", "n"),
        ("ou", "o"),
    ]
    for old, new in replacements:
        s = s.replace(old, new)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# Localized coach encouragement templates in multiple explanation languages
EXPLANATION_TEMPLATES: Dict[str, Dict[str, str]] = {
    "en": {
        "great": "Wonderful job! You pronounced '{roman}' clearly.",
        "close": "Very close! You captured most of '{roman}', just watch the syllables: {guide}.",
        "try_again": "Good effort! Let's listen once more and say '{roman}' ({guide}) together.",
        "meaning_label": "Meaning",
        "tip_label": "Pronunciation Guide",
    },
    "kn": {
        "great": "ಅದ್ಭುತ! (Wonderful!) ನೀವು '{roman}' ಅನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿದ್ದೀರಿ.",
        "close": "ತುಂಬಾ ಹತ್ತಿರದಲ್ಲಿದ್ದೀರಿ! (Very close!) '{roman}' ಉಚ್ಚಾರಣೆಯನ್ನು ಹೀಗೆ ಪ್ರಯತ್ನಿಸಿ: {guide}.",
        "try_again": "ಒಳ್ಳೆಯ ಪ್ರಯತ್ನ! (Good effort!) ಮತ್ತೊಮ್ಮೆ ಕೇಳಿ '{roman}' ({guide}) ಹೇಳೋಣ.",
        "meaning_label": "ಅರ್ಥ (Meaning)",
        "tip_label": "ಉಚ್ಚಾರಣೆ (Pronunciation)",
    },
    "hi": {
        "great": "बहुत बढ़िया! (Wonderful!) आपने '{roman}' बिल्कुल सही बोला।",
        "close": "बहुत करीब! (Very close!) '{roman}' के इन अक्षरों पर ध्यान दें: {guide}।",
        "try_again": "अच्छा प्रयास! (Good try!) आइए एक बार फिर सुनें और बोलें: '{roman}' ({guide})।",
        "meaning_label": "अर्थ (Meaning)",
        "tip_label": "उच्चारण (Pronunciation)",
    },
    "ta": {
        "great": "அருமை! (Wonderful!) '{roman}' என்பதைத் தெளிவாகச் சொன்னீர்கள்.",
        "close": "மிகவும் நெருக்கமாகச் சொன்னீர்கள்! '{roman}' உச்சரிப்பு: {guide}.",
        "try_again": "நல்ல முயற்சி! மீண்டும் ஒருமுறை கேட்டு '{roman}' ({guide}) என்று சொல்லிப் பார்ப்போம்.",
        "meaning_label": "பொருள் (Meaning)",
        "tip_label": "உச்சரிப்பு (Pronunciation)",
    },
    "te": {
        "great": "చాలా బాగుంది! (Wonderful!) మీరు '{roman}' చాలా స్పష్టంగా చెప్పారు.",
        "close": "దాదాపు సరైనదే! '{roman}' ఉచ్చారణను ఇలా ప్రయత్నించండి: {guide}.",
        "try_again": "మంచి ప్రయత్నం! మరోసారి విని '{roman}' ({guide}) అని చెబుదాం.",
        "meaning_label": "అర్థం (Meaning)",
        "tip_label": "ఉచ్చారణ (Pronunciation)",
    },
}


def evaluate_speaking_attempt(
    language_code: str,
    explanation_lang: str,
    user_transcript: str,
    target_romanized: str,
    target_native: str,
    pronunciation_guide: str,
    target_meaning: str,
    mode: str = "repeat",  # "repeat" or "meaning"
) -> Dict[str, Any]:
    """
    Evaluate a user's spoken or typed phrase honestly.
    Distinguishes between word/transcription match and phonetic similarity.
    """
    clean_input = (user_transcript or "").strip()
    tpl = EXPLANATION_TEMPLATES.get(explanation_lang, EXPLANATION_TEMPLATES["en"])

    if not clean_input:
        return {
            "isCorrect": False,
            "similarityScore": 0,
            "evaluationMethod": "No speech or text detected",
            "characterState": "ENCOURAGING",
            "userSaid": "",
            "targetRomanized": target_romanized,
            "targetNative": target_native,
            "pronunciationGuide": pronunciation_guide,
            "matchedWords": [],
            "missedWords": target_romanized.split(),
            "feedback": tpl["try_again"].format(roman=target_romanized, guide=pronunciation_guide),
            "detailedNote": "We didn't catch any audio or text. Tap the microphone and speak clearly, or use the text box below.",
        }

    # Check both Romanized phonetic similarity and direct native script match (in case browser ASR output native script)
    # Also handle slash-separated alternatives like "Dhanyavaad / Shukriya"
    roman_alternatives = [alt.strip() for alt in re.split(r"[/|()]", target_romanized) if alt.strip()]
    native_alternatives = [alt.strip() for alt in re.split(r"[/|()]", target_native) if alt.strip()]

    norm_user = normalize_phonetic(clean_input)
    best_ratio = 0.0

    for alt in roman_alternatives:
        norm_alt = normalize_phonetic(alt)
        if not norm_alt:
            continue
        r = SequenceMatcher(None, norm_user, norm_alt).ratio()
        if norm_alt in norm_user or norm_user in norm_alt and len(norm_user) >= 3:
            r = max(r, 0.86)
        best_ratio = max(best_ratio, r)

    for n_alt in native_alternatives:
        clean_n = re.sub(r"[^\w\s]", "", n_alt).strip()
        clean_u = re.sub(r"[^\w\s]", "", clean_input).strip()
        if clean_n and clean_u:
            r_nat = SequenceMatcher(None, clean_u, clean_n).ratio()
            best_ratio = max(best_ratio, r_nat)

    if mode == "meaning":
        norm_meaning = normalize_phonetic(target_meaning)
        r_mean = SequenceMatcher(None, norm_user, norm_meaning).ratio()
        if any(w in norm_meaning.split() for w in norm_user.split() if len(w) > 3):
            r_mean = max(r_mean, 0.85)
        best_ratio = max(best_ratio, r_mean)

    # Word-level breakdown against primary Romanized phrase
    primary_roman = roman_alternatives[0] if roman_alternatives else target_romanized
    target_words = [re.sub(r"[^\w]", "", w) for w in primary_roman.split() if re.sub(r"[^\w]", "", w)]
    user_words_norm = [normalize_phonetic(w) for w in clean_input.split() if normalize_phonetic(w)]

    matched_words = []
    missed_words = []
    for tw in target_words:
        tw_norm = normalize_phonetic(tw)
        word_matched = any(
            SequenceMatcher(None, tw_norm, uw).ratio() >= 0.65 or tw_norm in uw or uw in tw_norm
            for uw in user_words_norm
        )
        if word_matched or best_ratio >= 0.85:
            matched_words.append(tw)
        else:
            missed_words.append(tw)

    if target_words and len(matched_words) / len(target_words) >= 0.65:
        best_ratio = max(best_ratio, 0.78)

    similarity_pct = int(round(min(1.0, best_ratio) * 100))
    is_correct = similarity_pct >= 62

    if similarity_pct >= 80:
        char_state = "HAPPY"
        feedback = tpl["great"].format(roman=target_romanized, guide=pronunciation_guide)
    elif similarity_pct >= 58:
        char_state = "CORRECTING"
        feedback = tpl["close"].format(roman=target_romanized, guide=pronunciation_guide)
    else:
        char_state = "ENCOURAGING"
        feedback = tpl["try_again"].format(roman=target_romanized, guide=pronunciation_guide)

    return {
        "isCorrect": is_correct,
        "similarityScore": similarity_pct,
        "evaluationMethod": "Speech-to-Text Transcription & Romanized Phonetic Similarity (Note: Evaluates word/syllable recognition rather than acoustic phoneme grading)",
        "characterState": char_state,
        "userSaid": clean_input,
        "targetRomanized": target_romanized,
        "targetNative": target_native,
        "pronunciationGuide": pronunciation_guide,
        "targetMeaning": target_meaning,
        "matchedWords": matched_words,
        "missedWords": missed_words,
        "feedback": feedback,
    }


async def _call_live_llm_conversation(
    lang: Dict[str, Any],
    explanation_lang: str,
    proficiency_level: str,
    scenario: Dict[str, Any],
    user_message: str,
    history: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Call configured Gemini or OpenAI endpoint if an API key is present on the server."""
    exp_name = next((e["name"] for e in EXPLANATION_LANGUAGES if e["code"] == explanation_lang), "English")
    system_prompt = (
        f"You are Lingua Buddy AI, a warm, encouraging personal language tutor teaching spoken {lang['name']}. "
        f"The user's proficiency level is {proficiency_level}. "
        f"Provide all explanations and meanings in {exp_name}. "
        f"Current role-play scenario: '{scenario['title']}' ({scenario['description']}). "
        f"IMPORTANT: Never force the user to read or write native script. Always prioritize easy Roman-letter pronunciation. "
        f"Return ONLY valid JSON with keys: "
        f"'tutorNative' (sentence in {lang['name']} script), "
        f"'tutorRomanized' (clear Romanized pronunciation), "
        f"'tutorPronunciationGuide' (syllable breakdown), "
        f"'tutorMeaning' (meaning in {exp_name}), "
        f"'characterState' (one of: SPEAKING, HAPPY, ENCOURAGING, CORRECTING), "
        f"'correction' (null if user was natural, or object with keys 'gentleNote', 'naturalRomanized', 'naturalNative', 'pronunciationGuide', 'meaning'), "
        f"'responseHints' (array of 2-3 objects with 'romanized', 'native', 'meaning' that the learner can say next)."
    )

    try:
        if _RUNTIME_CONFIG["gemini_api_key"]:
            model = _RUNTIME_CONFIG["model"] or "gemini-2.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_RUNTIME_CONFIG['gemini_api_key']}"
            contents = [{"role": "user", "parts": [{"text": f"{system_prompt}\n\nConversation so far: {json.dumps(history[-4:])}\nLearner said: {user_message}"}]}]
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    url,
                    json={
                        "contents": contents,
                        "generationConfig": {"responseMimeType": "application/json"},
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(text)

        if _RUNTIME_CONFIG["openai_api_key"]:
            model = _RUNTIME_CONFIG["model"] or "gpt-4o-mini"
            url = f"{_RUNTIME_CONFIG['openai_base_url'].rstrip('/')}/chat/completions"
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {_RUNTIME_CONFIG['openai_api_key']}"},
                    json={
                        "model": model,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": f"History: {json.dumps(history[-4:])}\nLearner said: {user_message}"},
                        ],
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text = data["choices"][0]["message"]["content"]
                    return json.loads(text)
    except Exception:
        return None
    return None


async def generate_conversation_turn(
    language_code: str,
    explanation_lang: str,
    proficiency_level: str,
    scenario_id: str,
    user_message: str,
    turn_index: int = 0,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Generate a natural role-play conversation turn in the target language.
    Uses live LLM API if configured; otherwise uses our structured scenario-aware multilingual tutor engine.
    """
    lang = get_language_by_code(language_code)
    vocab = [localize_vocab_item(v, explanation_lang) for v in lang.get("vocabulary", [])]
    scenario = next((s for s in CONVERSATION_SCENARIOS if s["id"] == scenario_id), CONVERSATION_SCENARIOS[0])

    # Lookup helper by conceptKey
    by_concept = {v["conceptKey"]: v for v in vocab}

    # Try live LLM if configured and user sent a message
    if user_message.strip() and (_RUNTIME_CONFIG["gemini_api_key"] or _RUNTIME_CONFIG["openai_api_key"]):
        live_res = await _call_live_llm_conversation(
            lang, explanation_lang, proficiency_level, scenario, user_message, history or []
        )
        if live_res and "tutorRomanized" in live_res:
            return {
                **live_res,
                "aiMode": "live_llm",
                "scenarioTitle": scenario["title"],
            }

    # Scenario-specific ordered concept flows so each of the 15 scenarios feels purposeful and natural
    scenario_flows: Dict[str, List[str]] = {
        "friend_chat": ["hello", "how_are_you", "had_food", "daily_routine", "see_you_again"],
        "introduce_yourself": ["hello", "what_is_your_name", "my_name_is", "how_are_you", "see_you_again"],
        "greet_family": ["hello", "family_well", "had_food", "i_am_fine", "see_you_again"],
        "ordering_food": ["hello", "had_food", "water_please", "how_much", "thank_you"],
        "market_shopping": ["hello", "how_much", "understand_little", "thank_you", "see_you_again"],
        "asking_directions": ["hello", "where_is", "understand_little", "thank_you", "see_you_again"],
        "speaking_teacher": ["hello", "understand_little", "common_verbs", "thank_you", "see_you_again"],
        "bus_train_travel": ["hello", "where_is", "travel_ticket", "what_time", "thank_you"],
        "talking_shopkeeper": ["hello", "how_much", "water_please", "thank_you", "see_you_again"],
        "visiting_hospital": ["hello", "how_are_you", "water_please", "understand_little", "thank_you"],
        "meeting_new_people": ["hello", "what_is_your_name", "my_name_is", "family_well", "see_you_again"],
        "phone_call": ["hello", "how_are_you", "what_time", "work_meeting", "see_you_again"],
        "job_interview": ["hello", "my_name_is", "daily_routine", "work_meeting", "thank_you"],
        "visiting_new_city": ["hello", "where_is", "travel_ticket", "how_much", "thank_you"],
        "casual_daily_chat": ["hello", "how_are_you", "had_food", "what_time", "see_you_again"],
    }

    flow_keys = scenario_flows.get(scenario_id, ["hello", "how_are_you", "what_is_your_name", "thank_you", "see_you_again"])
    flow_items = [by_concept.get(k, vocab[0]) for k in flow_keys if by_concept.get(k) or vocab]

    # Opening turn (turn_index == 0 or empty user_message)
    if not user_message.strip() or turn_index == 0:
        opener = flow_items[0]
        second = flow_items[1] if len(flow_items) > 1 else flow_items[0]
        expected_reply_item = by_concept.get("i_am_fine") if second["conceptKey"] == "how_are_you" else second

        return {
            "aiMode": "local_fallback",
            "scenarioTitle": scenario["title"],
            "characterState": "GREETING",
            "tutorNative": f"{opener['nativeText']}! {second['exampleNative']}",
            "tutorRomanized": f"{opener['romanized']}! {second['exampleRomanized']}",
            "tutorPronunciationGuide": f"{opener['pronunciationGuide']} | {second['pronunciationGuide']}",
            "tutorMeaning": f"{opener['meaning']} — {second['exampleMeaning']}",
            "coachNote": (
                f"Scenario: {scenario['title']} ({scenario['setting']}). "
                f"Listen to Buddy and reply using your microphone in {lang['name']}!"
            ),
            "correction": None,
            "responseHints": [
                {
                    "romanized": expected_reply_item["romanized"],
                    "native": expected_reply_item["nativeText"],
                    "pronunciationGuide": expected_reply_item["pronunciationGuide"],
                    "meaning": expected_reply_item["meaning"],
                },
                {
                    "romanized": opener["romanized"],
                    "native": opener["nativeText"],
                    "pronunciationGuide": opener["pronunciationGuide"],
                    "meaning": opener["meaning"],
                },
                {
                    "romanized": by_concept.get("understand_little", opener)["romanized"],
                    "native": by_concept.get("understand_little", opener)["nativeText"],
                    "pronunciationGuide": by_concept.get("understand_little", opener)["pronunciationGuide"],
                    "meaning": by_concept.get("understand_little", opener)["meaning"],
                },
            ],
        }

    # Evaluate user's spoken/typed turn against the language's expressions
    norm_user = normalize_phonetic(user_message)
    best_match_item = None
    best_score = 0.0

    for item in vocab:
        for candidate in [item["romanized"], item["exampleRomanized"], item["nativeText"]]:
            score = SequenceMatcher(None, norm_user, normalize_phonetic(candidate)).ratio()
            if normalize_phonetic(item["romanized"]) in norm_user and len(norm_user) >= 3:
                score = max(score, 0.85)
            if score > best_score:
                best_score = score
                best_match_item = item

    # Pick next item in the scenario flow
    step_idx = min(turn_index, len(flow_items) - 1)
    next_item = flow_items[step_idx]
    follow_item = flow_items[min(step_idx + 1, len(flow_items) - 1)]

    # Build gentle 5-part correction if the learner spoke in English (when learning non-English) or had low similarity
    correction = None
    character_state = "SPEAKING"

    if best_score >= 0.72:
        character_state = "HAPPY"
    elif best_score >= 0.45 and best_match_item:
        character_state = "CORRECTING"
        correction = {
            "gentleNote": f"Nice try! To sound even more natural in {lang['name']}, you can say it like this:",
            "naturalRomanized": best_match_item["exampleRomanized"],
            "naturalNative": best_match_item["exampleNative"],
            "pronunciationGuide": best_match_item["pronunciationGuide"],
            "meaning": best_match_item["meaning"],
        }
    else:
        character_state = "ENCOURAGING"
        suggested = flow_items[max(0, step_idx - 1)]
        correction = {
            "gentleNote": f"Good effort! In this situation ({scenario['title']}), a natural way to respond in {lang['name']} is:",
            "naturalRomanized": suggested["exampleRomanized"],
            "naturalNative": suggested["exampleNative"],
            "pronunciationGuide": suggested["pronunciationGuide"],
            "meaning": suggested["meaning"],
        }

    # Map natural response hints for the next turn
    reply_candidates = [
        follow_item,
        by_concept.get("i_am_fine", vocab[0]),
        by_concept.get("thank_you", vocab[0]),
    ]
    seen_ids = set()
    hints = []
    for rc in reply_candidates:
        if rc["id"] not in seen_ids:
            seen_ids.add(rc["id"])
            hints.append(
                {
                    "romanized": rc["exampleRomanized"] if proficiency_level != "Beginner" else rc["romanized"],
                    "native": rc["exampleNative"] if proficiency_level != "Beginner" else rc["nativeText"],
                    "pronunciationGuide": rc["pronunciationGuide"],
                    "meaning": rc["meaning"],
                }
            )

    return {
        "aiMode": "local_fallback",
        "scenarioTitle": scenario["title"],
        "characterState": character_state,
        "tutorNative": next_item["exampleNative"],
        "tutorRomanized": next_item["exampleRomanized"],
        "tutorPronunciationGuide": next_item["pronunciationGuide"],
        "tutorMeaning": next_item["meaning"],
        "coachNote": next_item["grammarNote"],
        "correction": correction,
        "responseHints": hints,
    }
