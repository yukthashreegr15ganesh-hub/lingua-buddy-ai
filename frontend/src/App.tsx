import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Globe,
  Flame,
  BookOpen,
  Clock,
  Calendar,
  Bell,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Turtle,
  Mic,
  Award,
  BarChart3,
  MessageCircle,
  Brain,
  Sliders,
  PlusCircle,
  KeyRound,
  ArrowRight,
  EyeOff,
} from 'lucide-react';
import {
  BootstrapData,
  CharacterState,
  PageId,
  VocabItem,
  EvaluationResult,
} from './types';
import { TopBar } from './components/TopBar';
import { Buddy3D } from './components/Buddy3D';
import { LessonRoom } from './components/LessonRoom';
import { ConversationRoom } from './components/ConversationRoom';
import { speakPhrase, startSpeechRecognition, inspectVoiceCapabilities } from './services/speech';

export const App: React.FC = () => {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [characterState, setCharacterState] = useState<CharacterState>('IDLE');
  const [loading, setLoading] = useState(true);

  // Vocabulary Page state
  const [vocabFilter, setVocabFilter] = useState<'all' | 'learned' | 'due' | 'difficult' | 'mastered'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [practicingWord, setPracticingWord] = useState<VocabItem | null>(null);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceEval, setPracticeEval] = useState<EvaluationResult | null>(null);
  const [practiceListening, setPracticeListening] = useState(false);

  // Revision Quiz Page state
  const [quizData, setQuizData] = useState<any | null>(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizInput, setQuizInput] = useState('');
  const [quizEval, setQuizEval] = useState<EvaluationResult | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizFinished, setQuizFinished] = useState(false);

  // Onboarding Wizard state
  const [onboardForm, setOnboardForm] = useState({
    learner_name: 'Friend',
    active_language: 'ta',
    explanation_language: 'en',
    proficiency_level: 'Beginner',
    understanding_comfort: 'complete_beginner',
    learning_reason: 'Speak confidently with friends, family, and locals',
    daily_duration_minutes: 30,
    preferred_time: '19:00',
    show_native_script: false,
  });

  // Settings & AI Config state
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [inAppReminderToast, setInAppReminderToast] = useState<string | null>(null);
  const [apiKeyForm, setApiKeyForm] = useState({ provider: 'gemini', api_key: '', model: '' });
  const [customLangForm, setCustomLangForm] = useState({
    code: '',
    name: '',
    native_name: '',
    bcp47: 'en-IN',
    cultural_note: '',
  });
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  const fetchBootstrap = async () => {
    try {
      const res = await fetch('/api/bootstrap');
      const data: BootstrapData = await res.json();
      setBootstrap(data);
      setOnboardForm({
        learner_name: data.profile.learner_name || 'Friend',
        active_language: data.profile.active_language,
        explanation_language: data.profile.explanation_language,
        proficiency_level: data.activeLanguage.progress.proficiencyLevel,
        understanding_comfort: data.activeLanguage.progress.understandingComfort || 'complete_beginner',
        learning_reason: data.profile.learning_reason,
        daily_duration_minutes: data.profile.daily_duration_minutes,
        preferred_time: data.profile.preferred_time,
        show_native_script: data.profile.show_native_script,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBootstrap();
  }, []);

  // Load quiz data when navigating to Revision Quiz page or switching languages
  useEffect(() => {
    if (activePage === 'quiz' && bootstrap) {
      fetch(
        `/api/quiz/${encodeURIComponent(
          bootstrap.activeLanguage.code
        )}?explanation_language=${encodeURIComponent(bootstrap.profile.explanation_language)}`
      )
        .then((r) => r.json())
        .then((d) => {
          setQuizData(d);
          setQuizIdx(0);
          setQuizEval(null);
          setQuizInput('');
          setQuizScore({ correct: 0, total: 0 });
          setQuizFinished(false);
        });
    }
  }, [activePage, bootstrap?.activeLanguage.code, bootstrap?.profile.explanation_language]);

  // Check scheduled lesson reminder once per minute while app is open
  useEffect(() => {
    if (!bootstrap?.profile.reminder_enabled) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm === bootstrap.profile.preferred_time) {
        const msg = `Time for your ${bootstrap.profile.daily_duration_minutes}-minute ${bootstrap.activeLanguage.name} speaking session with Buddy!`;
        setInAppReminderToast(msg);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Lingua Buddy AI Reminder', { body: msg });
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [bootstrap?.profile.reminder_enabled, bootstrap?.profile.preferred_time, bootstrap?.activeLanguage.name]);

  const handleSwitchLanguage = async (langCode: string) => {
    setCharacterState('GREETING');
    const res = await fetch('/api/languages/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language_code: langCode }),
    });
    const data: BootstrapData = await res.json();
    setBootstrap(data);
    setTimeout(() => setCharacterState('IDLE'), 1800);
  };

  const handleUpdateProfileField = async (updates: Record<string, any>) => {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data: BootstrapData = await res.json();
    setBootstrap(data);
    return data;
  };

  const handleRequestBrowserNotification = async () => {
    if (typeof Notification === 'undefined') {
      setNotifPermission('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted' && bootstrap) {
      new Notification('Lingua Buddy AI Reminders Active!', {
        body: `We will remind you at ${bootstrap.profile.preferred_time} for your ${bootstrap.activeLanguage.name} lesson when the browser is open.`,
      });
    }
  };

  if (loading || !bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50/50 p-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center mx-auto font-extrabold text-xl shadow-md animate-bounce">
            LB
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Loading Lingua Buddy AI...</h1>
          <p className="text-xs text-slate-500">Initializing 25 languages & 3D AI companion</p>
        </div>
      </div>
    );
  }

  const { profile, activeLanguage, languages, explanationLanguages, scenarios, vocabulary, aiStatus } =
    bootstrap;
  const voiceCap = inspectVoiceCapabilities(activeLanguage.bcp47, activeLanguage.speechSupportLevel);

  // Filtered vocabulary for Vocabulary Collection page
  const filteredVocabulary = vocabulary.filter((v) => {
    if (selectedTopic !== 'All Topics' && v.topic !== selectedTopic) return false;
    if (vocabFilter === 'learned') return v.isLearned;
    if (vocabFilter === 'due') return v.isDue || v.masteryStatus === 'review_due';
    if (vocabFilter === 'difficult') return v.masteryStatus === 'difficult' || v.mistakeCount > 0;
    if (vocabFilter === 'mastered') return v.masteryStatus === 'mastered';
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50/50 via-orange-50/20 to-slate-50 text-slate-900">
      {/* Top Navigation & Instant Language Switcher */}
      <TopBar
        activePage={activePage}
        onNavigate={setActivePage}
        activeLanguage={activeLanguage}
        languages={languages}
        explanationLanguages={explanationLanguages}
        profile={profile}
        onSwitchLanguage={handleSwitchLanguage}
        onChangeExplanationLanguage={(expCode) =>
          handleUpdateProfileField({ explanation_language: expCode })
        }
        onToggleNativeScript={() =>
          handleUpdateProfileField({ show_native_script: !profile.show_native_script })
        }
      />

      {/* In-App Scheduled Lesson Reminder Banner */}
      {inAppReminderToast && (
        <div className="bg-orange-600 text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between max-w-7xl mx-auto w-full mt-2 rounded-2xl shadow-md">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>{inAppReminderToast}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInAppReminderToast(null);
                setActivePage('lesson');
              }}
              className="px-3 py-1 rounded-xl bg-white text-orange-700 font-extrabold text-xs"
            >
              Start Lesson
            </button>
            <button
              type="button"
              onClick={() => setInAppReminderToast(null)}
              className="opacity-80 hover:opacity-100 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* =========================================================
            PAGE A: WELCOME PAGE
           ========================================================= */}
        {activePage === 'welcome' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 text-orange-800 text-xs font-extrabold">
                <Sparkles className="w-4 h-4" />
                <span>Speak & Listen First • No Forced Script or Alphabet Memorization</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight">
                Learn to <span className="text-orange-600">Speak 25+ Languages</span> Naturally with Your Personal 3D AI Friend.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Lingua Buddy AI helps you speak Tamil, Telugu, Kannada, Hindi, Sanskrit, Tulu, Konkani, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Assamese, Urdu, and 10 global languages through real conversations, easy Roman pronunciation, and spaced revision.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePage('onboarding')}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm shadow-md flex items-center gap-2 transition"
                >
                  <span>GET STARTED (Personalize Tutor)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage('dashboard')}
                  className="px-6 py-3.5 rounded-2xl bg-white hover:bg-amber-50 text-slate-800 border border-amber-200 font-extrabold text-sm shadow-sm transition"
                >
                  SIGN IN / GO TO DASHBOARD
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <Buddy3D
                state="GREETING"
                languageName={activeLanguage.name}
                speechBubble={`Vanakkam / Namaskaara! Ready to speak ${activeLanguage.name} together without worrying about alphabets?`}
                subText="Click 'Get Started' to customize your daily schedule and explanation language."
                onSelectState={setCharacterState}
              />
            </div>
          </div>
        )}

        {/* =========================================================
            PAGE B: ONBOARDING WIZARD (Section 6)
           ========================================================= */}
        {activePage === 'onboarding' && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-6">
            <div className="border-b border-amber-100 pb-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                Personalize Your AI Language Coach
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
                Customize Your Daily Speaking Journey
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Answer these quick questions so Buddy adapts every lesson to your ability, explanation language, and schedule.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  1. Which language do you want to learn first?
                </label>
                <select
                  value={onboardForm.active_language}
                  onChange={(e) => setOnboardForm({ ...onboardForm, active_language: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name} ({l.nativeName}) — {l.region}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  2. What language should the tutor use for explanations?
                </label>
                <select
                  value={onboardForm.explanation_language}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, explanation_language: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                >
                  {explanationLanguages.map((el) => (
                    <option key={el.code} value={el.code}>
                      {el.name} ({el.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  3. How would you describe your current ability in this language?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      level: 'Beginner',
                      comfort: 'complete_beginner',
                      title: 'Complete Beginner',
                      desc: 'Teach basic words, greetings, simple questions & short sentences.',
                    },
                    {
                      level: 'Intermediate',
                      comfort: 'understand_struggle_speak',
                      title: 'Understand Some, Struggle to Speak',
                      desc: 'Teach longer sentences, common expressions & practical dialogues.',
                    },
                    {
                      level: 'Advanced',
                      comfort: 'hold_basic_conversations',
                      title: 'Can Hold Basic Conversations',
                      desc: 'Teach nuanced expressions, natural flow & workplace/cultural usage.',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.level}
                      type="button"
                      onClick={() =>
                        setOnboardForm({
                          ...onboardForm,
                          proficiency_level: opt.level,
                          understanding_comfort: opt.comfort,
                        })
                      }
                      className={`p-3.5 rounded-2xl border text-left transition ${
                        onboardForm.proficiency_level === opt.level
                          ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/40'
                          : 'bg-white border-slate-200 hover:bg-amber-50/40'
                      }`}
                    >
                      <div className="font-extrabold text-xs text-slate-900">{opt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  4. Why do you want to learn this language?
                </label>
                <input
                  type="text"
                  value={onboardForm.learning_reason}
                  onChange={(e) => setOnboardForm({ ...onboardForm, learning_reason: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  5. Your Name (How Buddy greets you)
                </label>
                <input
                  type="text"
                  value={onboardForm.learner_name}
                  onChange={(e) => setOnboardForm({ ...onboardForm, learner_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  6. How many minutes can you practice each day?
                </label>
                <select
                  value={onboardForm.daily_duration_minutes}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, daily_duration_minutes: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                >
                  {[10, 15, 20, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes per day
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  7. At what time would you prefer to practice?
                </label>
                <input
                  type="time"
                  value={onboardForm.preferred_time}
                  onChange={(e) => setOnboardForm({ ...onboardForm, preferred_time: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
              <div>
                <div className="font-extrabold text-xs text-emerald-950">
                  8. Audio & Roman Pronunciation First (No Forced Writing)
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  By default, native scripts are hidden so you can focus 100% on speaking and listening.
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={onboardForm.show_native_script}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, show_native_script: e.target.checked })
                  }
                  className="rounded text-orange-600"
                />
                Show Optional Script
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Skip to Dashboard
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleUpdateProfileField({
                    ...onboardForm,
                    onboarding_completed: true,
                  });
                  setActivePage('lesson');
                }}
                className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm shadow-sm"
              >
                Save Preferences & Start First Lesson
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            PAGE C: MAIN DASHBOARD (Section 14.C)
           ========================================================= */}
        {activePage === 'dashboard' && (
          <div className="space-y-6">
            {/* Hero Banner with 3D Character + START LESSON CTA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-5">
                <Buddy3D
                  state={characterState}
                  languageName={activeLanguage.name}
                  speechBubble={`Hello ${profile.learner_name}! Ready for your ${profile.daily_duration_minutes}-minute spoken ${activeLanguage.name} lesson?`}
                  subText={`Explaining in ${
                    explanationLanguages.find((e) => e.code === profile.explanation_language)?.name ||
                    'English'
                  } • Word Order: ${activeLanguage.wordOrder}`}
                  onSelectState={setCharacterState}
                  onSpeakGreeting={() => {
                    const first = vocabulary[0];
                    if (first) {
                      speakPhrase({
                        nativeText: first.nativeText,
                        romanizedText: first.romanized,
                        bcp47: activeLanguage.bcp47,
                        speed: profile.speaking_speed,
                        speechSupportLevel: activeLanguage.speechSupportLevel,
                        onStart: () => setCharacterState('SPEAKING'),
                        onEnd: () => setCharacterState('IDLE'),
                      });
                    }
                  }}
                />
              </div>

              <div className="lg:col-span-7 flex flex-col justify-between bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/90 shadow-sm space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800">
                      Active Journey: {activeLanguage.name}{' '}
                      {profile.show_native_script && `(${activeLanguage.nativeName})`} •{' '}
                      {activeLanguage.progress.proficiencyLevel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePage('onboarding')}
                      className="text-xs font-bold text-orange-600 hover:underline"
                    >
                      Customize Tutor Preferences
                    </button>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Speak {activeLanguage.name} Confidently — One Conversation at a Time.
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeLanguage.culturalNote}
                  </p>

                  {/* Today's Daily Goal Progress Bar */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">
                        Today's Speaking Goal ({activeLanguage.name})
                      </span>
                      <span className="text-orange-700">
                        {activeLanguage.progress.dailyMinutesToday} / {profile.daily_duration_minutes} mins
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-amber-200/70 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (activeLanguage.progress.dailyMinutesToday /
                                Math.max(1, profile.daily_duration_minutes)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/70">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Daily Streak
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {activeLanguage.progress.streakDays} Days
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                      Vocab Learned
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {activeLanguage.progress.wordsLearned} / {activeLanguage.curriculumCount}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/70">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5 text-indigo-600" />
                      Due Revision
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {activeLanguage.progress.dueForReview + activeLanguage.progress.difficultWords}{' '}
                      Items
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Next Session
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {profile.preferred_time}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActivePage('lesson')}
                    data-testid="start-lesson-btn"
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-base shadow-md transition"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>
                      START {profile.daily_duration_minutes}-MIN {activeLanguage.name.toUpperCase()} LESSON
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePage('conversation')}
                    className="px-5 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center gap-2 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Practice 15 Scenarios</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Multi-Language Switcher Strip (Highlight Language Switching - Section 3) */}
            <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-orange-600" />
                    Instant Multi-Language Switcher (25 Supported Languages)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Switch anytime—your vocabulary, streak, and lesson history are saved separately for every language.
                  </p>
                </div>
                <span className="text-xs font-bold text-orange-700">
                  Explanations in:{' '}
                  {explanationLanguages.find((e) => e.code === profile.explanation_language)?.name}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                {languages.map((lang) => {
                  const isCurrent = lang.code === activeLanguage.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSwitchLanguage(lang.code)}
                      className={`px-3.5 py-2 rounded-2xl border text-left shrink-0 transition ${
                        isCurrent
                          ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                          : 'bg-amber-50/50 hover:bg-amber-100/70 border-amber-200/80 text-slate-800'
                      }`}
                    >
                      <div className="font-extrabold text-xs flex items-center gap-1.5">
                        <span>{lang.name}</span>
                        {lang.progress.wordsLearned > 0 && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                              isCurrent ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {lang.progress.wordsLearned}w
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] ${
                          isCurrent ? 'text-orange-100' : 'text-slate-500'
                        }`}
                      >
                        {lang.progress.proficiencyLevel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Row: Upcoming Revision, Previous Lesson Summary & Daily Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Upcoming Spaced Revision */}
              <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Spaced-Repetition Queue
                    </h3>
                    <Brain className="w-5 h-5 text-indigo-600" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Phrases prioritized for recall in {activeLanguage.name}:
                  </p>
                  <div className="mt-3 space-y-2">
                    {vocabulary.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-extrabold text-xs text-slate-900">
                            {item.romanized}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.meaning}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            speakPhrase({
                              nativeText: item.nativeText,
                              romanizedText: item.romanized,
                              bcp47: activeLanguage.bcp47,
                              speed: profile.speaking_speed,
                              speechSupportLevel: activeLanguage.speechSupportLevel,
                              onStart: () => setCharacterState('SPEAKING'),
                              onEnd: () => setCharacterState('IDLE'),
                            })
                          }
                          className="p-2 rounded-xl bg-orange-100 text-orange-700 hover:bg-orange-200"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('quiz')}
                  className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition"
                >
                  Take {activeLanguage.name} Revision Quiz
                </button>
              </div>

              {/* 2. Previous Lesson Summary */}
              <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Previous Lesson Summary
                    </h3>
                    <Award className="w-5 h-5 text-emerald-600" />
                  </div>
                  {bootstrap.recentLessons.length > 0 ? (
                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                        <div className="font-extrabold text-emerald-950">
                          {bootstrap.recentLessons[0].duration_minutes}-Minute{' '}
                          {activeLanguage.name} Session
                        </div>
                        <div className="text-emerald-800 mt-0.5">
                          Recall Score: {bootstrap.recentLessons[0].accuracy_score}% •{' '}
                          {bootstrap.recentLessons[0].new_words_count} new phrases
                        </div>
                      </div>
                      <p className="text-slate-600">
                        <strong>Recommended Next:</strong>{' '}
                        {bootstrap.recentLessons[0].summary?.recommendedNextLesson ||
                          'Everyday Sentence Practice'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 text-xs text-slate-600">
                      You haven't completed a {activeLanguage.name} lesson yet. Click{' '}
                      <strong>START LESSON</strong> above to begin your first guided speaking session!
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('progress')}
                  className="w-full py-2.5 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs transition"
                >
                  View Full Learning History
                </button>
              </div>

              {/* 3. Daily Learning Schedule Card */}
              <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Daily Learning Schedule
                    </h3>
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Preferred Time:</span>
                      <span className="font-extrabold text-slate-900">{profile.preferred_time}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Lesson Duration:</span>
                      <span className="font-extrabold text-orange-700">
                        {profile.daily_duration_minutes} Minutes
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Scheduled Days:</span>
                      <span className="font-bold text-slate-800">
                        {profile.scheduled_days.join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">Reminders:</span>
                      <span className="font-bold text-emerald-700">
                        {profile.reminder_enabled ? 'In-App Active' : 'Paused'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('settings')}
                  className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  Edit Schedule & Duration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            PAGE D: AI LEARNING ROOM (Section 8)
           ========================================================= */}
        {activePage === 'lesson' && (
          <LessonRoom
            activeLanguage={activeLanguage}
            profile={profile}
            characterState={characterState}
            setCharacterState={setCharacterState}
            onLessonCompleted={(updatedBootstrap) => setBootstrap(updatedBootstrap)}
            onChangeDuration={(mins) => handleUpdateProfileField({ daily_duration_minutes: mins })}
          />
        )}

        {/* =========================================================
            PAGE E: REAL-LIFE CONVERSATION PRACTICE (Section 10)
           ========================================================= */}
        {activePage === 'conversation' && (
          <ConversationRoom
            scenarios={scenarios}
            activeLanguage={activeLanguage}
            profile={profile}
            aiStatus={aiStatus}
            recentConversations={bootstrap.recentConversations}
            characterState={characterState}
            setCharacterState={setCharacterState}
            onConversationsUpdated={(newList) =>
              setBootstrap({ ...bootstrap, recentConversations: newList })
            }
          />
        )}

        {/* =========================================================
            PAGE F: VOCABULARY COLLECTION & 17 TOPICS (Sections 9 & 11)
           ========================================================= */}
        {activePage === 'vocabulary' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                  Spaced-Repetition Memory Bank • {activeLanguage.name}
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {activeLanguage.name} Spoken Vocabulary Collection
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every phrase prioritizes Roman pronunciation and spoken examples. Tap any card to listen or practice speaking aloud.
                </p>
              </div>

              {/* Mastery Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: `All (${vocabulary.length})` },
                  {
                    id: 'learned',
                    label: `Learned (${vocabulary.filter((v) => v.isLearned).length})`,
                  },
                  {
                    id: 'due',
                    label: `Due Review (${vocabulary.filter((v) => v.isDue).length})`,
                  },
                  {
                    id: 'difficult',
                    label: `Difficult (${
                      vocabulary.filter((v) => v.masteryStatus === 'difficult' || v.mistakeCount > 0)
                        .length
                    })`,
                  },
                  {
                    id: 'mastered',
                    label: `Mastered (${
                      vocabulary.filter((v) => v.masteryStatus === 'mastered').length
                    })`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setVocabFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      vocabFilter === tab.id
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-amber-50 hover:bg-amber-100 text-slate-700 border border-amber-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 17 Topics Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {['All Topics', ...bootstrap.topics].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedTopic === topic
                      ? 'bg-slate-900 text-white'
                      : 'bg-white hover:bg-amber-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Interactive Speaking Practice Modal/Drawer for Selected Word */}
            {practicingWord && (
              <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-white rounded-3xl p-5 border-2 border-orange-400 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-orange-700">
                      Interactive Speaking Practice • {practicingWord.topic}
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Say "{practicingWord.romanized}" ([{practicingWord.pronunciationGuide}])
                    </h3>
                    <p className="text-xs text-slate-600">Meaning: {practicingWord.meaning}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPracticingWord(null);
                      setPracticeEval(null);
                      setPracticeInput('');
                    }}
                    className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      speakPhrase({
                        nativeText: practicingWord.nativeText,
                        romanizedText: practicingWord.romanized,
                        bcp47: activeLanguage.bcp47,
                        speed: profile.speaking_speed,
                        speechSupportLevel: activeLanguage.speechSupportLevel,
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Volume2 className="w-4 h-4" />
                    Hear Phrase
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPracticeListening(true);
                      startSpeechRecognition({
                        bcp47: activeLanguage.bcp47,
                        preferRomanFallback: true,
                        onInterim: (t) => setPracticeInput(t),
                        onFinal: async (finalText) => {
                          setPracticeInput(finalText);
                          setPracticeListening(false);
                          const res = await fetch('/api/lesson/evaluate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              language_code: activeLanguage.code,
                              explanation_language: profile.explanation_language,
                              word_id: practicingWord.id,
                              user_transcript: finalText,
                              target_romanized: practicingWord.romanized,
                              target_native: practicingWord.nativeText,
                              pronunciation_guide: practicingWord.pronunciationGuide,
                              target_meaning: practicingWord.meaning,
                              record_progress: true,
                            }),
                          });
                          const ev = await res.json();
                          setPracticeEval(ev);
                          fetchBootstrap();
                        },
                        onError: () => setPracticeListening(false),
                        onEnd: () => setPracticeListening(false),
                      });
                    }}
                    className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 ${
                      practiceListening ? 'bg-red-600 animate-pulse' : 'bg-emerald-600'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    {practiceListening ? 'Listening...' : 'Speak with Mic'}
                  </button>

                  <input
                    type="text"
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    placeholder={`Or type "${practicingWord.romanized}"...`}
                    className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />

                  <button
                    type="button"
                    onClick={async () => {
                      if (!practiceInput.trim()) return;
                      const res = await fetch('/api/lesson/evaluate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          language_code: activeLanguage.code,
                          explanation_language: profile.explanation_language,
                          word_id: practicingWord.id,
                          user_transcript: practiceInput,
                          target_romanized: practicingWord.romanized,
                          target_native: practicingWord.nativeText,
                          pronunciation_guide: practicingWord.pronunciationGuide,
                          target_meaning: practicingWord.meaning,
                          record_progress: true,
                        }),
                      });
                      const ev = await res.json();
                      setPracticeEval(ev);
                      fetchBootstrap();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    Check Pronunciation
                  </button>
                </div>

                {practiceEval && (
                  <div className="p-3.5 rounded-2xl bg-white border border-amber-200 text-xs flex items-center justify-between">
                    <span className="font-bold text-slate-800">{practiceEval.feedback}</span>
                    <span className="font-extrabold text-orange-700">
                      Match: {practiceEval.similarityScore}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Vocabulary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVocabulary.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold">
                        {item.topic} • {item.level}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          item.masteryStatus === 'mastered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.masteryStatus === 'difficult'
                            ? 'bg-rose-100 text-rose-800'
                            : item.masteryStatus === 'learning'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.masteryStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xl font-extrabold text-slate-900">{item.romanized}</div>
                    <div className="text-xs font-semibold text-orange-700">
                      Pronunciation: [{item.pronunciationGuide}]
                    </div>

                    {profile.show_native_script && (
                      <div className="text-sm font-bold text-slate-700">{item.nativeText}</div>
                    )}

                    <div className="text-sm font-bold text-slate-800 pt-1">
                      Meaning: {item.meaning}
                    </div>

                    <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs space-y-1">
                      <div className="font-bold text-slate-800">
                        Example: "{item.exampleRomanized}"
                      </div>
                      <div className="text-slate-500">{item.exampleMeaning}</div>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Recalls: {item.successfulRecalls}</span>
                      <span>Mistakes: {item.mistakeCount}</span>
                      <span>
                        {item.nextReviewAt
                          ? `Next: ${new Date(item.nextReviewAt).toLocaleDateString()}`
                          : 'Not practiced yet'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          speakPhrase({
                            nativeText: item.nativeText,
                            romanizedText: item.romanized,
                            bcp47: activeLanguage.bcp47,
                            speed: profile.speaking_speed,
                            speechSupportLevel: activeLanguage.speechSupportLevel,
                          })
                        }
                        className="flex-1 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold text-xs flex items-center justify-center gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Listen
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          speakPhrase({
                            nativeText: item.nativeText,
                            romanizedText: item.romanized,
                            bcp47: activeLanguage.bcp47,
                            speed: 0.65,
                            speechSupportLevel: activeLanguage.speechSupportLevel,
                          })
                        }
                        className="px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs"
                        title="Slow audio"
                      >
                        <Turtle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPracticingWord(item);
                          setPracticeEval(null);
                          setPracticeInput('');
                        }}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Practice
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            PAGE G: REVISION QUIZ (Section 9 & 14.G)
           ========================================================= */}
        {activePage === 'quiz' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                  Spaced-Repetition Assessment • {activeLanguage.name}
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {activeLanguage.name} Memory & Speaking Revision Quiz
                </h1>
                <p className="text-xs text-slate-500">
                  Prioritizes difficult phrases and due vocabulary from your {activeLanguage.name} learning history.
                </p>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs font-extrabold text-indigo-900">
                Score: {quizScore.correct} / {quizScore.total}
              </div>
            </div>

            {quizData && quizData.questions && quizData.questions.length > 0 && !quizFinished ? (
              (() => {
                const q = quizData.questions[quizIdx];
                return (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>
                        Question {quizIdx + 1} of {quizData.questions.length} ({q.topic})
                      </span>
                      <span className="uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900">
                        Mode: {q.mode}
                      </span>
                    </div>

                    <div className="p-5 rounded-3xl bg-amber-50/60 border border-amber-200 space-y-3">
                      <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                        {q.mode === 'speaking'
                          ? `How do you say "${q.meaning}" aloud in ${activeLanguage.name}?`
                          : q.mode === 'listening'
                          ? `Listen to the phrase and choose or say its meaning:`
                          : q.mode === 'sentence'
                          ? `Speak or complete the natural sentence: "${q.exampleRomanized}"`
                          : `What is the meaning of "${q.romanized}" ([${q.pronunciationGuide}])?`}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            speakPhrase({
                              nativeText: q.nativeText,
                              romanizedText: q.romanized,
                              bcp47: activeLanguage.bcp47,
                              speed: profile.speaking_speed,
                              speechSupportLevel: activeLanguage.speechSupportLevel,
                            })
                          }
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Volume2 className="w-4 h-4" />
                          Play Audio Hint
                        </button>
                      </div>
                    </div>

                    {/* Multiple Choice Options for Listening / Meaning Modes */}
                    {(q.mode === 'listening' || q.mode === 'meaning') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            disabled={Boolean(quizEval)}
                            onClick={async () => {
                              const isRight = opt === q.meaning;
                              await fetch('/api/lesson/evaluate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  language_code: activeLanguage.code,
                                  explanation_language: profile.explanation_language,
                                  word_id: q.wordId,
                                  user_transcript: isRight ? q.romanized : opt,
                                  target_romanized: q.romanized,
                                  target_native: q.nativeText,
                                  pronunciation_guide: q.pronunciationGuide,
                                  target_meaning: q.meaning,
                                  record_progress: true,
                                }),
                              });
                              setQuizEval({
                                isCorrect: isRight,
                                similarityScore: isRight ? 100 : 25,
                                evaluationMethod: 'Spaced Repetition Quiz',
                                characterState: isRight ? 'HAPPY' : 'CORRECTING',
                                userSaid: opt,
                                targetRomanized: q.romanized,
                                targetNative: q.nativeText,
                                pronunciationGuide: q.pronunciationGuide,
                                targetMeaning: q.meaning,
                                matchedWords: [],
                                missedWords: [],
                                feedback: isRight
                                  ? `Correct! "${q.romanized}" means "${q.meaning}".`
                                  : `Good try! "${q.romanized}" ([${q.pronunciationGuide}]) means "${q.meaning}".`,
                              });
                              setQuizScore((s) => ({
                                correct: s.correct + (isRight ? 1 : 0),
                                total: s.total + 1,
                              }));
                              fetchBootstrap();
                            }}
                            className="p-4 rounded-2xl bg-slate-50 hover:bg-orange-50 border border-slate-200 text-left font-bold text-sm text-slate-800 transition"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Voice & Text Input for Speaking / Sentence Modes */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          startSpeechRecognition({
                            bcp47: activeLanguage.bcp47,
                            preferRomanFallback: true,
                            onInterim: (t) => setQuizInput(t),
                            onFinal: async (finalText) => {
                              setQuizInput(finalText);
                              const res = await fetch('/api/lesson/evaluate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  language_code: activeLanguage.code,
                                  explanation_language: profile.explanation_language,
                                  word_id: q.wordId,
                                  user_transcript: finalText,
                                  target_romanized: q.romanized,
                                  target_native: q.nativeText,
                                  pronunciation_guide: q.pronunciationGuide,
                                  target_meaning: q.meaning,
                                  record_progress: true,
                                }),
                              });
                              const ev: EvaluationResult = await res.json();
                              setQuizEval(ev);
                              setQuizScore((s) => ({
                                correct: s.correct + (ev.isCorrect ? 1 : 0),
                                total: s.total + 1,
                              }));
                              fetchBootstrap();
                            },
                            onError: () => {},
                          });
                        }}
                        className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Speak Answer</span>
                      </button>

                      <input
                        type="text"
                        value={quizInput}
                        onChange={(e) => setQuizInput(e.target.value)}
                        placeholder={`Type Roman pronunciation (e.g. "${q.romanized}")...`}
                        className="flex-1 px-4 py-3 rounded-2xl border border-slate-300 text-sm"
                      />

                      <button
                        type="button"
                        onClick={async () => {
                          if (!quizInput.trim()) return;
                          const res = await fetch('/api/lesson/evaluate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              language_code: activeLanguage.code,
                              explanation_language: profile.explanation_language,
                              word_id: q.wordId,
                              user_transcript: quizInput,
                              target_romanized: q.romanized,
                              target_native: q.nativeText,
                              pronunciation_guide: q.pronunciationGuide,
                              target_meaning: q.meaning,
                              record_progress: true,
                            }),
                          });
                          const ev: EvaluationResult = await res.json();
                          setQuizEval(ev);
                          setQuizScore((s) => ({
                            correct: s.correct + (ev.isCorrect ? 1 : 0),
                            total: s.total + 1,
                          }));
                          fetchBootstrap();
                        }}
                        className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs sm:text-sm"
                      >
                        Submit Answer
                      </button>
                    </div>

                    {quizEval && (
                      <div
                        className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                          quizEval.isCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                            : 'bg-amber-50 border-amber-200 text-amber-950'
                        }`}
                      >
                        <div className="text-sm font-bold">{quizEval.feedback}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setQuizEval(null);
                            setQuizInput('');
                            if (quizIdx < quizData.questions.length - 1) {
                              setQuizIdx(quizIdx + 1);
                            } else {
                              setQuizFinished(true);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-xs"
                        >
                          {quizIdx < quizData.questions.length - 1
                            ? 'Next Question'
                            : 'Finish Revision Quiz'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-emerald-200 text-center space-y-4">
                <Award className="w-12 h-12 text-emerald-600 mx-auto" />
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Revision Quiz Complete!
                </h2>
                <p className="text-sm text-slate-600">
                  You scored <strong>{quizScore.correct}</strong> out of{' '}
                  <strong>{quizScore.total}</strong>. Your spaced-repetition review intervals for{' '}
                  {activeLanguage.name} have been updated!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuizIdx(0);
                    setQuizFinished(false);
                    setQuizScore({ correct: 0, total: 0 });
                  }}
                  className="px-6 py-3 rounded-2xl bg-orange-600 text-white font-bold text-sm"
                >
                  Practice Another Round
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            PAGE H: PROGRESS PAGE (Section 14.H)
           ========================================================= */}
        {activePage === 'progress' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                Multi-Language Analytics & Retention
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                Your Speaking Progress Across Languages
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Every language tracks its own proficiency, completed lessons, minutes spoken, vocabulary mastery, and streaks.
              </p>
            </div>

            {/* Active Language Detailed Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
                <div className="text-xs font-bold text-slate-500">
                  {activeLanguage.name} Lessons Completed
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-1">
                  {activeLanguage.progress.completedLessons}
                </div>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
                <div className="text-xs font-bold text-slate-500">Total Speaking Time</div>
                <div className="text-3xl font-extrabold text-orange-600 mt-1">
                  {activeLanguage.progress.totalMinutes} mins
                </div>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
                <div className="text-xs font-bold text-slate-500">Phrases Mastered</div>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                  {activeLanguage.progress.wordsMastered} / {activeLanguage.curriculumCount}
                </div>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
                <div className="text-xs font-bold text-slate-500">Current Streak</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">
                  🔥 {activeLanguage.progress.streakDays} Days
                </div>
              </div>
            </div>

            {/* All Languages Progress Comparison Table */}
            <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900">
                Separate Learning Journey for All 25+ Languages
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-amber-200 text-slate-500 text-xs uppercase">
                      <th className="py-2.5 px-3">Language</th>
                      <th className="py-2.5 px-3">Level</th>
                      <th className="py-2.5 px-3">Lessons</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Words Learned</th>
                      <th className="py-2.5 px-3">Mastered</th>
                      <th className="py-2.5 px-3">Streak</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {languages.map((l) => (
                      <tr
                        key={l.code}
                        className={
                          l.code === activeLanguage.code ? 'bg-orange-50/70 font-semibold' : ''
                        }
                      >
                        <td className="py-3 px-3 font-extrabold text-slate-900">
                          {l.name}{' '}
                          {profile.show_native_script && (
                            <span className="text-xs font-normal text-slate-500">
                              ({l.nativeName})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">{l.progress.proficiencyLevel}</td>
                        <td className="py-3 px-3">{l.progress.completedLessons}</td>
                        <td className="py-3 px-3">{l.progress.totalMinutes}m</td>
                        <td className="py-3 px-3">{l.progress.wordsLearned}</td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">
                          {l.progress.wordsMastered}
                        </td>
                        <td className="py-3 px-3">🔥 {l.progress.streakDays}d</td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleSwitchLanguage(l.code)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold ${
                              l.code === activeLanguage.code
                                ? 'bg-orange-600 text-white'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                            }`}
                          >
                            {l.code === activeLanguage.code ? 'Active' : 'Resume'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            PAGE I: SETTINGS & DAILY SCHEDULER (Sections 7, 12, 14.I)
           ========================================================= */}
        {activePage === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-6">
              <div className="border-b border-amber-100 pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                    Persistent Configuration
                  </span>
                  <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                    Daily Learning Schedule, Voice & Language Settings
                  </h1>
                </div>
                {settingsSavedMsg && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                    {settingsSavedMsg}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Learning Language */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Active Learning Language
                  </label>
                  <select
                    value={profile.active_language}
                    onChange={(e) => handleSwitchLanguage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Explanation Language */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Preferred Explanation Language
                  </label>
                  <select
                    value={profile.explanation_language}
                    onChange={async (e) => {
                      await handleUpdateProfileField({ explanation_language: e.target.value });
                      setSettingsSavedMsg('Explanation language saved!');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                  >
                    {explanationLanguages.map((el) => (
                      <option key={el.code} value={el.code}>
                        {el.name} ({el.nativeName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proficiency Level */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {activeLanguage.name} Proficiency Level
                  </label>
                  <select
                    value={activeLanguage.progress.proficiencyLevel}
                    onChange={async (e) => {
                      await handleUpdateProfileField({ proficiency_level: e.target.value });
                      setSettingsSavedMsg('Proficiency level updated!');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                  >
                    <option value="Beginner">Beginner (Words, greetings & short sentences)</option>
                    <option value="Intermediate">Intermediate (Longer sentences & dialogues)</option>
                    <option value="Advanced">Advanced (Nuanced & workplace conversations)</option>
                  </select>
                </div>

                {/* Lesson Duration */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Daily Lesson Duration Goal
                  </label>
                  <select
                    value={profile.daily_duration_minutes}
                    onChange={async (e) => {
                      await handleUpdateProfileField({
                        daily_duration_minutes: Number(e.target.value),
                      });
                      setSettingsSavedMsg('Lesson duration saved!');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                  >
                    {[10, 15, 20, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preferred Daily Practice Time */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Preferred Daily Practice Time
                  </label>
                  <input
                    type="time"
                    value={profile.preferred_time}
                    onChange={async (e) => {
                      await handleUpdateProfileField({ preferred_time: e.target.value });
                      setSettingsSavedMsg('Schedule time saved!');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>

                {/* Adjustable Speaking Speed */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    AI Tutor Speaking Speed ({profile.speaking_speed}x)
                  </label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.25"
                    step="0.05"
                    value={profile.speaking_speed}
                    onChange={(e) =>
                      handleUpdateProfileField({ speaking_speed: parseFloat(e.target.value) })
                    }
                    className="w-full accent-orange-600 mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>0.6x (Slow)</span>
                    <span>0.95x (Natural)</span>
                    <span>1.25x (Fast)</span>
                  </div>
                </div>
              </div>

              {/* Days of the Week Selector */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  Scheduled Practice Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const selected = profile.scheduled_days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const nextDays = selected
                            ? profile.scheduled_days.filter((d) => d !== day)
                            : [...profile.scheduled_days, day];
                          handleUpdateProfileField({
                            scheduled_days: nextDays.length > 0 ? nextDays : ['Mon'],
                          });
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                          selected
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Script Visibility & Browser Notifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                    <EyeOff className="w-4 h-4 text-emerald-700" />
                    No Forced Writing / Script Visibility
                  </div>
                  <p className="text-xs text-slate-600">
                    Keep native scripts hidden to learn purely through spoken audio and Roman letters, or display them optionally.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateProfileField({
                        show_native_script: !profile.show_native_script,
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold"
                  >
                    {profile.show_native_script
                      ? 'Currently Showing Optional Script (Click to Hide)'
                      : 'Currently Roman Pronunciation Only (Click to Show Script)'}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-orange-600" />
                    Reminders & Browser Notifications
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Honesty Notice: Browser notifications require browser permission and require this web app tab to remain open.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRequestBrowserNotification}
                      className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold"
                    >
                      {notifPermission === 'granted'
                        ? 'Browser Notifications Granted'
                        : 'Enable Browser Notifications'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Server-Side AI API Configuration Card */}
            <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-orange-600" />
                    Server-Side AI Integration Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{aiStatus.message}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    aiStatus.liveAiConfigured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {aiStatus.liveAiConfigured ? 'Live LLM Active' : 'Local Fallback Active'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={apiKeyForm.provider}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, provider: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="gemini">Google Gemini API</option>
                  <option value="openai">OpenAI Compatible API</option>
                </select>
                <input
                  type="password"
                  value={apiKeyForm.api_key}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, api_key: e.target.value })}
                  placeholder="Enter API Key (stored only on backend server)..."
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/ai/configure', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(apiKeyForm),
                    });
                    setApiKeyForm({ ...apiKeyForm, api_key: '' });
                    fetchBootstrap();
                    setSettingsSavedMsg('Server AI configuration updated!');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Save Key on Server
                </button>
              </div>
            </div>

            {/* Extensible Language Registry Card (Add New Language Without Rebuilding) */}
            <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-600" />
                  Add Additional Language to Registry
                </h2>
                <p className="text-xs text-slate-500">
                  The language architecture is extensible—add any new regional or global language without rebuilding the app.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Code (e.g. bho)"
                  value={customLangForm.code}
                  onChange={(e) => setCustomLangForm({ ...customLangForm, code: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  placeholder="Language Name (e.g. Bhojpuri)"
                  value={customLangForm.name}
                  onChange={(e) => setCustomLangForm({ ...customLangForm, name: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  placeholder="Native Name"
                  value={customLangForm.native_name}
                  onChange={(e) =>
                    setCustomLangForm({ ...customLangForm, native_name: e.target.value })
                  }
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!customLangForm.code || !customLangForm.name) return;
                    const res = await fetch('/api/languages/custom', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(customLangForm),
                    });
                    const d = await res.json();
                    setBootstrap(d);
                    setCustomLangForm({
                      code: '',
                      name: '',
                      native_name: '',
                      bcp47: 'en-IN',
                      cultural_note: '',
                    });
                    setSettingsSavedMsg('Added new language to registry!');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Add Language
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
