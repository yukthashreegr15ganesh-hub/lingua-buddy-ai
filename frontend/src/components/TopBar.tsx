import React, { useState } from 'react';
import {
  Globe,
  Flame,
  BookOpen,
  MessageCircle,
  Brain,
  BarChart3,
  Settings,
  LayoutDashboard,
  Sparkles,
  ChevronDown,
  EyeOff,
  Eye,
  Check,
  Languages,
} from 'lucide-react';
import { LanguageInfo, ExplanationLanguage, PageId, UserProfile } from '../types';

interface TopBarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  activeLanguage: LanguageInfo;
  languages: LanguageInfo[];
  explanationLanguages: ExplanationLanguage[];
  profile: UserProfile;
  onSwitchLanguage: (langCode: string) => void;
  onChangeExplanationLanguage: (expCode: string) => void;
  onToggleNativeScript: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  onNavigate,
  activeLanguage,
  languages,
  explanationLanguages,
  profile,
  onSwitchLanguage,
  onChangeExplanationLanguage,
  onToggleNativeScript,
}) => {
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const indianLangs = languages.filter(
    (l) =>
      l.region === 'Indian Languages' &&
      (l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const globalLangs = languages.filter(
    (l) =>
      l.region !== 'Indian Languages' &&
      (l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const navItems: { id: PageId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'welcome', label: 'Welcome', icon: <Globe className="w-4 h-4" /> },
    { id: 'onboarding', label: 'Onboarding', icon: <Languages className="w-4 h-4" /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'lesson', label: 'AI Learning Room', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'conversation', label: 'Conversations', icon: <MessageCircle className="w-4 h-4" /> },
    {
      id: 'vocabulary',
      label: 'Vocabulary',
      icon: <BookOpen className="w-4 h-4" />,
      badge: activeLanguage.progress.wordsLearned || undefined,
    },
    {
      id: 'quiz',
      label: 'Revision Quiz',
      icon: <Brain className="w-4 h-4" />,
      badge: activeLanguage.progress.dueForReview || activeLanguage.progress.difficultWords || undefined,
    },
    { id: 'progress', label: 'Progress', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Schedule & Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-amber-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:scale-105 transition">
              LB
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">LINGUA BUDDY</span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700">
                  Voice AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Speak & Listen First • No Forced Script
              </p>
            </div>
          </button>

          {/* Prominent Language Switcher + Explanation Language + Script Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Prominent Learning Language Switcher Button */}
            <button
              type="button"
              onClick={() => setLangModalOpen(true)}
              data-testid="language-switcher-button"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm shadow-sm transition"
            >
              <Globe className="w-4 h-4" />
              <span>Learning: {activeLanguage.name}</span>
              {profile.show_native_script && (
                <span className="opacity-90 font-normal">({activeLanguage.nativeName})</span>
              )}
              <span className="px-1.5 py-0.5 rounded-lg bg-white/20 text-[11px]">
                {activeLanguage.progress.proficiencyLevel}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* 2. Explanation Language Selector */}
            <div className="flex items-center gap-1.5 bg-amber-50/90 border border-amber-200 rounded-2xl px-2.5 py-1.5">
              <Languages className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <label htmlFor="explanation-lang-select" className="text-[11px] font-semibold text-slate-600 hidden md:inline">
                Explain in:
              </label>
              <select
                id="explanation-lang-select"
                value={profile.explanation_language}
                onChange={(e) => onChangeExplanationLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {explanationLanguages.map((el) => (
                  <option key={el.code} value={el.code}>
                    {el.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Native Script Optional Toggle */}
            <button
              type="button"
              onClick={onToggleNativeScript}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition ${
                profile.show_native_script
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
              title="Toggle optional native alphabet/script visibility. Default is Roman pronunciation only."
            >
              {profile.show_native_script ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Script: Shown</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Roman Only (No Script)</span>
                </>
              )}
            </button>

            {/* 4. Active Language Streak Pill */}
            <div
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold"
              title={`${activeLanguage.name} learning streak`}
            >
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>{activeLanguage.progress.streakDays}d</span>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="max-w-7xl mx-auto px-4 py-1.5 border-t border-amber-100 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-amber-100/70 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white text-orange-700' : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Instant Language Switching Modal */}
      {langModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-amber-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Switch Learning Language Instantly
                </h2>
                <p className="text-xs text-orange-50 mt-0.5">
                  Every language saves its own vocabulary, streak, lessons, and revision schedule independently.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="p-4 border-b border-amber-100 bg-amber-50/40 flex flex-wrap items-center justify-between gap-3">
              <input
                type="text"
                placeholder="Search 25+ languages (e.g. Tamil, Telugu, Kannada, Tulu, Konkani, Japanese...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="text-xs text-slate-600 font-medium">
                Currently learning: <strong className="text-orange-700">{activeLanguage.name}</strong>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Indian Languages Section */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-orange-700 mb-3 flex items-center gap-2">
                  <span>Indian Languages ({indianLangs.length})</span>
                  <span className="h-px flex-1 bg-orange-200" />
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {indianLangs.map((lang) => {
                    const isCurrent = lang.code === activeLanguage.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          onSwitchLanguage(lang.code);
                          setLangModalOpen(false);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/50'
                            : 'bg-white hover:bg-amber-50/60 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                              <span>{lang.name}</span>
                              {isCurrent && <Check className="w-4 h-4 text-orange-600" />}
                            </div>
                            <div className="text-xs text-slate-500">{lang.nativeName}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900">
                            {lang.progress.proficiencyLevel}
                          </span>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                          <span>{lang.progress.wordsLearned} words learned</span>
                          <span>{lang.progress.completedLessons} lessons</span>
                          {lang.progress.streakDays > 0 && (
                            <span className="text-orange-600 font-bold">🔥 {lang.progress.streakDays}d</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Global Languages Section */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                  <span>Global Languages ({globalLangs.length})</span>
                  <span className="h-px flex-1 bg-indigo-200" />
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {globalLangs.map((lang) => {
                    const isCurrent = lang.code === activeLanguage.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          onSwitchLanguage(lang.code);
                          setLangModalOpen(false);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-400/50'
                            : 'bg-white hover:bg-indigo-50/40 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                              <span>{lang.name}</span>
                              {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
                            </div>
                            <div className="text-xs text-slate-500">{lang.nativeName}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-900">
                            {lang.progress.proficiencyLevel}
                          </span>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                          <span>{lang.progress.wordsLearned} words learned</span>
                          <span>{lang.progress.completedLessons} lessons</span>
                          {lang.progress.streakDays > 0 && (
                            <span className="text-orange-600 font-bold">🔥 {lang.progress.streakDays}d</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
