import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Turtle,
  Send,
  PlayCircle,
  Save,
  Sparkles,
  CheckCircle2,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';
import {
  ConversationScenario,
  LanguageInfo,
  UserProfile,
  CharacterState,
  AIStatus,
} from '../types';
import { Buddy3D } from './Buddy3D';
import { speakPhrase, startSpeechRecognition } from '../services/speech';

interface ConversationRoomProps {
  scenarios: ConversationScenario[];
  activeLanguage: LanguageInfo;
  profile: UserProfile;
  aiStatus: AIStatus;
  recentConversations: any[];
  characterState: CharacterState;
  setCharacterState: (st: CharacterState) => void;
  onConversationsUpdated: (list: any[]) => void;
}

interface DialogueMessage {
  speaker: 'buddy' | 'user';
  romanized: string;
  native?: string;
  pronunciationGuide?: string;
  meaning?: string;
  correction?: {
    gentleNote: string;
    naturalRomanized: string;
    naturalNative: string;
    pronunciationGuide: string;
    meaning: string;
  } | null;
}

export const ConversationRoom: React.FC<ConversationRoomProps> = ({
  scenarios,
  activeLanguage,
  profile,
  aiStatus,
  recentConversations,
  characterState,
  setCharacterState,
  onConversationsUpdated,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<ConversationScenario>(
    scenarios[0]
  );
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [responseHints, setResponseHints] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [stopMicFn, setStopMicFn] = useState<(() => void) | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [replayingAll, setReplayingAll] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  // Start or reset conversation when scenario or language changes
  useEffect(() => {
    startScenarioDialogue(selectedScenario);
  }, [selectedScenario.id, activeLanguage.code, profile.explanation_language]);

  const startScenarioDialogue = async (sc: ConversationScenario) => {
    setSavedBanner(false);
    setCharacterState('GREETING');
    try {
      const res = await fetch('/api/conversation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: activeLanguage.code,
          explanation_language: profile.explanation_language,
          proficiency_level: activeLanguage.progress.proficiencyLevel,
          scenario_id: sc.id,
          user_message: '',
          turn_index: 0,
          history: [],
        }),
      });
      const data = await res.json();
      setMessages([
        {
          speaker: 'buddy',
          romanized: data.tutorRomanized,
          native: data.tutorNative,
          pronunciationGuide: data.tutorPronunciationGuide,
          meaning: data.tutorMeaning,
          correction: null,
        },
      ]);
      setResponseHints(data.responseHints || []);
      speakPhrase({
        nativeText: data.tutorNative,
        romanizedText: data.tutorRomanized,
        bcp47: activeLanguage.bcp47,
        speed: profile.speaking_speed,
        speechSupportLevel: activeLanguage.speechSupportLevel,
        onStart: () => setCharacterState('SPEAKING'),
        onEnd: () => setCharacterState('IDLE'),
      });
    } catch {
      setCharacterState('IDLE');
    }
  };

  const handleSendUserTurn = async (overrideText?: string) => {
    const text = (overrideText ?? userInput).trim();
    if (!text) return;

    const updatedWithUser: DialogueMessage[] = [
      ...messages,
      { speaker: 'user', romanized: text },
    ];
    setMessages(updatedWithUser);
    setUserInput('');
    setCharacterState('THINKING');

    try {
      const turnIdx = Math.ceil(updatedWithUser.length / 2);
      const res = await fetch('/api/conversation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: activeLanguage.code,
          explanation_language: profile.explanation_language,
          proficiency_level: activeLanguage.progress.proficiencyLevel,
          scenario_id: selectedScenario.id,
          user_message: text,
          turn_index: turnIdx,
          history: updatedWithUser,
        }),
      });
      const data = await res.json();
      const buddyReply: DialogueMessage = {
        speaker: 'buddy',
        romanized: data.tutorRomanized,
        native: data.tutorNative,
        pronunciationGuide: data.tutorPronunciationGuide,
        meaning: data.tutorMeaning,
        correction: data.correction || null,
      };
      setMessages((prev) => [...prev, buddyReply]);
      setResponseHints(data.responseHints || []);
      setCharacterState(data.characterState || 'SPEAKING');

      speakPhrase({
        nativeText: data.tutorNative,
        romanizedText: data.tutorRomanized,
        bcp47: activeLanguage.bcp47,
        speed: profile.speaking_speed,
        speechSupportLevel: activeLanguage.speechSupportLevel,
        onStart: () => setCharacterState('SPEAKING'),
        onEnd: () => setCharacterState('IDLE'),
      });
    } catch {
      setCharacterState('IDLE');
    }
  };

  const handleToggleMic = () => {
    if (isListening && stopMicFn) {
      stopMicFn();
      setIsListening(false);
      setCharacterState('IDLE');
      return;
    }

    setMicNotice(null);
    setIsListening(true);
    setCharacterState('LISTENING');

    const stop = startSpeechRecognition({
      bcp47: activeLanguage.bcp47,
      preferRomanFallback: true,
      onInterim: (interim) => setUserInput(interim),
      onFinal: (finalText) => {
        setUserInput(finalText);
        setIsListening(false);
        handleSendUserTurn(finalText);
      },
      onError: (err) => {
        setMicNotice(err);
        setIsListening(false);
        setCharacterState('ENCOURAGING');
      },
      onEnd: () => setIsListening(false),
    });
    setStopMicFn(() => stop);
  };

  // Conversation Replay Feature (Section 10)
  const handleReplayConversation = (dialogueList: DialogueMessage[]) => {
    if (replayingAll || dialogueList.length === 0) return;
    setReplayingAll(true);
    let idx = 0;

    const playNext = () => {
      if (idx >= dialogueList.length) {
        setReplayingAll(false);
        setCharacterState('IDLE');
        return;
      }
      const msg = dialogueList[idx];
      idx += 1;
      speakPhrase({
        nativeText: msg.native || msg.romanized,
        romanizedText: msg.romanized,
        bcp47: activeLanguage.bcp47,
        speed: profile.speaking_speed,
        speechSupportLevel: activeLanguage.speechSupportLevel,
        onStart: () => setCharacterState('SPEAKING'),
        onEnd: () => setTimeout(playNext, 450),
      });
    };

    playNext();
  };

  const handleSaveConversation = async () => {
    const correctionsCount = messages.filter((m) => m.correction).length;
    const res = await fetch('/api/conversation/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language_code: activeLanguage.code,
        scenario_id: selectedScenario.id,
        scenario_title: selectedScenario.title,
        proficiency_level: activeLanguage.progress.proficiencyLevel,
        messages,
        corrections_count: correctionsCount,
      }),
    });
    const data = await res.json();
    if (data.recentConversations) {
      onConversationsUpdated(data.recentConversations);
    }
    setSavedBanner(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & AI Mode Honesty Banner */}
      <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
            15 Real-Life Situations • {activeLanguage.name} ({activeLanguage.progress.proficiencyLevel})
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Real-Life Conversation Practice
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Speak naturally with Buddy. Receive gentle corrections without grammar lectures interrupting your flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold border ${
              aiStatus.liveAiConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {aiStatus.provider}
          </span>
        </div>
      </div>

      {/* 15 Scenarios Horizontal / Grid Picker */}
      <div className="bg-white rounded-3xl p-4 border border-amber-200/80 shadow-sm">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
          Select a Real-World Scenario (All 15 Situations Available)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1">
          {scenarios.map((sc) => {
            const active = sc.id === selectedScenario.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedScenario(sc)}
                className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                  active
                    ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white border-orange-500 shadow-sm'
                    : 'bg-amber-50/40 hover:bg-amber-100/60 border-amber-200/70 text-slate-800'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80">
                  #{sc.number} • {sc.difficulty}
                </div>
                <div className="font-extrabold text-xs mt-0.5 leading-snug">{sc.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Conversation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 3D Buddy & Replay Controls */}
        <div className="lg:col-span-4 space-y-4">
          <Buddy3D
            state={characterState}
            languageName={activeLanguage.name}
            speechBubble={
              messages.filter((m) => m.speaker === 'buddy').slice(-1)[0]?.romanized ||
              `Let's practice: ${selectedScenario.title}`
            }
            subText={`${selectedScenario.title} — ${selectedScenario.setting}`}
            onSelectState={setCharacterState}
          />

          {/* Conversation Replay & Save Controls */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-sm space-y-2.5">
            <div className="text-xs font-extrabold text-slate-800">
              Conversation Replay & History
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleReplayConversation(messages)}
                disabled={replayingAll}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold text-xs transition"
              >
                <PlayCircle className="w-4 h-4" />
                {replayingAll ? 'Replaying Audio...' : 'Replay Dialogue'}
              </button>
              <button
                type="button"
                onClick={handleSaveConversation}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
              >
                <Save className="w-4 h-4" />
                Save Session
              </button>
            </div>
            {savedBanner && (
              <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved to your {activeLanguage.name} conversation log!
              </div>
            )}

            {recentConversations.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500">
                  Saved {activeLanguage.name} Replays:
                </div>
                {recentConversations.slice(0, 3).map((rc) => (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => {
                      if (rc.messages && rc.messages.length > 0) {
                        setMessages(rc.messages);
                        handleReplayConversation(rc.messages);
                      }
                    }}
                    className="w-full p-2 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 text-left text-xs flex items-center justify-between"
                  >
                    <span className="font-bold text-slate-700 truncate">{rc.scenario_title}</span>
                    <span className="text-[10px] text-orange-600 font-bold">Replay ({rc.turns_count} turns)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Dialogue Stream, Gentle Corrections & Voice Input */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-5 sm:p-6 border border-amber-200/90 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-amber-100 pb-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Scenario #{selectedScenario.number}: {selectedScenario.title}
              </h2>
              <p className="text-xs text-slate-500">{selectedScenario.description}</p>
            </div>
            <button
              type="button"
              onClick={() => startScenarioDialogue(selectedScenario)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>
          </div>

          {/* Messages Stream */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {messages.map((msg, idx) => (
              <div key={idx} className="space-y-2">
                <div
                  className={`p-4 rounded-3xl max-w-[88%] ${
                    msg.speaker === 'buddy'
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 text-slate-900'
                      : 'bg-orange-600 text-white ml-auto'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold opacity-80">
                    <span>
                      {msg.speaker === 'buddy' ? `Buddy (${activeLanguage.name})` : 'You (Spoken / Romanized)'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          speakPhrase({
                            nativeText: msg.native || msg.romanized,
                            romanizedText: msg.romanized,
                            bcp47: activeLanguage.bcp47,
                            speed: profile.speaking_speed,
                            speechSupportLevel: activeLanguage.speechSupportLevel,
                            onStart: () => setCharacterState('SPEAKING'),
                            onEnd: () => setCharacterState('IDLE'),
                          })
                        }
                        className="px-2 py-0.5 rounded-lg bg-black/10 hover:bg-black/20 flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          speakPhrase({
                            nativeText: msg.native || msg.romanized,
                            romanizedText: msg.romanized,
                            bcp47: activeLanguage.bcp47,
                            speed: 0.65,
                            speechSupportLevel: activeLanguage.speechSupportLevel,
                            onStart: () => setCharacterState('SPEAKING'),
                            onEnd: () => setCharacterState('IDLE'),
                          })
                        }
                        className="px-2 py-0.5 rounded-lg bg-black/10 hover:bg-black/20 flex items-center gap-1"
                      >
                        <Turtle className="w-3 h-3" />
                        Slow
                      </button>
                    </div>
                  </div>

                  {/* Easy Roman Pronunciation First */}
                  <div className="text-base sm:text-lg font-extrabold mt-1">{msg.romanized}</div>

                  {msg.pronunciationGuide && (
                    <div className="text-xs font-semibold text-orange-700 mt-0.5">
                      Syllables: [{msg.pronunciationGuide}]
                    </div>
                  )}

                  {/* Optional Native Script */}
                  {profile.show_native_script && msg.native && (
                    <div className="text-sm font-medium opacity-85 mt-1">{msg.native}</div>
                  )}

                  {/* Meaning in Explanation Language */}
                  {msg.meaning && (
                    <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-amber-200/60">
                      <strong>Meaning:</strong> {msg.meaning}
                    </div>
                  )}
                </div>

                {/* 5-Part Gentle Correction Card (Section 10) */}
                {msg.correction && (
                  <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs space-y-1.5 ml-4">
                    <div className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      1. Gentle Tip: {msg.correction.gentleNote}
                    </div>
                    <div className="text-slate-800">
                      <strong>2. Natural Way to Say It:</strong>{' '}
                      <span className="font-extrabold text-indigo-700">
                        {msg.correction.naturalRomanized}
                      </span>
                      {profile.show_native_script && ` (${msg.correction.naturalNative})`}
                    </div>
                    <div className="text-slate-700">
                      <strong>3. Easy Pronunciation Guide:</strong> [{msg.correction.pronunciationGuide}]
                    </div>
                    <div className="text-slate-700">
                      <strong>4. Meaning:</strong> {msg.correction.meaning}
                    </div>
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          speakPhrase({
                            nativeText: msg.correction!.naturalNative,
                            romanizedText: msg.correction!.naturalRomanized,
                            bcp47: activeLanguage.bcp47,
                            speed: 0.75,
                            speechSupportLevel: activeLanguage.speechSupportLevel,
                            onStart: () => setCharacterState('SPEAKING'),
                            onEnd: () => setCharacterState('IDLE'),
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold"
                      >
                        Listen & Practice
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserInput(msg.correction!.naturalRomanized)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-bold"
                      >
                        5. Try Saying It Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Suggested Spoken Responses (Click to Hear or Speak) */}
          {responseHints.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <div className="text-[11px] font-extrabold uppercase text-orange-800">
                Suggested Spoken Replies (Tap to Listen or Use):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {responseHints.map((hint, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white border border-amber-200 flex flex-col justify-between gap-1.5"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{hint.romanized}</div>
                      <div className="text-[11px] text-slate-500">{hint.meaning}</div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          speakPhrase({
                            nativeText: hint.native,
                            romanizedText: hint.romanized,
                            bcp47: activeLanguage.bcp47,
                            speed: profile.speaking_speed,
                            speechSupportLevel: activeLanguage.speechSupportLevel,
                            onStart: () => setCharacterState('SPEAKING'),
                            onEnd: () => setCharacterState('IDLE'),
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        Hear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendUserTurn(hint.romanized)}
                        className="px-2 py-1 rounded-lg bg-orange-600 text-white text-[11px] font-bold flex-1 text-center"
                      >
                        Say This
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voice-First Mic & Roman Text Input Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleToggleMic}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm shadow-sm transition ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Listening...' : 'Speak Reply'}</span>
            </button>

            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendUserTurn();
              }}
              placeholder={`Speak or type your ${activeLanguage.name} reply in Roman letters...`}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <button
              type="button"
              onClick={() => handleSendUserTurn()}
              className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>

          {micNotice && <div className="text-xs text-amber-800 font-medium">{micNotice}</div>}
        </div>
      </div>
    </div>
  );
};
