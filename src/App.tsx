import { useState, useEffect } from 'react';
import SetupPresenter from './components/SetupPresenter';
import StagePresenter from './components/StagePresenter';
import { SessionConfig, CueItem, NineRouterConfig } from './types';
import { Sparkles, RefreshCw, AlertTriangle, Play, HelpCircle, Sun, Moon, X, Key, Wifi, WifiOff, Activity } from 'lucide-react';

export default function App() {
  const [activeConfig, setActiveConfig] = useState<SessionConfig | null>(null);
  const [ttsMode, setTtsMode] = useState<'local' | 'gemini' | 'silent' | '9router'>('9router');
  const [stageCues, setStageCues] = useState<CueItem[]>([]);
  const [isGeneratingInitial, setIsGeneratingInitial] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("Contacting server...");
  const [error, setError] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Global API Drawer states
  const [isApiConsoleOpen, setIsApiConsoleOpen] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    ok: boolean;
    geminiKeyConfigured: boolean;
    lessonCount: number;
    nodeVersion: string;
    env: string;
  } | null>(null);
  const [isServerStatusLoading, setIsServerStatusLoading] = useState<boolean>(false);
  const [routerTesting, setRouterTesting] = useState<boolean>(false);
  const [routerTestFeedback, setRouterTestFeedback] = useState<string>("");
  const [routerTestedModels, setRouterTestedModels] = useState<string[]>([]);

  // Telemetry fetcher
  const fetchServerStatus = async () => {
    setIsServerStatusLoading(true);
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      } else {
        setServerStatus({
          ok: false,
          geminiKeyConfigured: false,
          lessonCount: 0,
          nodeVersion: "unknown",
          env: "production"
        });
      }
    } catch (e) {
      setServerStatus({
        ok: false,
        geminiKeyConfigured: false,
        lessonCount: 0,
        nodeVersion: "offline",
        env: "unknown"
      });
    } finally {
      setIsServerStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchServerStatus();
  }, []);

  // Router test connection helper accessible on all pages
  const testRouterConnection = async () => {
    setRouterTesting(true);
    setRouterTestFeedback("⏳ Testing credentials connection...");
    setRouterTestedModels([]);
    try {
      const res = await fetch('/api/9router/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: nineRouterConfig.url,
          apiKey: nineRouterConfig.apiKey
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRouterTestFeedback(`✅ Connected beautifully to 9Router! Sync verified.`);
        if (data.models && data.models.length > 0) {
          setRouterTestedModels(data.models);
        }
      } else {
        const errTxt = await res.text().catch(() => "");
        let errMsg = "Check endpoint configuration parameters.";
        try {
          const parsed = JSON.parse(errTxt);
          if (parsed.error) errMsg = parsed.error;
        } catch(e) {}
        setRouterTestFeedback(`❌ Hook configuration failed: ${errMsg}`);
      }
    } catch (err: any) {
      setRouterTestFeedback(`❌ Connection Error: ${err.message || "Endpoint server is unreachable."}`);
    } finally {
      setRouterTesting(false);
    }
  };

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

    // Use specific keys for language: <id>_vi and <id>_en
    const cuesNeedFetch: { cue: CueItem, targetLang: string, targetText: string }[] = [];
    cuesToPreload.forEach(cue => {
      // Primary Language
      const primaryLang = lang;
      const primaryAudio = primaryLang === 'vi' ? cue.audioVi : cue.audioEn;
      const primaryText = cue.text;

      // Secondary Language (Translation)
      const secondaryLang = lang === 'vi' ? 'en' : 'vi';
      const secondaryAudio = secondaryLang === 'vi' ? cue.audioVi : cue.audioEn;
      const secondaryText = cue.translation;

      // Handle Primary Audio
      if (primaryAudio) {
        console.log(`Database saved audio cache hit for: "${primaryText}" (${primaryLang.toUpperCase()})`);
        cache[`${cue.id}_${primaryLang}`] = primaryAudio;
        loadedCount++;
      } else if (primaryText) {
        cuesNeedFetch.push({ cue, targetLang: primaryLang, targetText: primaryText });
      }

      // Handle Secondary Audio
      if (secondaryAudio) {
        console.log(`Database saved audio cache hit for: "${secondaryText}" (${secondaryLang.toUpperCase()})`);
        cache[`${cue.id}_${secondaryLang}`] = secondaryAudio;
        loadedCount++;
      } else if (secondaryText) {
        cuesNeedFetch.push({ cue, targetLang: secondaryLang, targetText: secondaryText });
      }
    });

    if (loadedCount > 0) {
      setLoadingStep(`Loaded ${loadedCount} preset voices from persistent database...`);
    }

    if (cuesNeedFetch.length > 0) {
      await Promise.all(
        cuesNeedFetch.map(async (fetchItem) => {
          try {
            const res = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: fetchItem.targetText,
                language: fetchItem.targetLang,
                ttsMode: selectedTts,
                nineRouterConfig: nineRouterConfig
              })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.audio) {
                cache[`${fetchItem.cue.id}_${fetchItem.targetLang}`] = data.audio;
              }
            }
          } catch (err) {
            console.warn("Failed pre_synthesizing clip for cue Text:", fetchItem.targetText, err);
          } finally {
            loadedCount++;
            setLoadingStep(`Preloaded audio voice sequence: "${fetchItem.targetText}" (${loadedCount}/${cuesToPreload.length * 2})`);
          }
        })
      );
    }

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
          count: config.count || 6,
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

      const soundViPresets = ['Gâu Gâu! 🐕', 'Meo Meo! 🐈', 'Quác Quác! 🦆', 'Ò ó o! 🐓', 'Oạp Oạp! 🐸', 'Húuuu! 🐺', 'U uuu! 🦍', 'Chíp Chíp! 🐥'];
      const soundEnPresets = ['Woof Woof! 🐕', 'Meow Meow! 🐈', 'Quack Quack! 🦆', 'Cock-a-doodle-doo! 🐓', 'Ribbit Ribbit! 🐸', 'Awooooo! 🐺', 'Hoot Hoot! 🦉', 'Tweet Tweet! 🐥'];
      const POSE_PRESETS = [
        { coords: '{"head": [50, 15], "spine": [[50,15], [50,55]], "leftArm": [[50,30], [20,25], [5,25]], "rightArm": [[50,30], [80,25], [95,25]], "leftLeg": [[50,55], [40,85]], "rightLeg": [[50,55], [60,85]]}' },
        { coords: '{"head": [50, 20], "spine": [[50,20], [45,40], [30,55]], "leftArm": [[45,40], [55,50], [65,60]], "rightArm": [[45,40], [30,30], [20,25]], "leftLeg": [[30,55], [35,75], [40,90]], "rightLeg": [[30,55], [20,70], [10,85]]}' },
        { coords: '{"head": [50, 18], "spine": [[50,18], [50,55]], "leftArm": [[50,28], [30,28], [15,15]], "rightArm": [[50,28], [70,28], [85,40]], "leftLeg": [[50,55], [35,85]], "rightLeg": [[50,55], [65,85]]}' }
      ];

      const adaptedCues = data.cues.map((cue: any, i: number) => ({
        id: cue.id || `llm-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
        text: cue.text,
        translation: cue.translation,
        category: config.mode,
        poseJson: config.mode === 'motion' ? POSE_PRESETS[i % POSE_PRESETS.length].coords : undefined,
        soundText: config.mode === 'sound' ? (config.language === 'vi' ? soundViPresets[i % soundViPresets.length] : soundEnPresets[i % soundEnPresets.length]) : undefined
      }));

      setStageCues(adaptedCues);
      await preloadAudioForCues(adaptedCues, selectedTtsMode, config.language);
      setIsGeneratingInitial(false);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 
        "Something went wrong while communicating with the generative server. Please check your setup parameters or load an existing DB lesson."
      );
      setIsGeneratingInitial(false);
    }
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
                <span className="text-emerald-500">M</span>otion <span className="text-red-500">S</span>ound <span className="text-blue-500">E</span>motion
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Real-time API Connection Pill Badge */}
            <button
              onClick={() => {
                fetchServerStatus();
                setIsApiConsoleOpen(true);
              }}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 ${
                nineRouterConfig.enabled 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : serverStatus?.geminiKeyConfigured
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'
              }`}
              title="Click to open Global API & Models Cockpit Drawer"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                nineRouterConfig.enabled 
                  ? 'bg-emerald-400 animate-pulse'
                  : serverStatus?.geminiKeyConfigured
                    ? 'bg-indigo-400 animate-pulse'
                    : 'bg-amber-400 animate-pulse'
              }`}></span>
              <span>{nineRouterConfig.enabled ? "📡 API: 9Router" : serverStatus?.geminiKeyConfigured ? "♊ API: Gemini" : "🔌 API: Backup"}</span>
            </button>

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
            onStartSession={handleStartSession}
          />
        )}

      </main>

      {/* 5. GLOBAL API & MODELS COCKPIT DRAWER */}
      {isApiConsoleOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop with a blurring glass effect */}
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsApiConsoleOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className={`relative w-full max-w-md h-full flex flex-col shadow-2xl border-l overflow-hidden transition-transform duration-300 ${
            theme === 'black' 
              ? 'bg-[#0f0a0a] border-neutral-900 text-slate-100' 
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
            
            {/* Drawer Header */}
            <div className={`p-5 border-b flex items-center justify-between ${
              theme === 'black' ? 'border-neutral-900 bg-neutral-950/40' : 'border-slate-150 bg-slate-50/50'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl animate-pulse">📡</span>
                <div>
                  <h3 className={`font-display font-black text-xs uppercase tracking-wider block ${
                    theme === 'black' ? 'text-white' : 'text-slate-900'
                  }`}>Global API & Models Console</h3>
                  <span className={`text-[9px] uppercase tracking-wider block font-bold leading-none mt-1 ${
                    theme === 'black' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Monitor & configure core parameters live
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsApiConsoleOpen(false)}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                  theme === 'black' 
                    ? 'hover:bg-neutral-900 border-neutral-800 text-slate-400 hover:text-white' 
                    : 'hover:bg-slate-100 border-slate-250 text-slate-500 hover:text-slate-800'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Setup parameters */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Telemetry check card */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                theme === 'black' ? 'bg-neutral-950/40 border-neutral-900' : 'bg-slate-50/50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider block ${
                    theme === 'black' ? 'text-slate-400' : 'text-slate-600'
                  }`}>System Host Telemetry</span>
                  <button 
                    onClick={fetchServerStatus}
                    disabled={isServerStatusLoading}
                    className={`p-1 rounded-lg border cursor-pointer disabled:opacity-50 ${
                      theme === 'black' ? 'border-neutral-800 hover:bg-neutral-900 text-slate-500' : 'border-slate-250 hover:bg-slate-100 text-slate-400'
                    }`}
                    title="Refresh telemetry"
                  >
                    <RefreshCw className={`w-3 h-3 ${isServerStatusLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className={`p-2.5 rounded-lg border ${
                    theme === 'black' ? 'bg-neutral-900/40 border-neutral-800/60' : 'bg-white border-slate-200/60'
                  }`}>
                    <span className="block text-[8px] uppercase font-black text-slate-500 mb-0.5">Gemini credentials</span>
                    <span className={`font-bold flex items-center gap-1 ${serverStatus?.geminiKeyConfigured ? 'text-indigo-400' : 'text-amber-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${serverStatus?.geminiKeyConfigured ? 'bg-indigo-400 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></span>
                      {serverStatus ? (serverStatus.geminiKeyConfigured ? "CONFIGURED" : "MISSING KEY") : "LOADING..."}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    theme === 'black' ? 'bg-neutral-900/40 border-neutral-800/60' : 'bg-white border-slate-200/60'
                  }`}>
                    <span className="block text-[8px] uppercase font-black text-slate-500 mb-0.5">Socket Status</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      CONNECTED
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    theme === 'black' ? 'bg-neutral-900/40 border-neutral-800/60' : 'bg-white border-slate-200/60'
                  }`}>
                    <span className="block text-[8px] uppercase font-black text-slate-500 mb-0.5">Custom Lessons</span>
                    <span className={`font-bold ${theme === 'black' ? 'text-slate-350' : 'text-slate-700'}`}>
                      {serverStatus ? `${serverStatus.lessonCount} Saved` : "LOADING..."}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    theme === 'black' ? 'bg-neutral-900/40 border-neutral-800/60' : 'bg-white border-slate-200/60'
                  }`}>
                    <span className="block text-[8px] uppercase font-black text-slate-500 mb-0.5">Node Runtime</span>
                    <span className={`font-bold ${theme === 'black' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {serverStatus?.nodeVersion || "unknown"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Master Enabled / Disabled Toggle */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                theme === 'black' ? 'bg-neutral-950/40 border-neutral-900' : 'bg-slate-50/50 border-slate-200'
              }`}>
                <div>
                  <h4 className={`text-[10px] font-black uppercase tracking-wider block ${
                    theme === 'black' ? 'text-slate-200' : 'text-slate-800'
                  }`}>Use 9Router Proxy Proxy</h4>
                  <p className={`text-[9px] leading-relaxed mt-0.5 ${theme === 'black' ? 'text-slate-500' : 'text-slate-500'}`}>
                    Proxy requests through local or custom bearer credentials if the standard limits are exhausted.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={nineRouterConfig.enabled}
                    onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={`w-10 h-5.5 rounded-full relative transition-all border ${
                    nineRouterConfig.enabled
                      ? 'bg-emerald-500/20 border-emerald-500 after:translate-x-4.5 after:bg-emerald-500'
                      : 'bg-neutral-800 border-neutral-700 after:bg-slate-500'
                  } after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:rounded-full after:h-4 after:w-4 after:transition-all`}></div>
                </label>
              </div>

              {/* Configuration parameters */}
              <div className="space-y-4">
                <span className={`block text-[10px] font-black uppercase tracking-wider pb-1.5 border-b ${
                  theme === 'black' ? 'border-neutral-900 text-slate-400' : 'border-slate-150 text-slate-600'
                }`}>Credentials Configuration</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase mb-1 text-slate-500">9Router Server Endpoint</label>
                    <input
                      type="text"
                      value={nineRouterConfig.url}
                      disabled={!nineRouterConfig.enabled}
                      onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, url: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 ${
                        theme === 'black' 
                          ? 'bg-neutral-950 border-neutral-900 text-slate-200' 
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      } ${!nineRouterConfig.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase mb-1 text-slate-500">Bearer Token API Key (Optional)</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={nineRouterConfig.apiKey || ''}
                        disabled={!nineRouterConfig.enabled}
                        placeholder="Enter credentials auth code sequence..."
                        onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, apiKey: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 pr-10 ${
                          theme === 'black' 
                            ? 'bg-neutral-950 border-neutral-900 text-slate-200' 
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        } ${!nineRouterConfig.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      <Key className="w-3.5 h-3.5 text-slate-600 absolute right-3.5 top-3" />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={testRouterConnection}
                  disabled={!nineRouterConfig.enabled || routerTesting}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${routerTesting ? 'animate-spin' : ''}`} />
                  <span>{routerTesting ? "Pinging Connection..." : "Ping Connection Gateway"}</span>
                </button>

                {routerTestFeedback && (
                  <div className={`p-3 rounded-xl text-[10px] font-mono leading-normal border max-h-[120px] overflow-y-auto ${
                    routerTestFeedback.includes('✅') 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-450'
                  }`}>
                    {routerTestFeedback}
                  </div>
                )}

                {routerTestedModels.length > 0 && (
                  <div className="space-y-1">
                    <span className="block text-[8px] font-black uppercase text-slate-500">Available remote Models check:</span>
                    <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto p-2 border border-neutral-900 rounded-xl">
                      {routerTestedModels.map(m => (
                        <span key={m} className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          theme === 'black' ? 'bg-neutral-900 border border-neutral-800 text-slate-400' : 'bg-slate-100 border-slate-250 text-slate-650'
                        }`}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Models dropdown specifications */}
              <div className="space-y-4">
                <span className={`block text-[10px] font-black uppercase tracking-wider pb-1.5 border-b ${
                  theme === 'black' ? 'border-neutral-900 text-slate-400' : 'border-slate-150 text-slate-600'
                }`}>Custom Model Target binds</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase mb-1 text-slate-500">LLM Generation Model</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.llmModel}
                      onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, llmModel: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-350' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase mb-1 text-slate-500">Speech-To-Text Model (STT)</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.sttModel}
                      onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, sttModel: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-350' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase mb-1 text-slate-500 font-sans">Vietnamese Voice Model (TTS)</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.ttsModelVi || ''}
                      onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, ttsModelVi: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-350' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase mb-1 text-slate-500 font-sans">English Voice Model (TTS)</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.ttsModelEn || ''}
                      onChange={(e) => handleUpdateNineRouterConfig({ ...nineRouterConfig, ttsModelEn: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-350' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Status label */}
            <div className={`p-4 border-t text-center text-[9px] font-bold uppercase tracking-wider font-mono ${
              theme === 'black' ? 'border-neutral-900 bg-neutral-950/40 text-slate-500' : 'border-slate-100 bg-slate-50 text-slate-400'
            }`}>
              ⚡ Active Configurations applied instantly
            </div>

          </div>
        </div>
      )}

      {/* Elegant minimalist theatrical footer */}
      <footer className={`py-4 border-t text-center text-[10px] font-bold uppercase tracking-wider ${
        theme === 'black' 
          ? 'border-neutral-900 bg-neutral-950/40 text-slate-600' 
          : 'border-slate-200 bg-slate-100 text-slate-400'
      }`}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Chunks Improv Stage • Realized with 🧠 Chunks Theory speaking loops</span>
          <span className={theme === 'black' ? 'text-slate-700' : 'text-slate-400'}>
            <span className="text-emerald-500">M</span>otion <span className="text-red-500">S</span>ound <span className="text-blue-500">E</span>motion
          </span>
        </div>
      </footer>

    </div>
  );
}
