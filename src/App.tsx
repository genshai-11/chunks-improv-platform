import { useState, useEffect } from 'react';
import SetupPresenter from './components/SetupPresenter';
import StagePresenter from './components/StagePresenter';
import { SessionConfig, CueItem, NineRouterConfig } from './types';
import { Sparkles, RefreshCw, AlertTriangle, Play, HelpCircle, Sun, Moon } from 'lucide-react';

export default function App() {
  const [activeConfig, setActiveConfig] = useState<SessionConfig | null>(null);
  const [ttsMode, setTtsMode] = useState<'local' | 'gemini' | 'silent' | '9router'>('9router');
  const [stageCues, setStageCues] = useState<CueItem[]>([]);
  const [isGeneratingInitial, setIsGeneratingInitial] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("Contacting server...");
  const [error, setError] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Dynamic Theme (Light vs. Black)
  const [theme, setTheme] = useState<'black' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'black') {
        return saved;
      }
    } catch (e) {}
    return 'black';
  });

  const toggleTheme = () => {
    const next = theme === 'black' ? 'light' : 'black';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  const [nineRouterConfig, setNineRouterConfig] = useState<NineRouterConfig>(() => {
    try {
      const saved = localStorage.getItem('nineRouterConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          enabled: parsed.enabled ?? true,
          url: parsed.url || "http://localhost:20128",
          apiKey: parsed.apiKey || "",
          llmModel: parsed.llmModel || "openai/gpt-4o",
          sttModel: parsed.sttModel || "openai/whisper-1",
          ttsModelVi: parsed.ttsModelVi || "edge-tts/vi-VN-HoaiMyNeural",
          ttsModelEn: parsed.ttsModelEn || "edge-tts/en-US-AriaNeural"
        };
      }
    } catch (e) {
      // Ignored
    }
    return {
      enabled: true,
      url: "http://localhost:20128",
      apiKey: "",
      llmModel: "openai/gpt-4o",
      sttModel: "openai/whisper-1",
      ttsModelVi: "edge-tts/vi-VN-HoaiMyNeural",
      ttsModelEn: "edge-tts/en-US-AriaNeural"
    };
  });

  const handleUpdateNineRouterConfig = (newConfig: NineRouterConfig) => {
    setNineRouterConfig(newConfig);
    localStorage.setItem('nineRouterConfig', JSON.stringify(newConfig));
  };

  // Helper function to cache audio content before beginning the active presentation rounds
  const preloadAudioForCues = async (cuesToPreload: CueItem[], selectedTts: string, lang: string) => {
    if (selectedTts === 'silent' || selectedTts === 'local') {
      setAudioCache({});
      return;
    }

    setLoadingStep("Warm-starting high fidelity synthesized voice buffer...");
    const cache: Record<string, string> = {};
    let loadedCount = 0;

    await Promise.all(
      cuesToPreload.map(async (cue) => {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cue.text,
              language: lang,
              ttsMode: selectedTts,
              nineRouterConfig: nineRouterConfig
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.audio) {
              cache[cue.id] = data.audio;
              cache[cue.text] = data.audio;
            }
          }
        } catch (err) {
          console.warn("Failed pre_synthesizing clip for cue Text:", cue.text, err);
        } finally {
          loadedCount++;
          setLoadingStep(`Preloaded audio voice sequence: "${cue.text}" (${loadedCount}/${cuesToPreload.length})`);
        }
      })
    );

    setAudioCache(cache);
  };

  // Trigger when starting a room
  const handleStartSession = async (
    config: SessionConfig, 
    selectedTtsMode: 'local' | 'gemini' | 'silent' | '9router',
    preloadedCues?: CueItem[]
  ) => {
    setActiveConfig(config);
    setTtsMode(selectedTtsMode);
    setIsGeneratingInitial(true);
    setError(null);

    // If preloaded/persisted cues already exist from library or local visual constructor, bypass LLM latency
    if (preloadedCues && preloadedCues.length > 0) {
      setLoadingStep("Loading direct lesson from custom database workspace...");
      try {
        setStageCues(preloadedCues);
        await preloadAudioForCues(preloadedCues, selectedTtsMode, config.language);
      } catch (err: any) {
        console.warn("Direct voice caching reported an exception:", err);
      } finally {
        setIsGeneratingInitial(false);
      }
      return;
    }

    setLoadingStep("Invoking Generative Cues for topic...");

    try {
      // Create primary pool of cues
      const response = await fetch('/api/cue/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: config.topic,
          wordType: config.wordType,
          level: config.level,
          language: config.language,
          count: 6, // Prefetch 6 primary items
          nineRouterConfig: nineRouterConfig // Passthrough model configs seamlessly
        })
      });

      if (!response.ok) {
        throw new Error("Unable to establish communication with background generation server.");
      }

      setLoadingStep("Synthesizing primary buffers...");
      const data = await response.json();
      
      if (!data.cues || data.cues.length === 0) {
        throw new Error("Generative server returned blank cue array.");
      }

      setStageCues(data.cues);
      await preloadAudioForCues(data.cues, selectedTtsMode, config.language);
      setIsGeneratingInitial(false);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 
        "Something went wrong while communicating with the generative server. You can still proceed using robust offline fallback backups instantly."
      );
      setIsGeneratingInitial(false);
    }
  };


  // Provide immediate bypass if API is slow or offline
  const handleProceedWithFallbacks = () => {
    if (!activeConfig) return;
    
    // Create reliable inline presets immediately
    const lang = activeConfig.language;
    const backupCues: CueItem[] = lang === 'vi' ? [
      { id: 'b1', text: "Robot thông minh", translation: "Smart robot", hint: "Nếu robot biết đi chợ nấu ăn hộ gia đình, bạn sẽ nhờ nó làm gì đầu tiên?" },
      { id: 'b2', text: "Chuyến du hành vũ trụ", translation: "Space travel", hint: "Miêu tả hành tinh bạn tự mình chế tạo bằng trí tưởng tượng." },
      { id: 'b3', text: "Kính viễn vọng kỳ diệu", translation: "Magic telescope", hint: "Bạn nhìn qua kính và bất ngờ thấy năm 3000 đang xảy ra việc gì?" },
      { id: 'b4', text: "Chú mèo biết nói", translation: "Talking cat", hint: "Chú mèo nhà bạn đột nhiên bảo: 'Dậy dọn nhà đi sen'. Bạn nói lại thế nào?" },
      { id: 'b5', text: "Bữa tiệc dưới biển cổ đại", translation: "Ancient underwater party", hint: "Món ăn gì được phục vụ tại cung điện này?" }
    ] : [
      { id: 'b1_en', text: "Flying skateboard", translation: "Ván trượt bay", hint: "You just did research on flying items. Explain how this skateboard works to your friend." },
      { id: 'b2_en', text: "Island of secrets", translation: "Hòn đảo bí mật", hint: "You reached an abandoned island. You saw a giant glowing locker. What is inside?" },
      { id: 'b3_en', text: "Pet companion droid", translation: "Người bạn robot thú cưng", hint: "How does your pet droid help you with your speaking studies?" },
      { id: 'b4_en', text: "Time shift bracelet", translation: "Vòng đeo thời gian", hint: "Pressing the item shifts you 1 hour back. What would you change right now?" }
    ];

    setStageCues(backupCues);
    setError(null);
  };

  // Turn off current runtime and back to setup cockpit console
  const handleStopSession = () => {
    setActiveConfig(null);
    setStageCues([]);
    setAudioCache({});
    setError(null);
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col justify-between selection:bg-red-500/20 selection:text-red-350 transition-colors duration-300 ${
      theme === 'black' 
        ? 'bg-[#050303] text-slate-100' 
        : 'bg-slate-50 text-slate-800'
    }`}>
      
      {/* Universal Sticky Top Navigation Header */}
      <header className={`border-b sticky top-0 z-50 py-3 px-6 shadow-md transition-all backdrop-blur-md ${
        theme === 'black'
          ? 'border-neutral-900 bg-[#0C0606]/95'
          : 'border-slate-200 bg-white/95'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div onClick={handleStopSession} className="cursor-pointer flex items-center gap-3 active:opacity-80 transition-all select-none col-span-3">
            <span className="text-2xl">🎭</span>
            <div>
              <span className={`font-display font-black tracking-tight text-base block ${
                theme === 'black' ? 'text-white' : 'text-slate-900'
              }`}>
                Chunks Improv <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent font-serif font-semibold italic">Stage</span>
              </span>
              <span className={`text-[9px] font-bold block leading-none tracking-widest mt-0.5 uppercase ${
                theme === 'black' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Motion • Sound • Emotion
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Real-time Theme Mode Switcher */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                theme === 'black'
                  ? 'bg-neutral-950 border-neutral-900 text-amber-400 hover:text-amber-300 hover:bg-neutral-900'
                  : 'bg-white border-slate-200 text-indigo-600 hover:text-indigo-500 hover:bg-slate-50 shadow-sm'
              }`}
              title={theme === 'black' ? 'Switch to Gallery Light Design' : 'Switch to Ultra Black Design'}
            >
              {theme === 'black' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {activeConfig && (
              <button
                onClick={handleStopSession}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95"
              >
                End Stage
              </button>
            )}

            <div className={`hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1.5 ${
              theme === 'black' 
                ? 'bg-neutral-950 border border-neutral-900 text-slate-400' 
                : 'bg-slate-100 border border-slate-200 text-slate-500'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>Classroom HUD v2</span>
            </div>
          </div>
        </div>
      </header>

      {/* Primary Area Container */}
      <main className="flex-1 flex flex-col justify-center py-6">
        
        {/* Error Notice in Setup Stage */}
        {error && !activeConfig && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex gap-3 items-start animate-fade-in shadow-md">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="space-y-1">
              <p className="font-bold text-slate-250">System Connection Notice</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* 1. SETUP COCKPIT VIEW */}
        {!activeConfig && !isGeneratingInitial && (
          <SetupPresenter 
            onStart={handleStartSession} 
            nineRouterConfig={nineRouterConfig}
            onUpdateNineRouter={handleUpdateNineRouterConfig}
            theme={theme}
          />
        )}

        {/* 2. LIVE CUE TRANSITIONING / LOADING STATE */}
        {isGeneratingInitial && (
          <div className="text-center py-16 px-4 space-y-6 max-w-lg mx-auto animate-scale-up">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xl ${
              theme === 'black' 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'bg-amber-500/5 text-amber-600 border border-amber-200'
            }`}>
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className={`text-2xl font-display font-extrabold tracking-tight ${
                theme === 'black' ? 'text-white' : 'text-slate-900'
              }`}>Assembling Vocal Cue Buffers...</h2>
              <p className={`${theme === 'black' ? 'text-slate-400' : 'text-slate-600'} text-xs font-semibold font-mono`}>
                {loadingStep}
              </p>
            </div>

            <p className={`text-xs max-w-sm mx-auto leading-relaxed ${
              theme === 'black' ? 'text-slate-500' : 'text-slate-450'
            }`}>
              Synthesizing random speaking cues and loading active parameters in a hidden buffer. This guarantees lag-free speech synthesis performance throughout class play.
            </p>

            <button
              onClick={handleProceedWithFallbacks}
              className={`px-5 py-2.5 border rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
                theme === 'black'
                  ? 'bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
            >
              Skip buffering & Run Backups instantly ⚡
            </button>
          </div>
        )}

        {/* 3. DUAL-STAGE ERROR LOADING RECOVERY PLAN */}
        {error && activeConfig && stageCues.length === 0 && (
          <div className={`max-w-2xl mx-auto my-8 p-8 rounded-3xl shadow-2xl space-y-6 text-center animate-scale-up border ${
            theme === 'black' 
              ? 'bg-[#140A0A] border-slate-900' 
              : 'bg-white border-slate-200'
          }`}>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-450 flex items-center justify-center mx-auto border border-amber-500/20">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className={`text-xl font-extrabold ${theme === 'black' ? 'text-white' : 'text-slate-900'}`}>
                Stage Setup Handshake Exhausted
              </h3>
              <p className={`text-sm max-w-md mx-auto leading-relaxed ${theme === 'black' ? 'text-slate-400' : 'text-slate-600'}`}>
                {error}
              </p>
            </div>

            <div className={`border p-5 rounded-2xl text-left space-y-2 text-xs ${
              theme === 'black' 
                ? 'bg-slate-950/60 border-slate-900 text-slate-400' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <p className={`font-bold ${theme === 'black' ? 'text-slate-300' : 'text-slate-800'}`}>Classroom Resiliency Engine</p>
              <p className="leading-relaxed">
                Gemini rate-limits on TTS quota can happen during quick speaking rounds. In accordance with Chunks theory, we have prepared robust, pre-cached prompt sequences so your speaking exercise starts instant and feels completely seamless.
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleStopSession}
                className={`px-5 py-3 border rounded-xl text-xs font-semibold cursor-pointer ${
                  theme === 'black' 
                    ? 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Back to Controls console
              </button>
              <button
                onClick={handleProceedWithFallbacks}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Trigger Backup prompts now ⚡</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. ACTIVE LIVE PACING PLAYBACK STAGE SCREEN */}
        {activeConfig && stageCues.length > 0 && (
          <StagePresenter 
            config={activeConfig} 
            ttsMode={ttsMode} 
            initialCues={stageCues} 
            nineRouterConfig={nineRouterConfig}
            audioCache={audioCache}
            theme={theme}
            onStop={handleStopSession} 
          />
        )}

      </main>

      {/* Elegant minimalist theatrical footer */}
      <footer className={`py-4 border-t text-center text-[10px] font-bold uppercase tracking-wider ${
        theme === 'black' 
          ? 'border-neutral-900 bg-neutral-950/40 text-slate-600' 
          : 'border-slate-200 bg-slate-100 text-slate-400'
      }`}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Chunks Improv Stage • Realized with 🧠 Chunks Theory speaking loops</span>
          <span className={theme === 'black' ? 'text-slate-700' : 'text-slate-400'}>Motion • Sound • Emotion v2</span>
        </div>
      </footer>

    </div>
  );
}
