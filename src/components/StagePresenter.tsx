import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { SessionConfig, CueItem, NineRouterConfig } from '../types';
import { 
  Play, 
  Pause, 
  Square, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  RefreshCw, 
  Keyboard,
  Info,
  Languages,
  CheckCircle,
  HelpCircle,
  Mic,
  MicOff,
  MessageSquareQuote,
  Flame,
  Brain
} from 'lucide-react';

interface StagePresenterProps {
  config: SessionConfig;
  ttsMode: 'local' | 'gemini' | 'silent' | '9router';
  initialCues: CueItem[];
  nineRouterConfig: NineRouterConfig;
  audioCache?: Record<string, string>;
  theme?: 'black' | 'light';
  onStop: () => void;
}

// Custom stick-figure skeleton preview generator for physical motion poses
function PoseSketch({ poseJson }: { poseJson?: string }) {
  if (!poseJson) {
    return (
      <svg viewBox="0 0 100 100" className="w-16 h-16 stroke-amber-400 stroke-[3] fill-none stroke-round overflow-visible animate-pulse">
        <circle cx="50" cy="20" r="7" className="stroke-amber-400 fill-amber-500/5" />
        <line x1="50" y1="27" x2="50" y2="55" />
        <line x1="50" y1="35" x2="25" y2="35" />
        <line x1="50" y1="35" x2="75" y2="35" />
        <line x1="50" y1="55" x2="35" y2="85" />
        <line x1="50" y1="55" x2="65" y2="85" />
      </svg>
    );
  }

  try {
    const coords = typeof poseJson === 'string' ? JSON.parse(poseJson) : poseJson;
    const head = coords.head || [50, 20];
    const spine = coords.spine || [[50, 20], [50, 55]];
    const leftArm = coords.leftArm || [[50, 30], [30, 30]];
    const rightArm = coords.rightArm || [[50, 30], [70, 30]];
    const leftLeg = coords.leftLeg || [[50, 55], [35, 85]];
    const rightLeg = coords.rightLeg || [[50, 55], [65, 85]];

    return (
      <svg viewBox="0 0 100 100" className="w-16 h-16 stroke-amber-400 stroke-[3.5] fill-none stroke-round overflow-visible">
        {/* Head */}
        <circle cx={head[0]} cy={head[1]} r="7" className="stroke-amber-400 fill-amber-500/10" />
        {/* Spine */}
        {spine.length > 1 && (
          <path d={`M ${spine.map((p: any) => p.join(',')).join(' L ')}`} />
        )}
        {/* Left Arm */}
        {leftArm.length > 1 && (
          <path d={`M ${leftArm.map((p: any) => p.join(',')).join(' L ')}`} />
        )}
        {/* Right Arm */}
        {rightArm.length > 1 && (
          <path d={`M ${rightArm.map((p: any) => p.join(',')).join(' L ')}`} />
        )}
        {/* Left Leg */}
        {leftLeg.length > 1 && (
          <path d={`M ${leftLeg.map((p: any) => p.join(',')).join(' L ')}`} />
        )}
        {/* Right Leg */}
        {rightLeg.length > 1 && (
          <path d={`M ${rightLeg.map((p: any) => p.join(',')).join(' L ')}`} />
        )}
      </svg>
    );
  } catch (e) {
    return (
      <svg viewBox="0 0 100 100" className="w-16 h-16 stroke-amber-400 stroke-[3] fill-none stroke-round overflow-visible">
        <circle cx="50" cy="20" r="7" />
        <line x1="50" y1="27" x2="50" y2="55" />
        <line x1="50" y1="35" x2="30" y2="35" />
        <line x1="50" y1="35" x2="70" y2="35" />
        <line x1="50" y1="55" x2="35" y2="85" />
        <line x1="50" y1="55" x2="65" y2="85" />
      </svg>
    );
  }
}

export default function StagePresenter({ config, ttsMode, initialCues, nineRouterConfig, audioCache = {}, theme = 'black', onStop }: StagePresenterProps) {
  // Cue State
  const [cues, setCues] = useState<CueItem[]>(initialCues);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const currentCue = cues[currentIndex] || { text: "Preparing...", translation: "", hint: "" };
  
  // Timer State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(config.duration);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  
  // Audio state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [ttsLoading, setTtsLoading] = useState<boolean>(false);
  const [activeTtsMode, setActiveTtsMode] = useState<'local' | 'gemini' | 'silent' | '9router'>(ttsMode);
  const [ttsFeedback, setTtsFeedback] = useState<string | null>(null);

  // 🎤 Speech-To-Text and LLM analysis coach states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedText, setRecordedText] = useState<string>("");
  const [analysisFeedback, setAnalysisFeedback] = useState<string>("");
  const [isSTTLoading, setIsSTTLoading] = useState<boolean>(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // History track for pedagogical reinforcement at the end
  const [history, setHistory] = useState<CueItem[]>(initialCues.slice(0, 1));

  // Buffering States
  const [isPreFetching, setIsPreFetching] = useState<boolean>(false);
  const [bufferError, setBufferError] = useState<string | null>(null);


  // Use refs to avoid stale closures in listeners
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentCuesRef = useRef<CueItem[]>(cues);
  const currentIndexRef = useRef<number>(currentIndex);
  const isPlayingRef = useRef<boolean>(isPlaying);
  currentCuesRef.current = cues;
  currentIndexRef.current = currentIndex;
  isPlayingRef.current = isPlaying;

  // Web Speech API Voice Selection
  const [localVoice, setLocalVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const targetLang = config.language === 'vi' ? 'vi-VN' : 'en-';
        const findVoice = voices.find(v => v.lang.toLowerCase().includes(targetLang.toLowerCase())) || 
                          voices.find(v => v.lang.toLowerCase().startsWith(config.language));
        setLocalVoice(findVoice || null);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [config.language]);

  // Buffer replenish function: fetch extra cues live in background
  const triggerBufferReplenish = useCallback(async () => {
    if (isPreFetching) return;
    setIsPreFetching(true);
    setBufferError(null);
    try {
      const response = await fetch('/api/cue/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: config.topic,
          wordType: config.wordType,
          level: config.level,
          language: config.language,
          count: 5
        })
      });
      if (!response.ok) throw new Error("Server generation failed");
      const data = await response.json();
      if (data.cues && data.cues.length > 0) {
        setCues(prev => [...prev, ...data.cues]);
      }
    } catch (err: any) {
      console.warn("Buffer replenish error caught:", err);
      setBufferError("Buffer replenish failed. Rolling in emergency backup cues instead.");
      const timestamp = Date.now();
      const emergencyCues: CueItem[] = [
        { 
          id: `emg-${timestamp}-1`, 
          text: config.language === 'vi' ? "Ý tưởng bay bổng" : "Spark of Hope", 
          translation: config.language === 'vi' ? "Unexplored limits" : "Tia hy vọng",
          hint: config.language === 'vi' ? "Nếu được đi bất cứ đâu ngay bây giờ, bạn đi đâu?" : "Where would you like to travel right now?"
        },
        { 
          id: `emg-${timestamp}-2`, 
          text: config.language === 'vi' ? "Hòn đá ma thuật" : "Magic Stone", 
          translation: config.language === 'vi' ? "Sorcerer's talisman" : "Khối đá ma pháp",
          hint: config.language === 'vi' ? "Vật này có sức mạnh làm ngưng đọng thời gian." : "This artifact stops global clocks instantly."
        }
      ];
      setCues(prev => [...prev, ...emergencyCues]);
    } finally {
      setIsPreFetching(false);
    }
  }, [config, isPreFetching]);

  // STT Microphone capture & Coach Evaluation Analysis Handlers using NineRouter
  const startRecording = async () => {
    setRecordedText("");
    setAnalysisFeedback("");
    setRecordingError(null);
    setIsPlaying(false); // Pause pacing countdown to let students express fully
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Clean tracks immediately to shut off mic indicator
        stream.getTracks().forEach(track => track.stop());
        
        await handleTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setRecordingError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone access denied. Please click on the lock icon next to your URL bar to grant mic permissions."
          : `Unable to access recording devices: ${err.message || 'Unknown error'}`
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    setIsSTTLoading(true);
    setRecordingError(null);
    try {
      const form = new FormData();
      form.append("file", audioBlob, "speech.webm");
      form.append("language", config.language);
      form.append("nineRouterConfig", JSON.stringify(nineRouterConfig));

      const res = await fetch("/api/stt", {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Auditory transcription returned an error.");
      }

      const data = await res.json();
      const textOutput = data.text || "";
      setRecordedText(textOutput || "No speech pattern transcribed. Try speaking clearly near your microphone.");
      
      if (textOutput.trim()) {
        await handleGetFeedback(textOutput);
      }
    } catch (e: any) {
      console.error("STT transcribing error:", e);
      setRecordingError(e.message || "Auditory transcription proxy error caught.");
    } finally {
      setIsSTTLoading(false);
    }
  };

  const handleGetFeedback = async (textToAnalyze: string) => {
    setIsAnalysisLoading(true);
    try {
      const res = await fetch("/api/stt/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cueText: currentCue.text,
          transcribedText: textToAnalyze,
          nineRouterConfig,
          language: config.language
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Speaking analysis coach failed.");
      }

      const data = await res.json();
      setAnalysisFeedback(data.analysis || "Speaking feedback could not be parsed.");
    } catch (e: any) {
      console.error(e);
      setAnalysisFeedback("Teacher Coach Assistant could not connect to analyze this chunk. Please try again or skip.");
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  // Assistive Speech voice playback logic (text to speech)
  const speakCue = useCallback(async (text: string) => {
    if (isAudioMuted || activeTtsMode === 'silent') return;

    // 1. Instantly tap into our pre-cached audio dictionary if present (Zero delay playback!)
    const currentList = currentCuesRef.current;
    const currentId = currentList[currentIndexRef.current]?.id || "";
    const cachedBase64 = audioCache[currentId] || audioCache[text];

    if (cachedBase64) {
      console.log(`Preloaded TTS cache hit! Instant playback triggered for "${text}" (Zero latency)`);
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        const snd = new Audio(`data:audio/mp3;base64,${cachedBase64}`);
        await snd.play();
        return; // Cache play succeeded! Skip the network fetching block completely
      } catch (err) {
        console.warn("Cached audio playback interrupted. Dropping to standard network call.", err);
      }
    }

    if (activeTtsMode === 'local' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = config.language === 'vi' ? 'vi-VN' : 'en-US';
      if (localVoice) utterance.voice = localVoice;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } 
    else if (activeTtsMode === 'gemini') {
      try {
        setTtsLoading(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: config.language })
        });
        if (!res.ok) throw new Error("TTS endpoint error");
        const json = await res.json();
        
        if (json.fallbackLocal) {
          throw new Error(json.error || "Rate limited");
        }

        if (json.audio) {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          const snd = new Audio(`data:audio/mp3;base64,${json.audio}`);
          snd.play().catch(e => console.log("Audio autoplay block:", e));
        }
      } catch (err: any) {
        setTtsFeedback("API Quota protection: Seamlessly transitioned to Local Speech Engine to preserve classroom flow ⚡");
        setActiveTtsMode('local');
        console.warn("Gemini premium TTS failed or rate-limited. Permanently cascading to local browser synthesizer.", err);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = config.language === 'vi' ? 'vi-VN' : 'en-US';
          window.speechSynthesis.speak(utterance);
        }
      } finally {
        setTtsLoading(false);
      }
    }
    else if (activeTtsMode === '9router') {
      try {
        setTtsLoading(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text, 
            language: config.language,
            ttsMode: '9router',
            nineRouterConfig
          })
        });
        if (!res.ok) throw new Error("9Router TTS endpoint error");
        const json = await res.json();
        
        if (json.fallbackLocal) {
          throw new Error(json.error || "9Router TTS model error");
        }

        if (json.audio) {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          const snd = new Audio(`data:audio/mp3;base64,${json.audio}`);
          snd.play().catch(e => console.log("Audio autoplay block:", e));
        }
      } catch (err: any) {
        setTtsFeedback("9Router Speak fallback: Seamlessly transitioned to Local Speech Engine to preserve classroom flow ⚡");
        setActiveTtsMode('local');
        console.warn("9Router TTS failed. Permanently cascading to local browser synthesizer.", err);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = config.language === 'vi' ? 'vi-VN' : 'en-US';
          window.speechSynthesis.speak(utterance);
        }
      } finally {
        setTtsLoading(false);
      }
    }
  }, [activeTtsMode, isAudioMuted, config.language, localVoice, nineRouterConfig, audioCache]);

  // Advance Cue logic
  const handleNext = useCallback(() => {
    // Reset recording & feedback widgets for the new incoming cue
    setRecordedText("");
    setAnalysisFeedback("");
    setRecordingError(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {}
    }
    setIsRecording(false);

    const nextIdx = currentIndexRef.current + 1;
    const currentList = currentCuesRef.current;

    if (nextIdx < currentList.length) {
      setCurrentIndex(nextIdx);
      setSecondsRemaining(config.duration);
      speakCue(currentList[nextIdx].text);
      setHistory(prev => {
        if (prev.find(x => x.id === currentList[nextIdx].id)) return prev;
        return [...prev, currentList[nextIdx]];
      });

      const remainingCount = currentList.length - nextIdx;
      if (remainingCount < 3) {
        triggerBufferReplenish();
      }
    } else {
      triggerBufferReplenish().then(() => {
        setTimeout(() => {
          const updatedList = currentCuesRef.current;
          if (currentIndexRef.current + 1 < updatedList.length) {
            handleNext();
          }
        }, 100);
      });
    }
  }, [config.duration, speakCue, triggerBufferReplenish]);

  // Pause/Resume toggler
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Timer Tick implementation
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          handleNext();
          return config.duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, handleNext, config.duration]);

  // Initial speaking trigger for first item
  useEffect(() => {
    if (cues.length > 0) {
      speakCue(cues[0].text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for keyboard hotkeys (Space = pause, Enter = next, Esc = stop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      if (isInputFocused) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, handleNext, onStop]);
  const progressPercent = (secondsRemaining / config.duration) * 100;

  // Custom UI colors based on active theme choice
  const textPrimary = theme === 'black' ? 'text-slate-100' : 'text-slate-800';
  const textMuted = theme === 'black' ? 'text-slate-500' : 'text-slate-400';
  const cardBg = theme === 'black' ? 'bg-[#0E0606] border-neutral-900 shadow-[0_24px_64px_rgba(0,0,0,0.85)]' : 'bg-white border-slate-200 shadow-xl';
  const panelHeaderBg = theme === 'black' ? 'bg-neutral-950/30 border-neutral-900 shadow-2xl' : 'bg-white border-slate-200 shadow-sm';
  const labelColor = theme === 'black' ? 'text-slate-400' : 'text-slate-500';
  const pillBg = theme === 'black' ? 'bg-neutral-950/45 border-neutral-900' : 'bg-slate-100 border-slate-200 text-slate-800';
  const innerCardBg = theme === 'black' ? 'bg-neutral-955 border-neutral-900' : 'bg-slate-50 border-slate-200';
  const titleColor = theme === 'black' ? 'text-white' : 'text-slate-900';

  return (
    <div id="live-stage" className={`flex flex-col h-full min-h-[80vh] justify-between max-w-5xl mx-auto py-2 px-4 select-none animate-scale-up transition-colors duration-300 ${textPrimary}`}>
      
      {/* Top Cockpit Monitor Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-4 backdrop-blur-md border rounded-2xl ${panelHeaderBg}`}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest block ${labelColor}`}>Lesson Topic</span>
            <span className={`text-xs font-bold line-clamp-1 ${titleColor}`}>{config.topic}</span>
          </div>
        </div>

        {/* Live Active Metadata Pill Cluster */}
        <div className={`flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-wider uppercase ${labelColor}`}>
          <div className={`border px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${pillBg}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Word: <strong className={titleColor}>{config.wordType}</strong></span>
          </div>
          <div className={`border px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${pillBg}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>Level: <strong className="text-red-500">{config.level}</strong></span>
          </div>
          <div className={`border px-2.5 py-1 rounded-lg flex items-center gap-1 ${pillBg}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Language: <strong className={titleColor}>{config.language}</strong></span>
          </div>
        </div>

        {/* Audio controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isAudioMuted 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20' 
                : `${pillBg} text-slate-400 hover:text-slate-200`
            }`}
            title={isAudioMuted ? "Unmute TTS Assistive Voice" : "Mute Sound (Red)"}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-red-500" />}
          </button>
          
          <button
            onClick={onStop}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'black'
                ? 'text-slate-400 bg-neutral-950/50 hover:bg-neutral-900 border-neutral-900'
                : 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
            }`}
          >
            <Square className="w-2.5 h-2.5 fill-red-500 text-red-500" />
            <span>End [Esc]</span>
          </button>
        </div>
      </div>

      {/* Main Big Stage Projection View - Cinematic Glowing Stage Card */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
        
        {/* Dynamic Fallback Notice */}
        {ttsFeedback && (
          <div className="w-full max-w-3xl bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-xl mb-4 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs">⚡</span>
              <p className="font-semibold text-left">{ttsFeedback}</p>
            </div>
            <button 
              onClick={() => setTtsFeedback(null)} 
              className="text-red-500 hover:text-red-400 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Timer Line Progress bar */}
        <div className={`w-full max-w-3xl h-1.5 rounded-full overflow-hidden border shadow-inner mb-6 ${
          theme === 'black' ? 'bg-neutral-950 border-neutral-900' : 'bg-slate-200 border-slate-300'
        }`}>
          <div 
            className="h-full bg-gradient-to-r from-red-500 via-rose-500 to-red-400 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Big Displays Prompt Card */}
        <motion.div
          animate={{
            y: [0, -6, 0]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`w-full max-w-3xl rounded-2xl border p-8 md:p-12 text-center flex flex-col justify-between relative overflow-hidden min-h-[320px] group transition-all duration-300 ${cardBg}`}
        >
          
          {/* Neon Borders Blue & Red Gradient */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-550" />

          {/* Active pacing remaining indicator bubbles */}
          <div className="absolute top-5 right-5 flex items-center gap-2.5">
            {ttsLoading && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/5 border border-red-500/20 px-2 py-0.5 rounded-md animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-red-500" /> Synthesizing Voice...
              </span>
            )}
            <span className={`w-8 h-8 rounded-full border text-xs font-mono font-bold flex items-center justify-center shadow-lg ${
              theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-red-400' : 'bg-slate-100 border-slate-200 text-indigo-700'
            }`}>
              {secondsRemaining}s
            </span>
          </div>

          <div className="my-auto py-6 space-y-5">
            {/* Primary Speaking Trigger */}
            <div className="space-y-3">
              <h2 className={`text-3xl md:text-5xl font-display font-black tracking-tight animate-scale-up select-all break-words leading-tight drop-shadow-md ${titleColor}`}>
                {currentCue.text}
              </h2>
              {currentCue.translation && (
                <p className={`text-base md:text-lg font-serif italic font-medium tracking-wide ${labelColor}`}>
                  {currentCue.translation}
                </p>
              )}
            </div>

            {/* Mode-Aware Visual Card Layout */}
            {config.mode === 'motion' ? (
              <div className={`inline-flex flex-col sm:flex-row items-center gap-6 max-w-xl mx-auto border p-5 rounded-2xl text-left animate-fade-in w-full ${
                theme === 'black' ? 'bg-neutral-950/40 border-neutral-900' : 'bg-slate-100/50 border-slate-200 shadow-inner'
              }`}>
                <div className={`w-24 h-24 shrink-0 rounded-xl flex items-center justify-center p-2 shadow-inner border ${
                  theme === 'black' ? 'bg-neutral-950 border-neutral-900' : 'bg-white border-slate-250'
                }`}>
                  <PoseSketch poseJson={currentCue.poseJson} />
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 uppercase px-2 py-0.5 rounded tracking-widest inline-block font-sans">
                    🏃 Active Pose Action
                  </span>
                  <p className={`text-xs font-semibold leading-relaxed ${theme === 'black' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {config.language === 'vi' ? 'Hãy bắt chước tư thế trong khung hình. Căng cơ và biểu đạt!' : 'Imitate the posture shown in the box. Stretch and express!'}
                  </p>
                </div>
              </div>
            ) : config.mode === 'sound' ? (
              <div className={`inline-flex flex-col sm:flex-row items-center gap-6 max-w-xl mx-auto border p-5 rounded-2xl text-left animate-fade-in w-full ${
                theme === 'black' ? 'bg-neutral-950/40 border-neutral-900' : 'bg-slate-100/50 border-slate-200 shadow-inner'
              }`}>
                <div className={`w-24 h-24 shrink-0 rounded-xl flex flex-col items-center justify-center p-2 relative overflow-hidden group shadow-inner border ${
                  theme === 'black' ? 'bg-neutral-950 border-neutral-900' : 'bg-white border-slate-250'
                }`}>
                  <div className="text-2xl animate-bounce">📢</div>
                  <div className="text-[10px] font-mono font-bold text-red-500 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded mt-1 text-center truncate max-w-full">
                    {currentCue.soundText || "Quack!"}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] font-bold text-red-500 bg-red-500/5 border border-red-500/10 uppercase px-2 py-0.5 rounded tracking-widest inline-block font-sans">
                    📣 Sound & Vocal Script
                  </span>
                  <p className={`text-xs font-semibold leading-relaxed ${theme === 'black' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <strong>Vocalize sound effect:</strong> &ldquo;{currentCue.soundText || "quack quack"}&rdquo;
                  </p>
                </div>
              </div>
            ) : (
              /* Emotion Default Mode - only displays primary text, no hint */
              null
            )}

            {/* 🎤 Interactive Speaking Practice Recording Portal */}
            {nineRouterConfig.enabled && (
              <div id="recording-portal" className={`mt-6 border-t pt-5 text-left max-w-xl mx-auto space-y-3 ${
                theme === 'black' ? 'border-neutral-900' : 'border-slate-150'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-550 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-red-500" />
                    Student Mic Console
                  </span>
                  
                  {isRecording ? (
                    <span className="text-[9px] text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/15 font-bold animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      RECORDING ACTIVE
                    </span>
                  ) : (
                    <span className={`text-[9px] font-bold uppercase tracking-wider font-sans ${textMuted}`}>
                      {isSTTLoading ? "Transcribing..." : isAnalysisLoading ? "Evaluating..." : "Ready to register speaking"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isRecording ? (
                    <button
                      type="button"
                      id="mic-stop-btn"
                      onClick={stopRecording}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-red-550/10 cursor-pointer transition-all active:scale-95"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop & Analyze Speaking</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="mic-start-btn"
                      onClick={startRecording}
                      disabled={isSTTLoading || isAnalysisLoading}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-red-500/10 cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                    >
                      <Mic className="w-3.5 h-3.5 fill-current" />
                      <span>Record Answer</span>
                    </button>
                  )}

                  {!isRecording && !isSTTLoading && !isAnalysisLoading && recordedText && (
                    <button
                      type="button"
                      id="mic-reset-btn"
                      onClick={startRecording}
                      className="text-[11px] text-red-500 hover:text-red-600 underline font-semibold cursor-pointer"
                    >
                      Record Again
                    </button>
                  )}
                </div>

                {/* Error status report */}
                {recordingError && (
                  <div className="text-[11px] text-rose-450 font-medium bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 flex gap-1.5">
                    <span className="shrink-0">⚠️</span>
                    <p>{recordingError}</p>
                  </div>
                )}

                {/* STT Output & Coach Report Blocks */}
                {(isSTTLoading || isAnalysisLoading || recordedText) && (
                  <div className={`border p-4 rounded-xl space-y-3.5 animate-scale-up shadow-inner ${
                    theme === 'black' ? 'bg-neutral-950/40 border-neutral-900' : 'bg-slate-50 border-slate-200'
                  }`}>
                    
                    {/* Speech Text transcribing state */}
                    <div className="space-y-1">
                      <p className={`text-[9px] uppercase font-bold tracking-wider font-sans ${textMuted}`}>
                        Transcribed speech chunk:
                      </p>
                      {isSTTLoading ? (
                        <div className="flex items-center gap-2 text-slate-500 text-xs py-1 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin text-red-500" />
                          <span>Converting audio streams via 9Router STT...</span>
                        </div>
                      ) : (
                        <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg border ${
                          theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                        }`}>
                          {recordedText ? `“${recordedText}”` : <span className="text-slate-400 italic">No speech pattern captured.</span>}
                        </p>
                      )}
                    </div>

                    {/* AI Coach Analysis Report */}
                    {(isAnalysisLoading || analysisFeedback) && (
                      <div className={`pt-3 space-y-1.5 border-t ${theme === 'black' ? 'border-neutral-900' : 'border-slate-150'}`}>
                        <p className="text-[9px] uppercase font-bold tracking-wider text-red-500 flex items-center gap-1 font-sans">
                          <MessageSquareQuote className="w-3 h-3 text-red-500" />
                          AI Classroom Evaluator feedback:
                        </p>
                        {isAnalysisLoading ? (
                          <div className="flex items-center gap-2 text-slate-500 text-xs py-1 animate-pulse">
                            <Brain className="w-3 h-3 animate-spin text-red-550" />
                            <span>Computing speaking metrics...</span>
                          </div>
                        ) : (
                          <div className={`text-xs leading-relaxed font-sans prose prose-invert p-3 rounded-lg border ${
                            theme === 'black' 
                              ? 'bg-red-500/5 border-red-500/5 text-slate-300' 
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}>
                            <p className="whitespace-pre-wrap">{analysisFeedback}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer of the Cue card */}
          <div className={`pt-3 border-t flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${
            theme === 'black' ? 'border-neutral-900 text-slate-650' : 'border-slate-150 text-slate-400'
          }`}>
            <span>Round Cue #{currentIndex + 1}</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-red-550" />
              <span>Chunks Stage Engine</span>
            </span>
          </div>
        </motion.div>

        {/* Dynamic Rolling buffer meter for teacher preview */}
        <div className={`mt-4 flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
          <span className="flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${isPreFetching ? 'animate-spin text-red-500' : ''}`} />
            Cue Buffer: <strong className={theme === 'black' ? 'text-slate-300' : 'text-slate-700'}>{cues.length} in pool</strong>
          </span>
          {bufferError && (
            <span className="text-red-500 flex items-center gap-1 animate-pulse">
              <Info className="w-3 h-3" /> {bufferError}
            </span>
          )}
        </div>
      </div>

      {/* Cinematic Operation Command Bar */}
      <div className={`my-4 p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
        theme === 'black' ? 'bg-neutral-950/40 border-neutral-900 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-inner'
      }`}>
        
        {/* Hotkey guides styled as gaming controller inputs */}
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-center md:text-left ${labelColor}`}>
          <Keyboard className="w-3.5 h-3.5 shrink-0" />
          <span className="leading-relaxed">
            Pause: <kbd className={`border px-1 py-0.5 rounded font-mono ${
              theme === 'black' ? 'text-slate-305 bg-slate-900 border-slate-800' : 'text-slate-700 bg-white border-slate-200'
            }`}>Space</kbd> • Next: <kbd className={`border px-1 py-0.5 rounded font-mono ${
              theme === 'black' ? 'text-slate-305 bg-slate-900 border-slate-800' : 'text-slate-700 bg-white border-slate-200'
            }`}>Enter</kbd> • Stop: <kbd className={`border px-1 py-0.5 rounded font-mono ${
              theme === 'black' ? 'text-slate-305 bg-slate-900 border-slate-800' : 'text-slate-700 bg-white border-slate-200'
            }`}>Esc</kbd>
          </span>
        </div>

        {/* Center operational controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            id="stage-pause-play-btn"
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              isPlaying 
                ? 'bg-red-550 hover:bg-red-650 text-white shadow-md shadow-red-550/5'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/5'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            onClick={handleNext}
            id="stage-next-btn"
            className={`px-4 py-2 border rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer uppercase tracking-wider ${
              theme === 'black' 
                ? 'bg-neutral-900 border-neutral-800 text-slate-200 hover:text-white' 
                : 'bg-white border-slate-200 text-slate-705 shadow-xs hover:bg-slate-50'
            }`}
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Played History Review Logs */}
      {history.length > 0 && (
        <div className={`mt-6 border p-5 rounded-2xl max-w-4xl mx-auto w-full ${
          theme === 'black' ? 'bg-[#150707]/10 border-neutral-900 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${labelColor}`}>
            <CheckCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>Review History ({history.length} Prompts)</span>
          </h3>
          
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {history.map((h, i) => (
              <div 
                key={h.id} 
                onClick={() => speakCue(h.text)}
                className={`text-[10px] font-semibold py-1.5 px-3 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  i === currentIndex 
                    ? 'bg-red-550/10 text-red-500 border-red-500/40 font-bold' 
                    : (theme === 'black' ? 'bg-neutral-950/40 border-neutral-900 text-slate-500' : 'bg-slate-50 border-slate-250 text-slate-600')
                }`}
                title="Click to replay prompt accent"
              >
                <span className="font-bold text-slate-500">#{i+1}</span>
                <span className="truncate max-w-[120px]">{h.text}</span>
                {h.translation && (
                  <span className={`text-[9px] italic font-medium truncate max-w-[80px] ${textMuted}`}>({h.translation})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
