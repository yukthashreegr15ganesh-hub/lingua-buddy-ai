export type CharacterState =
  | 'IDLE'
  | 'GREETING'
  | 'LISTENING'
  | 'SPEAKING'
  | 'THINKING'
  | 'HAPPY'
  | 'ENCOURAGING'
  | 'CORRECTING'
  | 'FAREWELL';

export type PageId =
  | 'welcome'
  | 'onboarding'
  | 'dashboard'
  | 'lesson'
  | 'conversation'
  | 'vocabulary'
  | 'quiz'
  | 'progress'
  | 'settings';

export interface UserProfile {
  id: number;
  learner_name: string;
  active_language: string;
  explanation_language: string;
  learning_reason: string;
  daily_duration_minutes: number;
  preferred_time: string;
  scheduled_days: string[];
  reminder_enabled: boolean;
  speaking_speed: number;
  show_native_script: boolean;
  onboarding_completed: boolean;
  updated_at?: string;
}

export interface LanguageProgress {
  proficiencyLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  understandingComfort: string;
  completedLessons: number;
  totalMinutes: number;
  streakDays: number;
  lastActiveDate: string;
  dailyMinutesToday: number;
  wordsLearned: number;
  wordsMastered: number;
  difficultWords: number;
  dueForReview: number;
}

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  bcp47: string;
  wordOrder: string;
  speechSupportLevel: 'full' | 'partial' | 'phonetic-fallback';
  speechNotes: string;
  culturalNote: string;
  curriculumCount: number;
  progress: LanguageProgress;
}

export interface ExplanationLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export interface VocabItem {
  id: string;
  conceptKey: string;
  topic: string;
  level: string;
  nativeText: string;
  romanized: string;
  pronunciationGuide: string;
  meaning: string;
  meanings: Record<string, string>;
  exampleNative: string;
  exampleRomanized: string;
  exampleMeaning: string;
  grammarNote: string;
  lastPracticedAt?: string | null;
  successfulRecalls: number;
  mistakeCount: number;
  nextReviewAt?: string | null;
  intervalDays: number;
  masteryStatus: 'new' | 'learning' | 'review_due' | 'difficult' | 'mastered';
  isLearned: boolean;
  isDue: boolean;
}

export interface ConversationScenario {
  id: string;
  number: number;
  title: string;
  category: string;
  difficulty: string;
  icon: string;
  description: string;
  setting: string;
}

export interface MemoryTestQuestion {
  id: string;
  wordId: string;
  questionType: 'spoken_response' | 'meaning_recall' | 'listening_comprehension' | 'sentence_completion';
  prompt: string;
  targetRomanized: string;
  targetNative: string;
  pronunciationGuide: string;
  correctMeaning: string;
  options: string[];
  hint: string;
}

export interface LessonPhase {
  id: 'revision' | 'vocabulary' | 'sentences' | 'conversation' | 'memory_test';
  phaseNumber: number;
  title: string;
  minuteRange: string;
  description: string;
  items?: VocabItem[];
  scenario?: ConversationScenario;
  questions?: MemoryTestQuestion[];
}

export interface LessonPlan {
  languageCode: string;
  languageName: string;
  nativeName: string;
  bcp47: string;
  speechSupportLevel: string;
  speechNotes: string;
  culturalNote: string;
  proficiencyLevel: string;
  durationMinutes: number;
  isFirstLesson: boolean;
  phases: LessonPhase[];
}

export interface EvaluationResult {
  isCorrect: boolean;
  similarityScore: number;
  evaluationMethod: string;
  characterState: CharacterState;
  userSaid: string;
  targetRomanized: string;
  targetNative: string;
  pronunciationGuide: string;
  targetMeaning: string;
  matchedWords: string[];
  missedWords: string[];
  feedback: string;
  detailedNote?: string;
}

export interface AIStatus {
  liveAiConfigured: boolean;
  provider: string;
  model: string;
  mode: 'live_llm' | 'local_fallback';
  message: string;
  setupInstructions?: string | null;
}

export interface BootstrapData {
  profile: UserProfile;
  activeLanguage: LanguageInfo;
  languages: LanguageInfo[];
  explanationLanguages: ExplanationLanguage[];
  topics: string[];
  scenarios: ConversationScenario[];
  vocabulary: VocabItem[];
  recentLessons: any[];
  recentConversations: any[];
  aiStatus: AIStatus;
}
