"""
SQLite Database Layer for LINGUA BUDDY AI.
Persists user preferences, per-language progress, spaced-repetition vocabulary,
lesson history, conversation replay logs, and daily schedules.
"""

import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional

from languages_data import LANGUAGES_REGISTRY, get_language_by_code, localize_vocab_item

DB_PATH = Path(__file__).parent / "lingua_buddy.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    # 1. Global User Profile & Preferences
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            learner_name TEXT DEFAULT 'Friend',
            active_language TEXT DEFAULT 'ta',
            explanation_language TEXT DEFAULT 'en',
            learning_reason TEXT DEFAULT 'Speak confidently in daily conversations',
            daily_duration_minutes INTEGER DEFAULT 30,
            preferred_time TEXT DEFAULT '19:00',
            scheduled_days TEXT DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]',
            reminder_enabled INTEGER DEFAULT 1,
            speaking_speed REAL DEFAULT 0.95,
            show_native_script INTEGER DEFAULT 0,
            onboarding_completed INTEGER DEFAULT 0,
            updated_at TEXT
        )
        """
    )

    # Ensure single default row exists
    cur.execute("SELECT id FROM user_profile WHERE id = 1")
    if not cur.fetchone():
        cur.execute(
            """
            INSERT INTO user_profile (
                id, learner_name, active_language, explanation_language,
                learning_reason, daily_duration_minutes, preferred_time,
                scheduled_days, reminder_enabled, speaking_speed,
                show_native_script, onboarding_completed, updated_at
            ) VALUES (1, 'Learner', 'ta', 'en', 'Connect with friends and speak naturally', 30, '19:00',
                      '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]', 1, 0.95, 0, 0, ?)
            """,
            (datetime.now().isoformat(),),
        )

    # 2. Per-Language Progress Table (retains state when switching languages)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS language_progress (
            language_code TEXT PRIMARY KEY,
            proficiency_level TEXT DEFAULT 'Beginner',
            understanding_comfort TEXT DEFAULT 'complete_beginner',
            completed_lessons INTEGER DEFAULT 0,
            total_minutes INTEGER DEFAULT 0,
            streak_days INTEGER DEFAULT 0,
            last_active_date TEXT DEFAULT '',
            daily_minutes_today INTEGER DEFAULT 0,
            preferred_duration INTEGER DEFAULT 30,
            preferred_time TEXT DEFAULT '19:00',
            updated_at TEXT
        )
        """
    )

    # 3. Spaced-Repetition Vocabulary Collection per Language
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS vocabulary_progress (
            word_id TEXT PRIMARY KEY,
            language_code TEXT NOT NULL,
            topic TEXT,
            level TEXT,
            native_text TEXT,
            romanized TEXT,
            pronunciation_guide TEXT,
            meanings_json TEXT,
            example_native TEXT,
            example_romanized TEXT,
            example_meaning TEXT,
            grammar_note TEXT,
            last_practiced_at TEXT,
            successful_recalls INTEGER DEFAULT 0,
            mistake_count INTEGER DEFAULT 0,
            next_review_at TEXT,
            interval_days INTEGER DEFAULT 1,
            mastery_status TEXT DEFAULT 'new'
        )
        """
    )

    # 4. Completed Lesson History per Language
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS lesson_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language_code TEXT NOT NULL,
            duration_minutes INTEGER,
            proficiency_level TEXT,
            new_words_count INTEGER,
            recalled_correctly_count INTEGER,
            mistakes_count INTEGER,
            conversation_turns INTEGER,
            accuracy_score INTEGER,
            summary_json TEXT,
            created_at TEXT
        )
        """
    )

    # 5. Conversation History & Replay per Language
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language_code TEXT NOT NULL,
            scenario_id TEXT NOT NULL,
            scenario_title TEXT,
            proficiency_level TEXT,
            messages_json TEXT,
            corrections_count INTEGER DEFAULT 0,
            turns_count INTEGER DEFAULT 0,
            created_at TEXT
        )
        """
    )

    # 6. Dynamic Custom Languages Table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS custom_languages (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            native_name TEXT,
            region TEXT DEFAULT 'Additional Languages',
            bcp47 TEXT DEFAULT 'en-US',
            word_order TEXT DEFAULT 'SVO',
            speech_support_level TEXT DEFAULT 'phonetic-fallback',
            speech_notes TEXT,
            cultural_note TEXT,
            vocabulary_json TEXT
        )
        """
    )

    conn.commit()
    conn.close()


def ensure_language_initialized(language_code: str) -> Dict[str, Any]:
    """Ensure a language_progress row exists for the requested language."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM language_progress WHERE language_code = ?", (language_code,))
    row = cur.fetchone()
    now_iso = datetime.now().isoformat()
    if not row:
        cur.execute(
            """
            INSERT INTO language_progress (
                language_code, proficiency_level, understanding_comfort,
                completed_lessons, total_minutes, streak_days,
                last_active_date, daily_minutes_today, preferred_duration,
                preferred_time, updated_at
            ) VALUES (?, 'Beginner', 'complete_beginner', 0, 0, 0, '', 0, 30, '19:00', ?)
            """,
            (language_code, now_iso),
        )
        conn.commit()
        cur.execute("SELECT * FROM language_progress WHERE language_code = ?", (language_code,))
        row = cur.fetchone()
    conn.close()
    return dict(row)


def get_user_profile() -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM user_profile WHERE id = 1")
    row = cur.fetchone()
    conn.close()
    data = dict(row)
    try:
        data["scheduled_days"] = json.loads(data.get("scheduled_days") or '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]')
    except Exception:
        data["scheduled_days"] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    data["reminder_enabled"] = bool(data.get("reminder_enabled", 1))
    data["show_native_script"] = bool(data.get("show_native_script", 0))
    data["onboarding_completed"] = bool(data.get("onboarding_completed", 0))
    return data


def update_user_profile(updates: Dict[str, Any]) -> Dict[str, Any]:
    current = get_user_profile()
    merged = {**current, **updates}
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE user_profile
        SET learner_name = ?,
            active_language = ?,
            explanation_language = ?,
            learning_reason = ?,
            daily_duration_minutes = ?,
            preferred_time = ?,
            scheduled_days = ?,
            reminder_enabled = ?,
            speaking_speed = ?,
            show_native_script = ?,
            onboarding_completed = ?,
            updated_at = ?
        WHERE id = 1
        """,
        (
            merged["learner_name"],
            merged["active_language"],
            merged["explanation_language"],
            merged["learning_reason"],
            int(merged["daily_duration_minutes"]),
            merged["preferred_time"],
            json.dumps(merged["scheduled_days"]),
            1 if merged["reminder_enabled"] else 0,
            float(merged["speaking_speed"]),
            1 if merged["show_native_script"] else 0,
            1 if merged["onboarding_completed"] else 0,
            datetime.now().isoformat(),
        ),
    )
    conn.commit()
    conn.close()

    # Also ensure language_progress row exists and sync schedule if provided
    ensure_language_initialized(merged["active_language"])
    if "proficiency_level" in updates or "understanding_comfort" in updates:
        conn = get_conn()
        cur = conn.cursor()
        if "proficiency_level" in updates:
            cur.execute(
                "UPDATE language_progress SET proficiency_level = ?, updated_at = ? WHERE language_code = ?",
                (updates["proficiency_level"], datetime.now().isoformat(), merged["active_language"]),
            )
        if "understanding_comfort" in updates:
            cur.execute(
                "UPDATE language_progress SET understanding_comfort = ?, updated_at = ? WHERE language_code = ?",
                (updates["understanding_comfort"], datetime.now().isoformat(), merged["active_language"]),
            )
        conn.commit()
        conn.close()

    return get_user_profile()


def get_all_languages_with_progress(explanation_lang: str = "en") -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM language_progress")
    progress_rows = {r["language_code"]: dict(r) for r in cur.fetchall()}

    cur.execute(
        """
        SELECT language_code,
               COUNT(*) as total_tracked,
               SUM(CASE WHEN mastery_status = 'mastered' THEN 1 ELSE 0 END) as mastered_count,
               SUM(CASE WHEN mastery_status = 'difficult' OR mistake_count > 0 THEN 1 ELSE 0 END) as difficult_count,
               SUM(CASE WHEN next_review_at <= ? AND mastery_status != 'new' THEN 1 ELSE 0 END) as due_count
        FROM vocabulary_progress
        GROUP BY language_code
        """,
        (datetime.now().isoformat(),),
    )
    vocab_stats = {r["language_code"]: dict(r) for r in cur.fetchall()}

    # Load any custom languages
    cur.execute("SELECT * FROM custom_languages")
    custom_rows = cur.fetchall()
    conn.close()

    all_langs = list(LANGUAGES_REGISTRY)
    for crow in custom_rows:
        cd = dict(crow)
        try:
            vocab = json.loads(cd.get("vocabulary_json") or "[]")
        except Exception:
            vocab = []
        all_langs.append(
            {
                "code": cd["code"],
                "name": cd["name"],
                "nativeName": cd["native_name"] or cd["name"],
                "region": cd["region"],
                "bcp47": cd["bcp47"],
                "wordOrder": cd["word_order"],
                "speechSupportLevel": cd["speech_support_level"],
                "speechNotes": cd["speech_notes"] or "Uses phonetic synthesis and Romanized pronunciation.",
                "culturalNote": cd["cultural_note"] or "",
                "vocabulary": vocab,
            }
        )

    result = []
    for lang in all_langs:
        code = lang["code"]
        p = progress_rows.get(
            code,
            {
                "language_code": code,
                "proficiency_level": "Beginner",
                "understanding_comfort": "complete_beginner",
                "completed_lessons": 0,
                "total_minutes": 0,
                "streak_days": 0,
                "last_active_date": "",
                "daily_minutes_today": 0,
            },
        )
        vs = vocab_stats.get(
            code,
            {
                "total_tracked": 0,
                "mastered_count": 0,
                "difficult_count": 0,
                "due_count": 0,
            },
        )
        result.append(
            {
                "code": code,
                "name": lang["name"],
                "nativeName": lang["nativeName"],
                "region": lang["region"],
                "bcp47": lang["bcp47"],
                "wordOrder": lang["wordOrder"],
                "speechSupportLevel": lang["speechSupportLevel"],
                "speechNotes": lang["speechNotes"],
                "culturalNote": lang["culturalNote"],
                "curriculumCount": len(lang.get("vocabulary", [])),
                "progress": {
                    "proficiencyLevel": p.get("proficiency_level", "Beginner"),
                    "understandingComfort": p.get("understanding_comfort", "complete_beginner"),
                    "completedLessons": p.get("completed_lessons", 0),
                    "totalMinutes": p.get("total_minutes", 0),
                    "streakDays": p.get("streak_days", 0),
                    "lastActiveDate": p.get("last_active_date", ""),
                    "dailyMinutesToday": p.get("daily_minutes_today", 0),
                    "wordsLearned": vs.get("total_tracked", 0) or 0,
                    "wordsMastered": vs.get("mastered_count", 0) or 0,
                    "difficultWords": vs.get("difficult_count", 0) or 0,
                    "dueForReview": vs.get("due_count", 0) or 0,
                },
            }
        )
    return result


def get_language_vocabulary_with_progress(language_code: str, explanation_lang: str = "en") -> List[Dict[str, Any]]:
    """Merge the language's curriculum vocabulary with stored spaced-repetition progress."""
    lang = get_language_by_code(language_code)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM vocabulary_progress WHERE language_code = ?", (language_code,))
    stored_map = {r["word_id"]: dict(r) for r in cur.fetchall()}
    conn.close()

    merged_list = []
    now_iso = datetime.now().isoformat()

    for item in lang.get("vocabulary", []):
        localized = localize_vocab_item(item, explanation_lang)
        wid = item["id"]
        st = stored_map.get(wid)
        if st:
            is_due = bool(st.get("next_review_at") and st["next_review_at"] <= now_iso and st["mastery_status"] != "new")
            merged_list.append(
                {
                    **localized,
                    "lastPracticedAt": st.get("last_practiced_at"),
                    "successfulRecalls": st.get("successful_recalls", 0),
                    "mistakeCount": st.get("mistake_count", 0),
                    "nextReviewAt": st.get("next_review_at"),
                    "intervalDays": st.get("interval_days", 1),
                    "masteryStatus": "review_due" if is_due and st.get("mastery_status") != "difficult" else st.get("mastery_status", "learning"),
                    "isLearned": True,
                    "isDue": is_due,
                }
            )
        else:
            merged_list.append(
                {
                    **localized,
                    "lastPracticedAt": None,
                    "successfulRecalls": 0,
                    "mistakeCount": 0,
                    "nextReviewAt": None,
                    "intervalDays": 0,
                    "masteryStatus": "new",
                    "isLearned": False,
                    "isDue": False,
                }
            )

    return merged_list


def record_vocabulary_attempt(
    language_code: str,
    word_id: str,
    is_correct: bool,
) -> Dict[str, Any]:
    """
    Update spaced repetition state for a vocabulary item after an oral/quiz attempt.
    - Correct recall increases interval (1 -> 3 -> 7 -> 14 -> 30 days) and promotes mastery.
    - Mistake schedules immediate/next-session review and flags as 'difficult' if repeated.
    """
    lang = get_language_by_code(language_code)
    vocab_lookup = {v["id"]: v for v in lang.get("vocabulary", [])}
    item = vocab_lookup.get(word_id)
    if not item and lang.get("vocabulary"):
        item = lang["vocabulary"][0]

    now = datetime.now()
    now_iso = now.isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM vocabulary_progress WHERE word_id = ?", (word_id,))
    existing = cur.fetchone()

    if existing:
        ex = dict(existing)
        recalls = ex.get("successful_recalls", 0)
        mistakes = ex.get("mistake_count", 0)
        interval = ex.get("interval_days", 1)

        if is_correct:
            recalls += 1
            if recalls == 1:
                interval = 1
            elif recalls == 2:
                interval = 3
            elif recalls == 3:
                interval = 7
            else:
                interval = min(30, interval * 2)
            next_review = (now + timedelta(days=interval)).isoformat()
            status = "mastered" if recalls >= 3 and mistakes <= recalls else "learning"
        else:
            mistakes += 1
            interval = 1
            # Schedule for immediate / short-term revision (4 hours from now)
            next_review = (now + timedelta(hours=4)).isoformat()
            status = "difficult"

        cur.execute(
            """
            UPDATE vocabulary_progress
            SET last_practiced_at = ?,
                successful_recalls = ?,
                mistake_count = ?,
                next_review_at = ?,
                interval_days = ?,
                mastery_status = ?
            WHERE word_id = ?
            """,
            (now_iso, recalls, mistakes, next_review, interval, status, word_id),
        )
    else:
        recalls = 1 if is_correct else 0
        mistakes = 0 if is_correct else 1
        interval = 1
        next_review = (now + timedelta(days=1 if is_correct else 0)).isoformat()
        status = "learning" if is_correct else "difficult"

        cur.execute(
            """
            INSERT INTO vocabulary_progress (
                word_id, language_code, topic, level, native_text,
                romanized, pronunciation_guide, meanings_json,
                example_native, example_romanized, example_meaning,
                grammar_note, last_practiced_at, successful_recalls,
                mistake_count, next_review_at, interval_days, mastery_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                word_id,
                language_code,
                item["topic"] if item else "Greetings",
                item["level"] if item else "Beginner",
                item["nativeText"] if item else "",
                item["romanized"] if item else "",
                item["pronunciationGuide"] if item else "",
                json.dumps(item["meanings"] if item else {}),
                item["exampleNative"] if item else "",
                item["exampleRomanized"] if item else "",
                item["exampleMeaning"] if item else "",
                item["grammarNote"] if item else "",
                now_iso,
                recalls,
                mistakes,
                next_review,
                interval,
                status,
            ),
        )

    conn.commit()
    cur.execute("SELECT * FROM vocabulary_progress WHERE word_id = ?", (word_id,))
    updated = dict(cur.fetchone())
    conn.close()
    return updated


def record_completed_lesson(
    language_code: str,
    duration_minutes: int,
    proficiency_level: str,
    new_words: List[str],
    recalled_words: List[str],
    mistake_words: List[str],
    conversation_turns: int,
    accuracy_score: int,
    recommended_next: str,
) -> Dict[str, Any]:
    """Save lesson completion, update language streak, total minutes, and spaced repetition."""
    ensure_language_initialized(language_code)
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    for wid in recalled_words:
        record_vocabulary_attempt(language_code, wid, True)
    for wid in mistake_words:
        record_vocabulary_attempt(language_code, wid, False)
    for wid in new_words:
        if wid not in recalled_words and wid not in mistake_words:
            record_vocabulary_attempt(language_code, wid, True)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM language_progress WHERE language_code = ?", (language_code,))
    lp = dict(cur.fetchone())

    last_date = lp.get("last_active_date", "")
    streak = lp.get("streak_days", 0)
    daily_mins = lp.get("daily_minutes_today", 0)

    if last_date == today_str:
        daily_mins += duration_minutes
        if streak == 0:
            streak = 1
    elif last_date == yesterday_str:
        streak += 1
        daily_mins = duration_minutes
    else:
        streak = 1
        daily_mins = duration_minutes

    completed_lessons = lp.get("completed_lessons", 0) + 1
    total_minutes = lp.get("total_minutes", 0) + duration_minutes

    # Auto-promote proficiency level if learner has mastered enough lessons with high accuracy
    current_level = lp.get("proficiency_level", proficiency_level)
    if completed_lessons >= 3 and accuracy_score >= 80 and current_level == "Beginner":
        current_level = "Intermediate"
    elif completed_lessons >= 7 and accuracy_score >= 85 and current_level == "Intermediate":
        current_level = "Advanced"

    cur.execute(
        """
        UPDATE language_progress
        SET completed_lessons = ?,
            total_minutes = ?,
            streak_days = ?,
            last_active_date = ?,
            daily_minutes_today = ?,
            proficiency_level = ?,
            updated_at = ?
        WHERE language_code = ?
        """,
        (
            completed_lessons,
            total_minutes,
            streak,
            today_str,
            daily_mins,
            current_level,
            now.isoformat(),
            language_code,
        ),
    )

    next_revision_date = (now + timedelta(days=1 if not mistake_words else 0, hours=6 if mistake_words else 0)).strftime(
        "%b %d, %Y"
    )
    summary_payload = {
        "newWords": new_words,
        "recalledCorrectly": recalled_words,
        "mistakesToReview": mistake_words,
        "conversationTurns": conversation_turns,
        "accuracyScore": accuracy_score,
        "recommendedNextLesson": recommended_next,
        "nextRevisionDate": next_revision_date,
        "proficiencyLevelAfter": current_level,
    }

    cur.execute(
        """
        INSERT INTO lesson_history (
            language_code, duration_minutes, proficiency_level,
            new_words_count, recalled_correctly_count, mistakes_count,
            conversation_turns, accuracy_score, summary_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            language_code,
            duration_minutes,
            current_level,
            len(new_words),
            len(recalled_words),
            len(mistake_words),
            conversation_turns,
            accuracy_score,
            json.dumps(summary_payload),
            now.isoformat(),
        ),
    )

    conn.commit()
    conn.close()
    return summary_payload


def save_conversation_session(
    language_code: str,
    scenario_id: str,
    scenario_title: str,
    proficiency_level: str,
    messages: List[Dict[str, Any]],
    corrections_count: int,
) -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()
    now_iso = datetime.now().isoformat()
    cur.execute(
        """
        INSERT INTO conversation_history (
            language_code, scenario_id, scenario_title,
            proficiency_level, messages_json, corrections_count,
            turns_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            language_code,
            scenario_id,
            scenario_title,
            proficiency_level,
            json.dumps(messages),
            corrections_count,
            len(messages),
            now_iso,
        ),
    )
    session_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": session_id, "createdAt": now_iso}


def get_recent_lessons(language_code: str, limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM lesson_history WHERE language_code = ? ORDER BY id DESC LIMIT ?",
        (language_code, limit),
    )
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["summary"] = json.loads(d.get("summary_json") or "{}")
        except Exception:
            d["summary"] = {}
        result.append(d)
    return result


def get_recent_conversations(language_code: str, limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM conversation_history WHERE language_code = ? ORDER BY id DESC LIMIT ?",
        (language_code, limit),
    )
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["messages"] = json.loads(d.get("messages_json") or "[]")
        except Exception:
            d["messages"] = []
        result.append(d)
    return result
