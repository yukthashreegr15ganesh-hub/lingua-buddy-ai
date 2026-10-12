import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Turtle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Clock,
  HelpCircle,
  Award,
  Calendar,
  Send,
} from 'lucide-react';
import {
  LessonPlan,
  UserProfile,
  LanguageInfo,
  CharacterState,
  EvaluationResult,
  VocabItem,
} from '../types';
import { Buddy3D } from './Buddy3D';
import { speakPhrase, startSpeechRecognition, inspectVoiceCapabilities } from '../services/speech';

interface LessonRoomProps {
  activeLanguage: LanguageInfo;
  profile: UserProfile;
  characterState: CharacterState;
  setCharacterState: (st: CharacterState) => void;
  onLessonCompleted: (updatedBootstrap: any) => void;
  onChangeDuration: (minutes: number) => void;
}

export const LessonRoom: React.FC<LessonRoomProps> = ({
  activeLanguage,
  profile,
  characterState,
  setCharacterState,
  onLessonCompleted,
  onChangeDuration,
}) => {
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const [activeItemIdx, setActiveItemIdx] = useState(0);

  // Voice & Input state
  const [isListening, setIsListening] = useState(false);
  const [stopMicFn, setStopMicFn] = useState<(() => void) | null>(null);
  const [userInput, setUserInput] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [preferRomanASR, setPreferRomanASR] = useState(true);

  // Evaluation & Hints state
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Lesson tracking for final summary
  const [recalledIds, setRecalledIds] = useState<string[]>([]);
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);
  const [newWordIds, setNewWordIds] = useState<string[]>([]);
  const [roleplayTurns, setRoleplayTurns] = useState<
    { speaker: 'buddy' | 'user'; romanized: string; native?: string; meaning?: string }[]
  >([]);
  const [lessonSummary, setLessonSummary] = useState<any | null>(null);
  const [submittingFinish, setSubmittingFinish] = useState(false);

  const voiceCap = inspectVoiceCapabilities(activeLanguage.bcp47, activeLanguage.speechSupportLevel);

  // Fetch structured lesson plan whenever language, duration, or explanation language changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLessonSummary(null);
    setActivePhaseIdx(0);
    setActiveItemIdx(0);
    setEvaluation(null);
    setUserInput('');

    fetch(
      `/api/lesson/plan?language_code=${encodeURIComponent(
        activeLanguage.code
      )}&duration_minutes=${profile.daily_duration_minutes}&explanation_language=${encodeURIComponent(
        profile.explanation_language
      )}`
    )
      .then((r) => r.json())
      .then((data: LessonPlan) => {
        if (cancelled) return;
        setLessonPlan(data);
        const vocabPhase = data.phases.find((p) => p.id === 'vocabulary');
        if (vocabPhase?.items) {
          setNewWordIds(vocabPhase.items.map((i) => i.id));
        }
        // Initialize roleplay opener
        const firstVocab = vocabPhase?.items?.[0];
        if (firstVocab) {
          setRoleplayTurns([
            {
              speaker: 'buddy',
              romanized: `${firstVocab.romanized}! ${firstVocab.exampleRomanized}`,
              native: `${firstVocab.nativeText}! ${firstVocab.exampleNative}`,
              meaning: `${firstVocab.meaning} — ${firstVocab.exampleMeaning}`,
            },
          ]);
        }
        setLoading(false);
        setCharacterState('GREETING');
        setTimeout(() => setCharacterState('IDLE'), 2200);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLanguage.code, profile.daily_duration_minutes, profile.explanation_language]);

  // Lesson timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !lessonPlan) {
    return (
      <div className="p-10 text-center bg-white rounded-3xl border border-amber-200 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto animate-spin">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="mt-3 text-lg font-extrabold text-slate-800">
          Preparing Your Personalized {activeLanguage.name} Lesson...
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Adapting 5 phases for {profile.daily_duration_minutes}-minute session ({activeLanguage.progress.proficiencyLevel})
        </p>
      </div>
    );
  }

  const currentPhase = lessonPlan.phases[activePhaseIdx] || lessonPlan.phases[0];
  const currentVocabItem: VocabItem | undefined =
    currentPhase.items && currentPhase.items[activeItemIdx]
      ? currentPhase.items[activeItemIdx]
      : currentPhase.items?.[0];
  const currentQuestion =
    currentPhase.questions && currentPhase.questions[activeItemIdx]
      ? currentPhase.questions[activeItemIdx]
      : currentPhase.questions?.[0];

  const handlePlayAudio = (nativeText: string, romanizedText: string, speedMultiplier = 1.0) => {
    speakPhrase({
      nativeText,
      romanizedText,
      bcp47: activeLanguage.bcp47,
      speed: profile.speaking_speed * speedMultiplier,
      speechSupportLevel: activeLanguage.speechSupportLevel,
      onStart: () => setCharacterState('SPEAKING'),
      onEnd: () => setCharacterState('IDLE'),
    });
  };

  const handleSpeakExplanation = (text: string) => {
    speakPhrase({
      nativeText: text,
      romanizedText: text,
      bcp47: profile.explanation_language === 'en' ? 'en-US' : `${profile.explanation_language}-IN`,
      speed: 1.0,
      onStart: () => setCharacterState('SPEAKING'),
      onEnd: () => setCharacterState('IDLE'),
    });
  };

  const handleToggleMic = () => {
    if (isListening && stopMicFn) {
      stopMicFn();
      setIsListening(false);
      setCharacterState('IDLE');
      return;
    }

    setMicError(null);
    setIsListening(true);
    setCharacterState('LISTENING');

    const stop = startSpeechRecognition({
      bcp47: activeLanguage.bcp47,
      preferRomanFallback: preferRomanASR || activeLanguage.speechSupportLevel === 'phonetic-fallback',
      onInterim: (interim) => {
        setUserInput(interim);
      },
      onFinal: (finalText) => {
        setUserInput(finalText);
        setIsListening(false);
        handleEvaluateInput(finalText);
      },
      onError: (errMsg) => {
        setMicError(errMsg);
        setIsListening(false);
        setCharacterState('ENCOURAGING');
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
    setStopMicFn(() => stop);
  };

  const handleEvaluateInput = async (overrideText?: string) => {
    const textToEval = (overrideText ?? userInput).trim();
    if (!textToEval) {
      setMicError('Please speak into the microphone or type your response in Roman letters first.');
      return;
    }

    setCharacterState('THINKING');
    setMicError(null);

    // Determine target based on current phase
    let targetRoman = '';
    let targetNative = '';
    let pronGuide = '';
    let targetMeaning = '';
    let wordId: string | undefined = undefined;
    let evalMode = 'repeat';

    if (currentPhase.id === 'revision' || currentPhase.id === 'vocabulary') {
      if (currentVocabItem) {
        targetRoman = currentVocabItem.romanized;
        targetNative = currentVocabItem.nativeText;
        pronGuide = currentVocabItem.pronunciationGuide;
        targetMeaning = currentVocabItem.meaning;
        wordId = currentVocabItem.id;
      }
    } else if (currentPhase.id === 'sentences') {
      if (currentVocabItem) {
        targetRoman = currentVocabItem.exampleRomanized;
        targetNative = currentVocabItem.exampleNative;
        pronGuide = currentVocabItem.pronunciationGuide;
        targetMeaning = currentVocabItem.exampleMeaning;
        wordId = currentVocabItem.id;
      }
    } else if (currentPhase.id === 'conversation') {
      // Roleplay turn inside Phase 4
      const res = await fetch('/api/conversation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: activeLanguage.code,
          explanation_language: profile.explanation_language,
          proficiency_level: activeLanguage.progress.proficiencyLevel,
          scenario_id: currentPhase.scenario?.id || 'friend_chat',
          user_message: textToEval,
          turn_index: Math.ceil(roleplayTurns.length / 2),
          history: roleplayTurns,
        }),
      });
      const turnData = await res.json();
      setRoleplayTurns((prev) => [
        ...prev,
        { speaker: 'user', romanized: textToEval },
        {
          speaker: 'buddy',
          romanized: turnData.tutorRomanized,
          native: turnData.tutorNative,
          meaning: turnData.tutorMeaning,
        },
      ]);
      setUserInput('');
      setCharacterState(turnData.characterState || 'SPEAKING');
      handlePlayAudio(turnData.tutorNative, turnData.tutorRomanized);
      return;
    } else if (currentPhase.id === 'memory_test' && currentQuestion) {
      targetRoman = currentQuestion.targetRomanized;
      targetNative = currentQuestion.targetNative;
      pronGuide = currentQuestion.pronunciationGuide;
      targetMeaning = currentQuestion.correctMeaning;
      wordId = currentQuestion.wordId;
      evalMode = currentQuestion.questionType === 'meaning_recall' ? 'meaning' : 'repeat';
    }

    try {
      const res = await fetch('/api/lesson/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: activeLanguage.code,
          explanation_language: profile.explanation_language,
          word_id: wordId,
          user_transcript: textToEval,
          target_romanized: targetRoman,
          target_native: targetNative,
          pronunciation_guide: pronGuide,
          target_meaning: targetMeaning,
          mode: evalMode,
          record_progress: true,
        }),
      });
      const data: EvaluationResult = await res.json();
      setEvaluation(data);
      setCharacterState(data.characterState);

      if (wordId) {
        if (data.isCorrect) {
          setRecalledIds((prev) => (prev.includes(wordId!) ? prev : [...prev, wordId!]));
        } else {
          setMistakeIds((prev) => (prev.includes(wordId!) ? prev : [...prev, wordId!]));
        }
      }
    } catch {
      setCharacterState('ENCOURAGING');
    }
  };

  const handleNextStep = () => {
    setEvaluation(null);
    setUserInput('');
    setShowHint(false);
    setMicError(null);

    const maxItems =
      currentPhase.id === 'memory_test'
        ? (currentPhase.questions?.length || 1) - 1
        : currentPhase.id === 'conversation'
        ? 0
        : (currentPhase.items?.length || 1) - 1;

    if (activeItemIdx < maxItems) {
      setActiveItemIdx(activeItemIdx + 1);
    } else if (activePhaseIdx < lessonPlan.phases.length - 1) {
      setActivePhaseIdx(activePhaseIdx + 1);
      setActiveItemIdx(0);
    } else {
      handleCompleteLesson();
    }
  };

  const handleCompleteLesson = async () => {
    setSubmittingFinish(true);
    setCharacterState('FAREWELL');

    const totalAttempted = recalledIds.length + mistakeIds.length;
    const accuracyScore =
      totalAttempted > 0 ? Math.round((recalledIds.length / totalAttempted) * 100) : 88;

    try {
      const res = await fetch('/api/lesson/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: activeLanguage.code,
          duration_minutes: profile.daily_duration_minutes,
          proficiency_level: activeLanguage.progress.proficiencyLevel,
          new_words: newWordIds,
          recalled_words: recalledIds.length > 0 ? recalledIds : newWordIds.slice(0, 3),
          mistake_words: mistakeIds,
          conversation_turns: roleplayTurns.length,
          accuracy_score: accuracyScore,
          recommended_next: `Continue ${activeLanguage.name} Spoken Sentences & Market Role-Play`,
        }),
      });
      const data = await res.json();
      setLessonSummary(data.summary);
      onLessonCompleted(data.bootstrap);
    } finally {
      setSubmittingFinish(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Lesson Header & Duration Selector */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-amber-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800">
              {activeLanguage.name} • {activeLanguage.progress.proficiencyLevel}
            </span>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              Session Elapsed: {formatTimer(elapsedSeconds)} / {profile.daily_duration_minutes}m Plan
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Structured Spoken Lesson ({profile.daily_duration_minutes} Minutes)
          </h1>
        </div>

        {/* Duration Quick Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1">Lesson Duration:</span>
          {[10, 15, 20, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onChangeDuration(mins)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                profile.daily_duration_minutes === mins
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-slate-700 border border-amber-200'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      {/* 5-Phase Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {lessonPlan.phases.map((phase, idx) => {
          const isCurrent = idx === activePhaseIdx;
          const isDone = idx < activePhaseIdx || Boolean(lessonSummary);
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => {
                setActivePhaseIdx(idx);
                setActiveItemIdx(0);
                setEvaluation(null);
              }}
              className={`p-3 rounded-2xl border text-left transition ${
                isCurrent
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white border-orange-500 shadow-sm'
                  : isDone
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-white hover:bg-amber-50/60 border-amber-200/70 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold opacity-85">
                <span>Phase {phase.phaseNumber}</span>
                <span>{phase.minuteRange}</span>
              </div>
              <div className="font-extrabold text-xs sm:text-sm mt-0.5 truncate">{phase.title}</div>
            </button>
          );
        })}
      </div>

      {/* Main Split View: 3D Companion on Left, Interactive Voice Lesson on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Animated AI Companion */}
        <div className="lg:col-span-4 space-y-4">
          <Buddy3D
            state={characterState}
            languageName={activeLanguage.name}
            speechBubble={
              evaluation
                ? evaluation.feedback
                : currentVocabItem
                ? `Let's say "${currentVocabItem.romanized}" (${currentVocabItem.meaning})!`
                : `Ready to practice ${activeLanguage.name}!`
            }
            subText={activeLanguage.culturalNote}
            onSelectState={setCharacterState}
            onSpeakGreeting={() => {
              const first = lessonPlan.phases[1]?.items?.[0];
              if (first) {
                handlePlayAudio(first.nativeText, first.romanized);
              }
            }}
          />

          {/* Honest Speech Service Capability Notice */}
          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 text-xs space-y-1.5 shadow-sm">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>Speech & Audio Status ({activeLanguage.name})</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  voiceCap.hasNativeVoiceForLang
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {voiceCap.hasNativeVoiceForLang ? 'Native Voice Ready' : 'Phonetic Fallback'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">{activeLanguage.speechNotes}</p>
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Voice: {voiceCap.matchedVoiceName}</span>
              <label className="flex items-center gap-1 cursor-pointer font-semibold text-orange-700">
                <input
                  type="checkbox"
                  checked={preferRomanASR}
                  onChange={(e) => setPreferRomanASR(e.target.checked)}
                  className="rounded text-orange-600"
                />
                Roman Mic Mode
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Phase Content */}
        <div className="lg:col-span-8">
          {lessonSummary ? (
            /* END OF LESSON SUMMARY REPORT (Section 8) */
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Award className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                      Lesson Complete!
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900">
                      Great {activeLanguage.name} Speaking Session!
                    </h2>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-emerald-600">
                    {lessonSummary.accuracyScore}%
                  </div>
                  <div className="text-xs text-slate-500">Speaking Recall Score</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <div className="text-xs font-bold text-slate-500">New Words Introduced</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {lessonSummary.newWords?.length || 0} phrases
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-700">Words Recalled Correctly</div>
                  <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                    {lessonSummary.recalledCorrectly?.length || 0} phrases
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
                  <div className="text-xs font-bold text-rose-700">Mistakes to Review</div>
                  <div className="text-2xl font-extrabold text-rose-900 mt-1">
                    {lessonSummary.mistakesToReview?.length || 0} phrases
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    Recommended Next Lesson
                  </div>
                  <p className="text-slate-600 mt-1">{lessonSummary.recommendedNextLesson}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    Next Spaced Revision Date
                  </div>
                  <p className="text-slate-600 mt-1">
                    {lessonSummary.nextRevisionDate} (Proficiency: {lessonSummary.proficiencyLevelAfter})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLessonSummary(null);
                    setActivePhaseIdx(0);
                    setActiveItemIdx(0);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm transition shadow-sm"
                >
                  Start Another Session
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE PHASE CARD */
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/90 shadow-sm space-y-6">
              {/* Phase Title & Item Progress */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                    Phase {currentPhase.phaseNumber} • {currentPhase.minuteRange}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900">{currentPhase.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{currentPhase.description}</p>
                </div>

                {currentPhase.items && currentPhase.items.length > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                    Phrase {activeItemIdx + 1} of {currentPhase.items.length}
                  </div>
                )}
              </div>

              {/* PHASE 1, 2, 3: VOCABULARY, REVISION, AND SENTENCE PRACTICE */}
              {(currentPhase.id === 'revision' ||
                currentPhase.id === 'vocabulary' ||
                currentPhase.id === 'sentences') &&
                currentVocabItem && (
                  <div className="space-y-5">
                    {/* Main Spoken Phrase Display Card */}
                    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border border-amber-200/90 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-bold">
                          Topic: {currentVocabItem.topic}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {currentPhase.id === 'sentences'
                            ? 'Repeat the Full Sentence Aloud'
                            : 'Listen & Repeat the Phrase Aloud'}
                        </span>
                      </div>

                      {/* Primary Romanized Pronunciation (Always Prominent) */}
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-orange-700">
                          Easy Roman Pronunciation
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                          {currentPhase.id === 'sentences'
                            ? currentVocabItem.exampleRomanized
                            : currentVocabItem.romanized}
                        </div>
                        <div className="text-sm font-semibold text-orange-700 mt-1">
                          Syllable Guide: [{currentVocabItem.pronunciationGuide}]
                        </div>
                      </div>

                      {/* Optional Native Script (Only shown if user enabled Show Script) */}
                      {profile.show_native_script && (
                        <div className="pt-2 border-t border-amber-200/60">
                          <div className="text-[11px] font-semibold text-slate-500">
                            Optional Native Script ({activeLanguage.nativeName})
                          </div>
                          <div className="text-xl font-bold text-slate-800 mt-0.5">
                            {currentPhase.id === 'sentences'
                              ? currentVocabItem.exampleNative
                              : currentVocabItem.nativeText}
                          </div>
                        </div>
                      )}

                      {/* Meaning in Chosen Explanation Language */}
                      <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80">
                        <div className="text-[11px] font-bold uppercase text-slate-400">
                          Meaning ({profile.explanation_language.toUpperCase()})
                        </div>
                        <div className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
                          {currentPhase.id === 'sentences'
                            ? currentVocabItem.exampleMeaning
                            : currentVocabItem.meaning}
                        </div>
                      </div>

                      {/* Audio Playback Controls */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handlePlayAudio(
                              currentPhase.id === 'sentences'
                                ? currentVocabItem.exampleNative
                                : currentVocabItem.nativeText,
                              currentPhase.id === 'sentences'
                                ? currentVocabItem.exampleRomanized
                                : currentVocabItem.romanized,
                              1.0
                            )
                          }
                          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm shadow-sm transition"
                        >
                          <Volume2 className="w-4 h-4" />
                          Listen ({activeLanguage.name})
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handlePlayAudio(
                              currentPhase.id === 'sentences'
                                ? currentVocabItem.exampleNative
                                : currentVocabItem.nativeText,
                              currentPhase.id === 'sentences'
                                ? currentVocabItem.exampleRomanized
                                : currentVocabItem.romanized,
                              0.65
                            )
                          }
                          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs sm:text-sm transition"
                        >
                          <Turtle className="w-4 h-4" />
                          Slow Audio (0.65x)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSpeakExplanation(currentVocabItem.grammarNote)}
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs transition"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                          Hear Coach Tip
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowHint(!showHint)}
                          className="flex items-center gap-1 px-3 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-semibold text-xs transition ml-auto"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          {showHint ? 'Hide Example & Tip' : 'Show Example & Tip'}
                        </button>
                      </div>

                      {/* Contextual Grammar Note & Example Sentence */}
                      {(showHint || currentPhase.id === 'vocabulary') && (
                        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1.5">
                          <div className="font-bold text-indigo-950">
                            Example in Context: "{currentVocabItem.exampleRomanized}" —{' '}
                            <span className="font-normal text-indigo-800">
                              {currentVocabItem.exampleMeaning}
                            </span>
                          </div>
                          <div className="text-slate-600">
                            <strong>Coach Note:</strong> {currentVocabItem.grammarNote}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* PHASE 4: EMBEDDED REAL-LIFE CONVERSATION ROLE-PLAY */}
              {currentPhase.id === 'conversation' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-orange-800">
                        Role-Play Scenario: {currentPhase.scenario?.title}
                      </div>
                      <div className="text-xs text-slate-600">{currentPhase.scenario?.description}</div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    {roleplayTurns.map((turn, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl max-w-[85%] ${
                          turn.speaker === 'buddy'
                            ? 'bg-white border border-amber-200 text-slate-800'
                            : 'bg-orange-600 text-white ml-auto'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase opacity-75">
                          {turn.speaker === 'buddy' ? `Buddy (${activeLanguage.name})` : 'You'}
                        </div>
                        <div className="font-bold text-sm mt-0.5">{turn.romanized}</div>
                        {profile.show_native_script && turn.native && (
                          <div className="text-xs opacity-80">{turn.native}</div>
                        )}
                        {turn.meaning && (
                          <div className="text-xs text-slate-500 mt-1">{turn.meaning}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PHASE 5: MEMORY TEST */}
              {currentPhase.id === 'memory_test' && currentQuestion && (
                <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold uppercase">
                      {currentQuestion.questionType.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handlePlayAudio(currentQuestion.targetNative, currentQuestion.targetRomanized)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Play Phrase Audio
                    </button>
                  </div>

                  <h3 className="text-lg font-extrabold text-slate-900">{currentQuestion.prompt}</h3>

                  {currentQuestion.questionType !== 'spoken_response' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {currentQuestion.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const isRight = opt === currentQuestion.correctMeaning;
                            setUserInput(opt);
                            setEvaluation({
                              isCorrect: isRight,
                              similarityScore: isRight ? 100 : 35,
                              evaluationMethod: 'Quiz Meaning Recall',
                              characterState: isRight ? 'HAPPY' : 'CORRECTING',
                              userSaid: opt,
                              targetRomanized: currentQuestion.targetRomanized,
                              targetNative: currentQuestion.targetNative,
                              pronunciationGuide: currentQuestion.pronunciationGuide,
                              targetMeaning: currentQuestion.correctMeaning,
                              matchedWords: isRight ? [currentQuestion.targetRomanized] : [],
                              missedWords: isRight ? [] : [currentQuestion.targetRomanized],
                              feedback: isRight
                                ? `Spot on! "${currentQuestion.targetRomanized}" means "${currentQuestion.correctMeaning}".`
                                : `Not quite! "${currentQuestion.targetRomanized}" means "${currentQuestion.correctMeaning}".`,
                            });
                            setCharacterState(isRight ? 'HAPPY' : 'CORRECTING');
                          }}
                          className="p-3 rounded-2xl bg-white hover:bg-indigo-50 border border-indigo-200 text-left text-xs sm:text-sm font-bold text-slate-800 transition"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VOICE-FIRST MICROPHONE & TEXT FALLBACK BAR */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Prominent Microphone Button */}
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    data-testid="lesson-mic-button"
                    className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl font-extrabold text-sm shadow-md transition ${
                      isListening
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-5 h-5" />
                        <span>Stop Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5" />
                        <span>Speak Now (Mic)</span>
                      </>
                    )}
                  </button>

                  {/* Romanized Text Input Fallback (No Native Script Required!) */}
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEvaluateInput();
                      }}
                      placeholder={`Speak with Mic or type Roman pronunciation (e.g. "${
                        currentVocabItem?.romanized || 'Vanakkam'
                      }")...`}
                      className="flex-1 px-4 py-3 rounded-2xl border border-slate-300 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleEvaluateInput()}
                      className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>Check</span>
                    </button>
                  </div>
                </div>

                {micError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{micError}</span>
                  </div>
                )}
              </div>

              {/* PRONUNCIATION & SPEAKING FEEDBACK CARD (Section 13) */}
              {evaluation && (
                <div
                  className={`p-5 rounded-3xl border space-y-3 ${
                    evaluation.isCorrect
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-amber-50/80 border-amber-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {evaluation.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      )}
                      <span className="font-extrabold text-sm text-slate-900">
                        {evaluation.feedback}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-white border border-slate-200">
                      Similarity Match: {evaluation.similarityScore}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-white/90 border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">What You Said</div>
                      <div className="font-bold text-slate-800 mt-0.5">{evaluation.userSaid}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/90 border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">
                        Target Pronunciation Guide
                      </div>
                      <div className="font-bold text-orange-700 mt-0.5">
                        {evaluation.targetRomanized} ({evaluation.pronunciationGuide})
                      </div>
                    </div>
                  </div>

                  {evaluation.missedWords.length > 0 && (
                    <div className="text-xs text-amber-900">
                      <strong>Words to refine:</strong> {evaluation.missedWords.join(', ')}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">{evaluation.evaluationMethod}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handlePlayAudio(evaluation.targetNative, evaluation.targetRomanized, 0.65)
                        }
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1"
                      >
                        <Turtle className="w-3.5 h-3.5" />
                        Slower Audio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEvaluation(null);
                          setUserInput('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCompleteLesson}
                  disabled={submittingFinish}
                  className="text-xs font-bold text-slate-500 hover:text-orange-700 transition"
                >
                  {submittingFinish ? 'Saving Progress...' : 'Finish & Save Lesson Now'}
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-sm transition"
                >
                  <span>
                    {activePhaseIdx === lessonPlan.phases.length - 1 &&
                    activeItemIdx >= (currentPhase.questions?.length || 1) - 1
                      ? 'Complete Lesson & View Summary'
                      : 'Next Phrase / Step'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
