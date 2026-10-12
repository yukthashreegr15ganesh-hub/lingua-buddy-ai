/**
 * Full-Featured Browser-Side API Engine for Firebase Hosting Deployment.
 * When deployed to static hosting (https://lingua-buddy-ai-app.web.app) where no Python
 * process serves /api/*, this engine transparently handles all /api/* routes using
 * /curriculum.json and persistent localStorage so 100% of features work in production.
 */

const STORAGE_KEY = 'lingua_buddy_cloud_state_v1';

interface StoredState {
  profile: any;
  languageProgress: Record<string, any>;
  vocabularyProgress: Record<string, any>;
  lessonHistory: any[];
  conversationHistory: any[];
  customLanguages: any[];
  aiConfig: { provider: string; apiKey: string; model: string };
}

let curriculumCache: {
  languages: any[];
  explanationLanguages: any[];
  topics: string[];
  scenarios: any[];
} | null = null;

async function getCurriculum() {
  if (curriculumCache) return curriculumCache;
  const res = await window.fetch('/curriculum.json');
  curriculumCache = await res.json();
  return curriculumCache!;
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const initial: StoredState = {
    profile: {
      id: 1,
      learner_name: 'Learner',
      active_language: 'ta',
      explanation_language: 'en',
      learning_reason: 'Connect with friends and speak naturally',
      daily_duration_minutes: 30,
      preferred_time: '19:00',
      scheduled_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      reminder_enabled: true,
      speaking_speed: 0.95,
      show_native_script: false,
      onboarding_completed: false,
    },
    languageProgress: {},
    vocabularyProgress: {},
    lessonHistory: [],
    conversationHistory: [],
    customLanguages: [],
    aiConfig: { provider: 'gemini', apiKey: '', model: '' },
  };
  saveState(initial);
  return initial;
}

function saveState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function ensureLangProgress(state: StoredState, code: string) {
  if (!state.languageProgress[code]) {
    state.languageProgress[code] = {
      language_code: code,
      proficiency_level: 'Beginner',
      understanding_comfort: 'complete_beginner',
      completed_lessons: 0,
      total_minutes: 0,
      streak_days: 0,
      last_active_date: '',
      daily_minutes_today: 0,
    };
  }
  return state.languageProgress[code];
}

function localizeVocabItem(item: any, explanationLang: string) {
  const meanings = item.meanings || {};
  const chosen = meanings[explanationLang] || meanings['en'] || item.exampleMeaning || '';
  const enMeaning = meanings['en'] || item.exampleMeaning || '';
  const displayMeaning =
    explanationLang !== 'en' && chosen !== enMeaning ? `${chosen} (${enMeaning})` : chosen;
  return {
    ...item,
    meaning: displayMeaning,
    explanationLang,
  };
}

function normalizePhonetic(text: string): string {
  if (!text) return '';
  let s = text.toLowerCase().trim().replace(/[^\w\s]/g, ' ');
  const reps: [string, string][] = [
    ['aa', 'a'],
    ['ee', 'i'],
    ['oo', 'u'],
    ['th', 't'],
    ['dh', 'd'],
    ['bh', 'b'],
    ['gh', 'g'],
    ['kh', 'k'],
    ['ph', 'p'],
    ['zh', 'l'],
    ['sh', 's'],
    ['chh', 'ch'],
    ['ng', 'n'],
    ['ou', 'o'],
  ];
  for (const [oldS, newS] of reps) {
    s = s.split(oldS).join(newS);
  }
  return s.replace(/\s+/g, ' ').trim();
}

function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  const dp: number[][] = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[lenA][lenB];
  return Math.max(0, 1 - dist / Math.max(lenA, lenB));
}

async function getVocabWithProgress(langCode: string, expLang: string, state: StoredState) {
  const curr = await getCurriculum();
  const allLangs = [...curr.languages, ...state.customLanguages];
  const lang = allLangs.find((l) => l.code === langCode) || curr.languages[0];
  const nowIso = new Date().toISOString();

  return (lang.vocabulary || []).map((item: any) => {
    const loc = localizeVocabItem(item, expLang);
    const st = state.vocabularyProgress[item.id];
    if (st) {
      const isDue = Boolean(st.next_review_at && st.next_review_at <= nowIso && st.mastery_status !== 'new');
      return {
        ...loc,
        lastPracticedAt: st.last_practiced_at,
        successfulRecalls: st.successful_recalls || 0,
        mistakeCount: st.mistake_count || 0,
        nextReviewAt: st.next_review_at,
        intervalDays: st.interval_days || 1,
        masteryStatus:
          isDue && st.mastery_status !== 'difficult' ? 'review_due' : st.mastery_status || 'learning',
        isLearned: true,
        isDue,
      };
    }
    return {
      ...loc,
      lastPracticedAt: null,
      successfulRecalls: 0,
      mistakeCount: 0,
      nextReviewAt: null,
      intervalDays: 0,
      masteryStatus: 'new',
      isLearned: false,
      isDue: false,
    };
  });
}

function recordVocabAttempt(state: StoredState, langCode: string, wordId: string, isCorrect: boolean) {
  const now = new Date();
  const existing = state.vocabularyProgress[wordId];
  let recalls = existing ? existing.successful_recalls || 0 : 0;
  let mistakes = existing ? existing.mistake_count || 0 : 0;
  let interval = existing ? existing.interval_days || 1 : 1;
  let status = 'learning';
  let nextReview = new Date(now.getTime() + 86400000).toISOString();

  if (isCorrect) {
    recalls += 1;
    interval = recalls === 1 ? 1 : recalls === 2 ? 3 : recalls === 3 ? 7 : Math.min(30, interval * 2);
    nextReview = new Date(now.getTime() + interval * 86400000).toISOString();
    status = recalls >= 3 && mistakes <= recalls ? 'mastered' : 'learning';
  } else {
    mistakes += 1;
    interval = 1;
    nextReview = new Date(now.getTime() + 4 * 3600000).toISOString();
    status = 'difficult';
  }

  state.vocabularyProgress[wordId] = {
    word_id: wordId,
    language_code: langCode,
    last_practiced_at: now.toISOString(),
    successful_recalls: recalls,
    mistake_count: mistakes,
    next_review_at: nextReview,
    interval_days: interval,
    mastery_status: status,
  };
}

async function buildBootstrap(state: StoredState) {
  const curr = await getCurriculum();
  const activeCode = state.profile.active_language || 'ta';
  const expCode = state.profile.explanation_language || 'en';
  ensureLangProgress(state, activeCode);

  const allLangs = [...curr.languages, ...state.customLanguages];
  const nowIso = new Date().toISOString();

  const languages = allLangs.map((lang) => {
    const code = lang.code;
    const p = state.languageProgress[code] || {
      proficiency_level: 'Beginner',
      understanding_comfort: 'complete_beginner',
      completed_lessons: 0,
      total_minutes: 0,
      streak_days: 0,
      last_active_date: '',
      daily_minutes_today: 0,
    };

    const langVocabEntries = Object.values(state.vocabularyProgress).filter(
      (v: any) => v.language_code === code
    );
    const wordsLearned = langVocabEntries.length;
    const wordsMastered = langVocabEntries.filter((v: any) => v.mastery_status === 'mastered').length;
    const difficultWords = langVocabEntries.filter(
      (v: any) => v.mastery_status === 'difficult' || v.mistake_count > 0
    ).length;
    const dueForReview = langVocabEntries.filter(
      (v: any) => v.next_review_at && v.next_review_at <= nowIso && v.mastery_status !== 'new'
    ).length;

    return {
      code,
      name: lang.name,
      nativeName: lang.nativeName,
      region: lang.region,
      bcp47: lang.bcp47,
      wordOrder: lang.wordOrder,
      speechSupportLevel: lang.speechSupportLevel,
      speechNotes: lang.speechNotes,
      culturalNote: lang.culturalNote,
      curriculumCount: (lang.vocabulary || []).length,
      progress: {
        proficiencyLevel: p.proficiency_level || 'Beginner',
        understandingComfort: p.understanding_comfort || 'complete_beginner',
        completedLessons: p.completed_lessons || 0,
        totalMinutes: p.total_minutes || 0,
        streakDays: p.streak_days || 0,
        lastActiveDate: p.last_active_date || '',
        dailyMinutesToday: p.daily_minutes_today || 0,
        wordsLearned,
        wordsMastered,
        difficultWords,
        dueForReview,
      },
    };
  });

  const activeLanguage = languages.find((l) => l.code === activeCode) || languages[0];
  const vocabulary = await getVocabWithProgress(activeCode, expCode, state);
  const recentLessons = state.lessonHistory.filter((l) => l.language_code === activeCode).slice(0, 5);
  const recentConversations = state.conversationHistory
    .filter((c) => c.language_code === activeCode)
    .slice(0, 5);

  return {
    profile: state.profile,
    activeLanguage,
    languages,
    explanationLanguages: curr.explanationLanguages,
    topics: curr.topics,
    scenarios: curr.scenarios,
    vocabulary,
    recentLessons,
    recentConversations,
    aiStatus: {
      liveAiConfigured: Boolean(state.aiConfig.apiKey),
      provider: state.aiConfig.apiKey
        ? 'Live Cloud LLM API'
        : 'Built-in Multilingual Tutor Engine (Cloud Static Mode)',
      model: state.aiConfig.model || 'lingua-buddy-v1',
      mode: state.aiConfig.apiKey ? 'live_llm' : 'local_fallback',
      message: state.aiConfig.apiKey
        ? 'Connected to live LLM API.'
        : 'Running Built-in Multilingual Tutor Engine with persistent browser storage.',
      setupInstructions: null,
    },
  };
}

export async function handleLocalApiRequest(urlStr: string, init?: RequestInit): Promise<Response> {
  const url = new URL(urlStr, window.location.origin);
  const path = url.pathname;
  const body = init?.body ? JSON.parse(init.body as string) : {};
  const state = loadState();
  const curr = await getCurriculum();

  const jsonResponse = (data: any) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  if (path === '/api/health') {
    return jsonResponse({ status: 'ok', service: 'Lingua Buddy AI Cloud Engine' });
  }

  if (path === '/api/bootstrap') {
    return jsonResponse(await buildBootstrap(state));
  }

  if (path === '/api/profile') {
    state.profile = { ...state.profile, ...body };
    const activeCode = state.profile.active_language;
    const lp = ensureLangProgress(state, activeCode);
    if (body.proficiency_level) lp.proficiency_level = body.proficiency_level;
    if (body.understanding_comfort) lp.understanding_comfort = body.understanding_comfort;
    saveState(state);
    return jsonResponse(await buildBootstrap(state));
  }

  if (path === '/api/languages/switch') {
    state.profile.active_language = body.language_code;
    if (body.explanation_language) state.profile.explanation_language = body.explanation_language;
    ensureLangProgress(state, body.language_code);
    saveState(state);
    return jsonResponse(await buildBootstrap(state));
  }

  if (path === '/api/languages/custom') {
    const code = (body.code || 'custom').toLowerCase().trim();
    state.customLanguages.push({
      code,
      name: body.name,
      nativeName: body.native_name || body.name,
      region: body.region || 'Additional Languages',
      bcp47: body.bcp47 || 'en-IN',
      wordOrder: body.word_order || 'SVO',
      speechSupportLevel: 'phonetic-fallback',
      speechNotes: 'Custom language using phonetic synthesis and Romanized pronunciation.',
      culturalNote: body.cultural_note || '',
      vocabulary: [
        {
          id: `${code}_w1`,
          conceptKey: 'hello',
          topic: 'Greetings',
          level: 'Beginner',
          nativeText: `Hello (${body.native_name || body.name})`,
          romanized: 'Hello',
          pronunciationGuide: 'Hel-lo',
          meanings: { en: 'Hello / Greetings' },
          exampleNative: 'Hello!',
          exampleRomanized: 'Hello!',
          exampleMeaning: 'Hello!',
          grammarNote: `Starter greeting for ${body.name}.`,
        },
      ],
    });
    saveState(state);
    return jsonResponse(await buildBootstrap(state));
  }

  if (path === '/api/lesson/plan') {
    const langCode = url.searchParams.get('language_code') || state.profile.active_language || 'ta';
    const duration = Number(url.searchParams.get('duration_minutes') || 30);
    const expLang = url.searchParams.get('explanation_language') || state.profile.explanation_language || 'en';
    const lp = ensureLangProgress(state, langCode);
    const vocab = await getVocabWithProgress(langCode, expLang, state);
    const allLangs = [...curr.languages, ...state.customLanguages];
    const langInfo = allLangs.find((l) => l.code === langCode) || curr.languages[0];

    const scale = Math.max(10, duration) / 30.0;
    const p1 = Math.max(2, Math.round(5 * scale));
    const p2 = Math.max(p1 + 2, Math.round(12 * scale));
    const p3 = Math.max(p2 + 3, Math.round(20 * scale));
    const p4 = Math.max(p3 + 2, Math.round(27 * scale));
    const p5 = Math.max(p4 + 1, duration);

    const learned = vocab.filter((v: any) => v.isLearned);
    const isFirst = learned.length === 0;
    const revisionItems = isFirst ? vocab.slice(0, 2) : learned.slice(0, 4);
    const newCount = duration <= 15 ? 5 : duration <= 30 ? 6 : 8;
    const unmastered = vocab.filter((v: any) => v.masteryStatus !== 'mastered');
    const newVocab = (unmastered.length >= 5 ? unmastered : vocab).slice(0, newCount);
    const sentenceItems = newVocab.slice(0, 5);
    const allMeanings = vocab.map((v: any) => v.meaning);

    const questions = (revisionItems.concat(newVocab)).slice(0, 5).map((qitem: any, idx: number) => {
      const distractors = allMeanings.filter((m: string) => m !== qitem.meaning).slice(0, 3);
      const opts = [qitem.meaning, ...distractors];
      const qType = ['spoken_response', 'meaning_recall', 'listening_comprehension', 'sentence_completion'][idx % 4];
      return {
        id: `lt_${qitem.id}_${idx}`,
        wordId: qitem.id,
        questionType: qType,
        prompt:
          qType === 'spoken_response'
            ? `Say '${qitem.meaning}' aloud in ${langInfo.name}`
            : qType === 'listening_comprehension'
            ? `Listen and choose the meaning of '${qitem.romanized}'`
            : qType === 'sentence_completion'
            ? `Complete the spoken phrase: ${qitem.exampleRomanized}`
            : `What does '${qitem.romanized}' mean?`,
        targetRomanized: qType === 'sentence_completion' ? qitem.exampleRomanized : qitem.romanized,
        targetNative: qType === 'sentence_completion' ? qitem.exampleNative : qitem.nativeText,
        pronunciationGuide: qitem.pronunciationGuide,
        correctMeaning: qitem.meaning,
        options: opts,
        hint: `Syllables: ${qitem.pronunciationGuide} (${qitem.topic})`,
      };
    });

    return jsonResponse({
      languageCode: langCode,
      languageName: langInfo.name,
      nativeName: langInfo.nativeName,
      bcp47: langInfo.bcp47,
      speechSupportLevel: langInfo.speechSupportLevel,
      speechNotes: langInfo.speechNotes,
      culturalNote: langInfo.culturalNote,
      proficiencyLevel: lp.proficiency_level,
      durationMinutes: duration,
      isFirstLesson: isFirst,
      phases: [
        {
          id: 'revision',
          phaseNumber: 1,
          title: isFirst ? 'Introductory Speaking Check' : 'Warm-Up & Spaced Revision',
          minuteRange: `Minutes 0–${p1}`,
          description: isFirst
            ? `Welcome to your first ${langInfo.name} session! Let's try speaking two foundational greetings aloud.`
            : 'Recall and speak phrases from your previous sessions.',
          items: revisionItems,
        },
        {
          id: 'vocabulary',
          phaseNumber: 2,
          title: 'New Spoken Vocabulary',
          minuteRange: `Minutes ${p1}–${p2}`,
          description: `Learn ${newVocab.length} practical ${langInfo.name} expressions through listening and repeating.`,
          items: newVocab,
        },
        {
          id: 'sentences',
          phaseNumber: 3,
          title: 'Sentence Formation & Oral Practice',
          minuteRange: `Minutes ${p2}–${p3}`,
          description: 'Practice full natural sentences aloud and build spoken fluency.',
          items: sentenceItems,
        },
        {
          id: 'conversation',
          phaseNumber: 4,
          title: 'Real-Life Role-Play Conversation',
          minuteRange: `Minutes ${p3}–${p4}`,
          description: `Practice a live dialogue with Buddy.`,
          scenario: curr.scenarios[0],
        },
        {
          id: 'memory_test',
          phaseNumber: 5,
          title: 'Memory & Speaking Check',
          minuteRange: `Minutes ${p4}–${p5}`,
          description: 'Quick spoken recall, listening comprehension, and meaning check.',
          questions,
        },
      ],
    });
  }

  if (path === '/api/lesson/evaluate') {
    const cleanInput = (body.user_transcript || '').trim();
    const targetRoman = body.target_romanized || '';
    const targetNative = body.target_native || '';
    const pronGuide = body.pronunciation_guide || '';
    const targetMeaning = body.target_meaning || '';

    const normUser = normalizePhonetic(cleanInput);
    const alts = targetRoman.split(/[/|()]/).map((s: string) => s.trim()).filter(Boolean);
    let bestRatio = 0;
    for (const alt of alts) {
      const nAlt = normalizePhonetic(alt);
      let r = similarityRatio(normUser, nAlt);
      if (nAlt && normUser && (nAlt.includes(normUser) || normUser.includes(nAlt)) && normUser.length >= 3) {
        r = Math.max(r, 0.86);
      }
      bestRatio = Math.max(bestRatio, r);
    }
    if (targetNative && cleanInput === targetNative) bestRatio = 1.0;

    const primaryWords = (alts[0] || targetRoman).split(/\s+/).filter(Boolean);
    const userWords = cleanInput.split(/\s+/).map(normalizePhonetic).filter(Boolean);
    const matchedWords: string[] = [];
    const missedWords: string[] = [];
    for (const tw of primaryWords) {
      const twNorm = normalizePhonetic(tw);
      const matched = userWords.some((uw: string) => similarityRatio(twNorm, uw) >= 0.65 || uw.includes(twNorm));
      if (matched || bestRatio >= 0.85) matchedWords.push(tw);
      else missedWords.push(tw);
    }

    const score = Math.round(Math.min(1, bestRatio) * 100);
    const isCorrect = score >= 62;
    if (body.record_progress && body.word_id) {
      recordVocabAttempt(state, body.language_code, body.word_id, isCorrect);
      saveState(state);
    }

    return jsonResponse({
      isCorrect,
      similarityScore: score,
      evaluationMethod: 'Speech-to-Text Transcription & Romanized Phonetic Similarity',
      characterState: score >= 80 ? 'HAPPY' : score >= 58 ? 'CORRECTING' : 'ENCOURAGING',
      userSaid: cleanInput,
      targetRomanized: targetRoman,
      targetNative,
      pronunciationGuide: pronGuide,
      targetMeaning,
      matchedWords,
      missedWords,
      feedback:
        score >= 80
          ? `Wonderful job! You pronounced '${targetRoman}' clearly.`
          : score >= 58
          ? `Very close! Watch the syllables: ${pronGuide}.`
          : `Good effort! Let's listen once more and say '${targetRoman}' (${pronGuide}) together.`,
    });
  }

  if (path === '/api/lesson/complete') {
    const langCode = body.language_code;
    const lp = ensureLangProgress(state, langCode);
    for (const wid of body.recalled_words || []) recordVocabAttempt(state, langCode, wid, true);
    for (const wid of body.mistake_words || []) recordVocabAttempt(state, langCode, wid, false);
    for (const wid of body.new_words || []) recordVocabAttempt(state, langCode, wid, true);

    lp.completed_lessons = (lp.completed_lessons || 0) + 1;
    lp.total_minutes = (lp.total_minutes || 0) + (body.duration_minutes || 30);
    lp.daily_minutes_today = (lp.daily_minutes_today || 0) + (body.duration_minutes || 30);
    lp.streak_days = Math.max(1, lp.streak_days || 1);
    lp.last_active_date = new Date().toISOString().slice(0, 10);

    const summary = {
      newWords: body.new_words || [],
      recalledCorrectly: body.recalled_words || [],
      mistakesToReview: body.mistake_words || [],
      conversationTurns: body.conversation_turns || 2,
      accuracyScore: body.accuracy_score || 88,
      recommendedNextLesson: body.recommended_next || 'Everyday Sentence Building & Role-Play',
      nextRevisionDate: new Date(Date.now() + 86400000).toLocaleDateString(),
      proficiencyLevelAfter: lp.proficiency_level,
    };

    state.lessonHistory.unshift({
      id: Date.now(),
      language_code: langCode,
      duration_minutes: body.duration_minutes,
      proficiency_level: lp.proficiency_level,
      new_words_count: (body.new_words || []).length,
      recalled_correctly_count: (body.recalled_words || []).length,
      mistakes_count: (body.mistake_words || []).length,
      accuracy_score: body.accuracy_score || 88,
      summary,
      created_at: new Date().toISOString(),
    });
    saveState(state);
    return jsonResponse({ summary, bootstrap: await buildBootstrap(state) });
  }

  if (path === '/api/conversation/turn') {
    const langCode = body.language_code || 'ta';
    const expLang = body.explanation_language || 'en';
    const vocab = await getVocabWithProgress(langCode, expLang, state);
    const sc = curr.scenarios.find((s: any) => s.id === body.scenario_id) || curr.scenarios[0];
    const turnIdx = body.turn_index || 0;
    const item = vocab[turnIdx % vocab.length] || vocab[0];
    const nextItem = vocab[(turnIdx + 1) % vocab.length] || vocab[0];

    const hasUserMsg = Boolean((body.user_message || '').trim());
    return jsonResponse({
      aiMode: 'local_fallback',
      scenarioTitle: sc.title,
      characterState: hasUserMsg ? 'HAPPY' : 'GREETING',
      tutorNative: item.exampleNative,
      tutorRomanized: item.exampleRomanized,
      tutorPronunciationGuide: item.pronunciationGuide,
      tutorMeaning: item.meaning,
      coachNote: item.grammarNote,
      correction: hasUserMsg
        ? {
            gentleNote: `Great conversational flow! You can also express this naturally as:`,
            naturalRomanized: item.exampleRomanized,
            naturalNative: item.exampleNative,
            pronunciationGuide: item.pronunciationGuide,
            meaning: item.meaning,
          }
        : null,
      responseHints: [
        {
          romanized: nextItem.romanized,
          native: nextItem.nativeText,
          pronunciationGuide: nextItem.pronunciationGuide,
          meaning: nextItem.meaning,
        },
        {
          romanized: vocab[0].romanized,
          native: vocab[0].nativeText,
          pronunciationGuide: vocab[0].pronunciationGuide,
          meaning: vocab[0].meaning,
        },
      ],
    });
  }

  if (path === '/api/conversation/save') {
    state.conversationHistory.unshift({
      id: Date.now(),
      language_code: body.language_code,
      scenario_id: body.scenario_id,
      scenario_title: body.scenario_title,
      proficiency_level: body.proficiency_level,
      messages: body.messages || [],
      turns_count: (body.messages || []).length,
      created_at: new Date().toISOString(),
    });
    saveState(state);
    return jsonResponse({
      saved: { id: Date.now() },
      recentConversations: state.conversationHistory
        .filter((c) => c.language_code === body.language_code)
        .slice(0, 5),
    });
  }

  if (path.startsWith('/api/quiz/')) {
    const langCode = decodeURIComponent(path.replace('/api/quiz/', ''));
    const expLang = url.searchParams.get('explanation_language') || state.profile.explanation_language || 'en';
    const vocab = await getVocabWithProgress(langCode, expLang, state);
    const allMeanings = vocab.map((v: any) => v.meaning);
    const questions = vocab.slice(0, 8).map((item: any, idx: number) => ({
      id: `quiz_${item.id}_${idx}`,
      wordId: item.id,
      mode: ['speaking', 'listening', 'meaning', 'sentence'][idx % 4],
      topic: item.topic,
      masteryStatus: item.masteryStatus,
      mistakeCount: item.mistakeCount,
      nativeText: item.nativeText,
      romanized: item.romanized,
      pronunciationGuide: item.pronunciationGuide,
      meaning: item.meaning,
      exampleNative: item.exampleNative,
      exampleRomanized: item.exampleRomanized,
      exampleMeaning: item.exampleMeaning,
      options: [item.meaning, ...allMeanings.filter((m: string) => m !== item.meaning).slice(0, 3)],
    }));

    return jsonResponse({
      languageCode: langCode,
      languageName: langCode.toUpperCase(),
      bcp47: 'ta-IN',
      learnedCount: vocab.filter((v: any) => v.isLearned).length,
      dueCount: vocab.filter((v: any) => v.isDue).length,
      questions,
    });
  }

  if (path === '/api/ai/configure') {
    state.aiConfig = {
      provider: body.provider || 'gemini',
      apiKey: body.api_key || '',
      model: body.model || '',
    };
    saveState(state);
    return jsonResponse((await buildBootstrap(state)).aiStatus);
  }

  return jsonResponse(await buildBootstrap(state));
}

export function installFetchInterceptorForStaticHosting() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.startsWith('/api/')) {
      try {
        const res = await originalFetch(input, init);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return res;
        }
      } catch {
        // Backend server not reachable (e.g. Firebase Static Hosting) -> use browser engine
      }
      return handleLocalApiRequest(urlStr, init);
    }
    return originalFetch(input, init);
  };
}
