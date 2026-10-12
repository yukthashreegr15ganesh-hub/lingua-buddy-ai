# LINGUA BUDDY AI

**An AI-Powered Multilingual Conversational Learning Companion**

Lingua Buddy AI is a full-stack, voice-first language-learning application designed to help learners **speak and understand 25+ languages** through natural conversations with a 3D animated companion ("Buddy")—**without forcing learners to memorize scripts, alphabets, or handwriting**.

---

## Core Features

1. **Voice & Roman Pronunciation First (No Forced Script)**:
   - Default mode displays easy Roman-letter pronunciation, syllable guides, and meanings in your chosen explanation language.
   - Native scripts are optional and can be toggled on/off with one click in the top bar or in Settings.
2. **25 Supported Languages (Extensible Architecture)**:
   - **15 Indian Languages**: Tamil, Telugu, Kannada, Hindi, Sanskrit, Tulu, Konkani, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Assamese, Urdu.
   - **10 Global Languages**: English, Spanish, French, German, Japanese, Korean, Mandarin Chinese, Arabic, Italian, Portuguese.
   - Additional custom languages can be added dynamically via Settings without rebuilding the application.
3. **Instant Language Switching & Independent Explanation Language**:
   - Switch between any of the 25+ languages from the top navigation bar or dashboard while retaining 100% of each language's separate proficiency level, learned vocabulary, difficult words, completed lessons, conversation history, revision schedule, and streak.
   - Select your preferred explanation language (e.g., English, Kannada, Hindi, Tamil, Telugu, Malayalam, Marathi, Bengali, Spanish, French) independently of the language you are learning.
4. **3D Animated AI Companion (`Buddy3D`)**:
   - Built with **React Three Fiber & Three.js**, supporting all 9 states: `IDLE`, `GREETING`, `LISTENING`, `SPEAKING`, `THINKING`, `HAPPY`, `ENCOURAGING`, `CORRECTING`, and `FAREWELL`.
5. **Structured 5-Phase Lesson Engine**:
   - Dynamically scales to 10, 15, 20, 30, 45, or 60 minutes:
     1. Warm-Up & Spaced Revision (or Introductory Check)
     2. New Spoken Vocabulary (5–8 expressions)
     3. Sentence Formation & Oral Practice
     4. Real-Life Conversation Role-Play
     5. Memory & Speaking Test + End-of-Lesson Summary Report
6. **Spaced-Repetition Memory System & 15 Real-Life Scenarios**:
   - Tracks recall count, mistakes, mastery status, and next review date per word in SQLite (`backend/lingua_buddy.db`).
   - Includes 15 everyday role-play scenarios with 5-part gentle corrections and **Conversation Replay**.

---

## Running the Application

### 1. Start the FastAPI Backend (Port 8000)

```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### 2. Start the React + Vite Frontend (Port 5173)

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Optional Live Cloud AI Setup

By default, Lingua Buddy AI runs in **Built-in Multilingual Tutor Mode (Local Fallback)** so all features work immediately without requiring external paid API keys.

To connect a live cloud LLM:
1. Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY` or `OPENAI_API_KEY`, **or**
2. Open **Schedule & Settings -> Server-Side AI Integration Status** in the web app and save your API key on the server.
