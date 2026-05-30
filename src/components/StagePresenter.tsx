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
  Brain,
  Maximize,
  Minimize,
  Flag,
  Settings,
  X,
  ChevronDown
} from 'lucide-react';

const shuffleCues = (items: CueItem[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const playbackModeLabels: Record<string, string> = {
  once: 'Run once',
  loop: 'Loop',
  'shuffle-loop': 'Mix loop',
  infinite: 'Auto refill'
};

const normalizeCuesForSpeakingLanguage = (lessonCues: CueItem[], lessonLanguage: 'vi' | 'en' | undefined, speakingLanguage: 'vi' | 'en') => {
  if (!lessonLanguage || lessonLanguage === speakingLanguage) return lessonCues;
  return lessonCues.map(cue => ({
    ...cue,
    text: cue.translation || cue.text,
    translation: cue.translation ? cue.text : cue.translation
  }));
};

interface StagePresenterProps {
  config: SessionConfig;
  ttsMode: 'local' | 'gemini' | 'silent' | '9router';
  initialCues: CueItem[];
  nineRouterConfig: NineRouterConfig;
  audioCache?: Record<string, string>;
  theme?: 'black' | 'light';
  onStop: () => void;
  onStartSession?: (config: SessionConfig, mode: 'local'|'gemini'|'silent'|'9router', cues?: CueItem[]) => void;
}

// Custom stick-figure skeleton preview generator for physical motion poses
function PoseSketch({ poseJson }: { poseJson?: string }) {
  const drawAnimation = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.8, ease: "easeOut" }
  };

  const drawCircleAnimation = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.4, ease: "easeOut" }
  };

  const key = poseJson || 'default';

  const createSmoothPath = (points: number[][]) => {
    if (!points || points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].join(',')}`;
    if (points.length === 2) return `M ${points[0].join(',')} L ${points[1].join(',')}`;
    // Use Quadratic bezier for 3 points (e.g. shoulder -> elbow -> hand)
    return `M ${points[0].join(',')} Q ${points[1].join(',')} ${points[2].join(',')}`;
  };

  if (!poseJson) {
    return (
      <motion.svg key={key} viewBox="0 0 100 100" className="w-full h-full fill-none overflow-visible drop-shadow-md" strokeLinecap="round" strokeLinejoin="round" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
        {/* Head */}
        <motion.circle cx="50" cy="15" r="9" className="stroke-indigo-500 fill-indigo-500/20 stroke-[3]" {...drawCircleAnimation} />
        {/* Torso */}
        <motion.path d="M 50 24 C 55 35 55 45 50 55" className="stroke-indigo-500 stroke-[12]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={drawAnimation.transition} />
        {/* Left Arm: Shoulder to elbow to hand */}
        <motion.path d="M 50 28 C 40 30 35 40 30 45" className="stroke-blue-400 stroke-[6]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.1 }} />
        {/* Right Arm */}
        <motion.path d="M 50 28 C 60 30 65 40 70 45" className="stroke-blue-400 stroke-[6]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.1 }} />
        {/* Left Leg */}
        <motion.path d="M 48 53 C 45 65 40 75 35 85" className="stroke-indigo-400 stroke-[7]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.2 }} />
        {/* Right Leg */}
        <motion.path d="M 52 53 C 55 65 60 75 65 85" className="stroke-indigo-400 stroke-[7]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.2 }} />
      </motion.svg>
    );
  }

  try {
    const coords = typeof poseJson === 'string' ? JSON.parse(poseJson) : poseJson;
    const head = coords.head || [50, 15];
    const spine = coords.spine || [[50, 24], [50, 55]];
    const leftArm = coords.leftArm || [[50, 28], [35, 40], [30, 45]];
    const rightArm = coords.rightArm || [[50, 28], [65, 40], [70, 45]];
    const leftLeg = coords.leftLeg || [[48, 53], [42, 68], [35, 85]];
    const rightLeg = coords.rightLeg || [[52, 53], [58, 68], [65, 85]];

    return (
      <motion.svg key={key} viewBox="0 0 100 100" className="w-full h-full fill-none overflow-visible drop-shadow-md" strokeLinecap="round" strokeLinejoin="round" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
        {/* Head */}
        <motion.circle cx={head[0]} cy={head[1]} r="9" className="stroke-indigo-500 fill-indigo-500/20 stroke-[3]" {...drawCircleAnimation} />
        {/* Torso */}
        {spine.length > 1 && (
          <motion.path d={createSmoothPath(spine)} className="stroke-indigo-500 stroke-[12]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={drawAnimation.transition} />
        )}
        {/* Left Arm */}
        {leftArm.length > 1 && (
          <motion.path d={createSmoothPath(leftArm)} className="stroke-blue-400 stroke-[6]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.1 }} />
        )}
        {/* Right Arm */}
        {rightArm.length > 1 && (
          <motion.path d={createSmoothPath(rightArm)} className="stroke-blue-400 stroke-[6]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.1 }} />
        )}
        {/* Left Leg */}
        {leftLeg.length > 1 && (
          <motion.path d={createSmoothPath(leftLeg)} className="stroke-indigo-400 stroke-[7]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.2 }} />
        )}
        {/* Right Leg */}
        {rightLeg.length > 1 && (
          <motion.path d={createSmoothPath(rightLeg)} className="stroke-indigo-400 stroke-[7]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.2 }} />
        )}
      </motion.svg>
    );
  } catch (e) {
    return (
      <motion.svg key={key} viewBox="0 0 100 100" className="w-full h-full fill-none overflow-visible drop-shadow-md" strokeLinecap="round" strokeLinejoin="round" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
        <motion.circle cx="50" cy="15" r="9" className="stroke-amber-500 fill-amber-500/20 stroke-[3]" {...drawCircleAnimation} />
        <motion.path d="M 50 24 C 55 35 55 45 50 55" className="stroke-amber-500 stroke-[12]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={drawAnimation.transition} />
        <motion.path d="M 50 28 C 40 30 35 40 30 45" className="stroke-amber-400 stroke-[6]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.1 }} />
        <motion.path d="M 50 28 C 60 30 65 40 70 45" className="stroke-amber-400 stroke-[6]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.1 }} />
        <motion.path d="M 48 53 C 45 65 40 75 35 85" className="stroke-amber-500 stroke-[7]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.2 }} />
        <motion.path d="M 52 53 C 55 65 60 75 65 85" className="stroke-amber-500 stroke-[7]" initial={drawAnimation.initial} animate={drawAnimation.animate} transition={{ ...drawAnimation.transition, delay: 0.2 }} />
      </motion.svg>
    );
  }
}

export default function StagePresenter({ config, ttsMode, initialCues, nineRouterConfig, audioCache = {}, theme = 'black', onStop, onStartSession }: StagePresenterProps) {
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

  // Fullscreen state & controller
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [languageInverted, setLanguageInverted] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Stage overlay settings
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'design' | 'settings'>('design');
  const [fontSizeClass, setFontSizeClass] = useState<string>('text-6xl md:text-8xl');
  const [customFontSize, setCustomFontSize] = useState<number | null>(null);
  const [textColorClass, setTextColorClass] = useState<string>('');
  const [bgImage, setBgImage] = useState<string>('');
  const [availableLessons, setAvailableLessons] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/lessons')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableLessons(data);
      })
      .catch(console.error);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (cardRef.current) {
        cardRef.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(err => {
          console.error("Error attempting to enable full-screen mode:", err.message);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);


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
          count: 5,
          nineRouterConfig
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
  }, [config, isPreFetching, nineRouterConfig]);

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

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsRequestSeqRef = useRef<number>(0);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const stopCurrentSpeech = useCallback((abortPending: boolean = true) => {
    if (abortPending && ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    return () => {
      ttsRequestSeqRef.current += 1;
      stopCurrentSpeech(true);
    };
  }, [stopCurrentSpeech]);

  // Assistive Speech voice playback logic (text to speech)
  const speakCue = useCallback(async (text: string, cueId?: string, isTranslationText?: boolean) => {
    if (isAudioMuted || activeTtsMode === 'silent') return;

    const requestId = ++ttsRequestSeqRef.current;
    const isLatestTtsRequest = () => requestId === ttsRequestSeqRef.current && !isAudioMuted && activeTtsMode !== 'silent';

    // Always stop any previous local/browser audio and abort any older TTS fetch before starting a new utterance.
    stopCurrentSpeech(true);

    const effectiveLang = isTranslationText ? (config.language === 'vi' ? 'en' : 'vi') : config.language;

    // 1. Instantly tap into our pre-cached audio dictionary if present (Zero delay playback!)
    const currentList = currentCuesRef.current;
    
    // Resolve the correct id for the cue card to look up in audioCache
    let targetId = cueId;
    if (!targetId) {
      const exactIndexMatch = currentList[currentIndexRef.current];
      if (exactIndexMatch && exactIndexMatch.text === text) {
        targetId = exactIndexMatch.id;
      } else {
        const matched = currentList.find(c => c.text === text || c.translation === text);
        if (matched) {
          targetId = matched.id;
        }
      }
    }

    const cachedBase64 = targetId ? audioCache[`${targetId}_${effectiveLang}`] : null;

    if (cachedBase64) {
      console.log(`Preloaded TTS cache hit! Instant playback triggered for "${text}" (Lang: ${effectiveLang}) (Zero latency)`);
      try {
        const snd = new Audio(`data:audio/mp3;base64,${cachedBase64}`);
        activeAudioRef.current = snd;
        await snd.play();
        return; // Cache play succeeded! Skip the network fetching block completely
      } catch (err) {
        if (!isLatestTtsRequest()) return;
        console.warn("Cached audio playback interrupted. Dropping to standard network call.", err);
      }
    }

    if (!isLatestTtsRequest()) return;

    if (activeTtsMode === 'local' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = effectiveLang === 'vi' ? 'vi-VN' : 'en-US';
      
      const voices = window.speechSynthesis.getVoices();
      const targetLangId = effectiveLang === 'vi' ? 'vi' : 'en';
      const bestVoice = voices.find(v => v.lang.toLowerCase().includes(utterance.lang.toLowerCase())) || 
                        voices.find(v => v.lang.toLowerCase().startsWith(targetLangId));
      if (bestVoice) utterance.voice = bestVoice;
      
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } 
    else if (activeTtsMode === 'gemini') {
      const controller = new AbortController();
      ttsAbortRef.current = controller;
      try {
        setTtsLoading(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: effectiveLang }),
          signal: controller.signal
        });
        if (!res.ok) throw new Error("TTS endpoint error");
        const json = await res.json();
        if (!isLatestTtsRequest()) return;
        
        if (json.fallbackLocal) {
          throw new Error(json.error || "Rate limited");
        }

        if (json.audio) {
          stopCurrentSpeech(false);
          const snd = new Audio(`data:audio/mp3;base64,${json.audio}`);
          activeAudioRef.current = snd;
          snd.play().catch(e => console.log("Audio autoplay block:", e));
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !isLatestTtsRequest()) return;
        setTtsFeedback("API Quota protection: Seamlessly transitioned to Local Speech Engine to preserve classroom flow ⚡");
        setActiveTtsMode('local');
        console.warn("Gemini premium TTS failed or rate-limited. Permanently cascading to local browser synthesizer.", err);
        if ('speechSynthesis' in window) {
          stopCurrentSpeech(false);
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = effectiveLang === 'vi' ? 'vi-VN' : 'en-US';
          window.speechSynthesis.speak(utterance);
        }
      } finally {
        if (ttsAbortRef.current === controller) ttsAbortRef.current = null;
        if (isLatestTtsRequest()) setTtsLoading(false);
      }
    }
    else if (activeTtsMode === '9router') {
      const controller = new AbortController();
      ttsAbortRef.current = controller;
      try {
        setTtsLoading(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text, 
            language: effectiveLang,
            ttsMode: '9router',
            nineRouterConfig
          }),
          signal: controller.signal
        });
        if (!res.ok) throw new Error("9Router TTS endpoint error");
        const json = await res.json();
        if (!isLatestTtsRequest()) return;
        
        if (json.fallbackLocal) {
          throw new Error(json.error || "9Router TTS model error");
        }

        if (json.audio) {
          stopCurrentSpeech(false);
          const snd = new Audio(`data:audio/mp3;base64,${json.audio}`);
          activeAudioRef.current = snd;
          snd.play().catch(e => console.log("Audio autoplay block:", e));
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !isLatestTtsRequest()) return;
        setTtsFeedback("9Router Speak fallback: Seamlessly transitioned to Local Speech Engine to preserve classroom flow ⚡");
        setActiveTtsMode('local');
        console.warn("9Router TTS failed. Permanently cascading to local browser synthesizer.", err);
        if ('speechSynthesis' in window) {
          stopCurrentSpeech(false);
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = effectiveLang === 'vi' ? 'vi-VN' : 'en-US';
          window.speechSynthesis.speak(utterance);
        }
      } finally {
        if (ttsAbortRef.current === controller) ttsAbortRef.current = null;
        if (isLatestTtsRequest()) setTtsLoading(false);
      }
    }
  }, [activeTtsMode, isAudioMuted, config.language, nineRouterConfig, audioCache, stopCurrentSpeech]);

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

    const playbackMode = config.playbackMode || 'once';
    const nextIdx = currentIndexRef.current + 1;
    const currentList = currentCuesRef.current;

    const goToCue = (list: CueItem[], index: number) => {
      const nextCue = list[index];
      if (!nextCue) return;
      currentCuesRef.current = list;
      currentIndexRef.current = index;
      setCurrentIndex(index);
      setSecondsRemaining(config.duration);
      const targetText = languageInverted && nextCue.translation ? nextCue.translation : nextCue.text;
      speakCue(targetText, nextCue.id, languageInverted);
      setHistory(prev => {
        if (prev.find(x => x.id === nextCue.id)) return prev;
        return [...prev, nextCue];
      });
    };

    if (nextIdx < currentList.length) {
      goToCue(currentList, nextIdx);

      const remainingCount = currentList.length - nextIdx;
      if (playbackMode === 'infinite' && remainingCount < 3) {
        triggerBufferReplenish();
      }
      return;
    }

    if (playbackMode === 'once') {
      ttsRequestSeqRef.current += 1;
      stopCurrentSpeech(true);
      setIsPlaying(false);
      setSecondsRemaining(0);
      setTtsLoading(false);
      setTtsFeedback(`✅ Đã chạy hết ${currentList.length} thẻ. Bấm Start Mới hoặc chọn Loop nếu muốn chạy tiếp.`);
      return;
    }

    if (playbackMode === 'loop') {
      goToCue(currentList, 0);
      return;
    }

    if (playbackMode === 'shuffle-loop') {
      const shuffled = shuffleCues(currentList);
      setCues(shuffled);
      goToCue(shuffled, 0);
      return;
    }

    triggerBufferReplenish().then(() => {
      setTimeout(() => {
        const updatedList = currentCuesRef.current;
        if (currentIndexRef.current + 1 < updatedList.length) {
          handleNext();
        } else if (updatedList.length > 0) {
          goToCue(updatedList, 0);
        }
      }, 100);
    });
  }, [config.duration, config.playbackMode, speakCue, triggerBufferReplenish, languageInverted, stopCurrentSpeech]);

  // Pause/Resume toggler
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const toggleLanguage = useCallback(() => {
    ttsRequestSeqRef.current += 1;
    stopCurrentSpeech(true);
    setTtsLoading(false);
    setLanguageInverted(prev => !prev);
  }, [stopCurrentSpeech]);

  const speakCurrentCueInLanguage = useCallback((targetLang: 'vi' | 'en') => {
    const curCue = currentCuesRef.current[currentIndexRef.current];
    if (!curCue) return;

    const shouldUseTranslation = targetLang !== config.language && !!curCue.translation?.trim();
    const targetText = shouldUseTranslation ? curCue.translation! : curCue.text;

    // Keep the visual primary cue and the spoken language locked together.
    // Example: speaking English => English becomes #primary-cue-text, Vietnamese moves below.
    setLanguageInverted(shouldUseTranslation);
    speakCue(targetText, curCue.id, shouldUseTranslation);
  }, [config.language, speakCue]);

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
      const targetText = languageInverted && cues[0].translation ? cues[0].translation : cues[0].text;
      speakCue(targetText, cues[0].id, languageInverted);
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
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        toggleLanguage();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        const stage = document.getElementById('live-stage');
        if (stage) {
          if (!document.fullscreenElement) {
            stage.requestFullscreen().catch(err => console.warn(err));
          } else {
            document.exitFullscreen();
          }
        }
      } else if (e.code === 'KeyZ') {
        e.preventDefault();
        setCustomFontSize(prev => {
          if (prev !== null) return prev + 10;
          const el = document.getElementById('primary-cue-text');
          if (el) {
            return parseFloat(window.getComputedStyle(el).fontSize) + 10;
          }
          return 96 + 10;
        });
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        speakCurrentCueInLanguage('vi');
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        speakCurrentCueInLanguage('en');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, handleNext, onStop, config.language, speakCue, toggleLanguage, speakCurrentCueInLanguage]);
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
    <div 
      id="live-stage" 
      className={`relative flex flex-col h-full min-h-[80vh] justify-between max-w-5xl mx-auto py-2 px-4 select-none animate-scale-up transition-colors duration-300 overflow-hidden md:overflow-visible ${textPrimary}`}
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}}
    >
      {/* Top Cockpit Monitor Bar */}
      <div className={`mt-10 md:mt-0 flex flex-wrap items-center justify-between gap-3 p-4 backdrop-blur-md border rounded-2xl relative z-10 ${panelHeaderBg}`}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest block ${labelColor}`}>Lesson Topic</span>
            <div className={`flex items-center gap-2 mt-0.5 ${titleColor}`}>
              <select
                className={`text-xs font-bold outline-none cursor-pointer appearance-none bg-transparent ${titleColor}`}
                value={config.topic}
                onChange={(e) => {
                   const selectedTopic = e.target.value;
                   const lesson = availableLessons.find(l => l.topic === selectedTopic);
                   if (lesson && onStartSession) {
                      const normalizedLessonCues = normalizeCuesForSpeakingLanguage(
                        lesson.cues || [],
                        lesson.language || 'vi',
                        config.language
                      );
                      onStartSession({
                         topic: lesson.topic,
                         level: lesson.level || 'Easy',
                         language: config.language,
                         wordType: lesson.wordType || config.wordType || 'Bất kỳ',
                         duration: config.duration,
                         mode: lesson.type || 'emotion',
                         playbackMode: config.playbackMode || 'once',
                         count: normalizedLessonCues.length || 0
                      }, activeTtsMode, normalizedLessonCues);
                   }
                }}
              >
                <option value={config.topic}>{config.topic}</option>
                {availableLessons.filter(l => l.topic !== config.topic).map(l => (
                    <option key={l.id} value={l.topic}>{l.topic}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 opacity-50 pointer-events-none" />
            </div>
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
          <div className={`border px-2.5 py-1 rounded-lg flex items-center gap-1 ${pillBg}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Run: <strong className={titleColor}>{playbackModeLabels[config.playbackMode || 'once']}</strong></span>
          </div>
        </div>

        {/* Audio controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
               if (onStartSession) {
                 const isDbLesson = availableLessons.some(l => l.topic === config.topic && Array.isArray(l.cues) && l.cues.length > 0);
                 const cuesToPass = isDbLesson ? initialCues : undefined;
                 onStartSession(config, activeTtsMode, cuesToPass);
               }
            }}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'black'
                ? 'text-slate-200 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20'
                : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 shadow-xs'
            }`}
            title="Tạo Stage Mới (Restart/New Generation)"
          >
            <RefreshCw className="w-2.5 h-2.5 text-indigo-500" />
            <span>Start Mới</span>
          </button>

          <button 
            onClick={toggleFullscreen}
            type="button"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isFullscreen 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20' 
                : `${pillBg} text-slate-400 hover:text-slate-200`
            }`}
            title={isFullscreen ? "Thoát toàn màn hình (Exit Fullscreen)" : "Toàn màn hình (Fullscreen)"}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-red-500" /> : <Maximize className="w-3.5 h-3.5 text-red-500" />}
          </button>

          <button 
            onClick={() => {
              if (!isAudioMuted) {
                ttsRequestSeqRef.current += 1;
                stopCurrentSpeech(true);
                setTtsLoading(false);
              }
              setIsAudioMuted(prev => !prev);
            }}
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
          ref={cardRef}
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
          
          {/* Absolute Logo Top-Left of Stage */}
          <div className="absolute top-4 left-6 z-50">
            <img src="/logo.png" alt="Logo" className="h-12 md:h-14 object-contain drop-shadow-md opacity-80" />
          </div>

          {/* Background Flags (Language Switches) */}
          <div className="absolute top-4 xl:top-6 right-6 xl:right-8 z-50 flex flex-col xl:flex-row items-center gap-1.5 md:gap-2">
            <button 
              onClick={() => {
                ttsRequestSeqRef.current += 1;
                stopCurrentSpeech(true);
                setTtsLoading(false);
                setLanguageInverted(config.language === 'en');
              }} 
              className={`hover:scale-110 transition-all ${(!languageInverted && config.language === 'vi') || (languageInverted && config.language === 'en') ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'opacity-40 saturate-50 hover:opacity-80'}`}
              title="Vietnamese"
            >
              <img src="https://flagcdn.com/w80/vn.png" alt="VN" className="w-[44px] md:w-[50px] h-[34px] md:h-[38px] object-cover rounded-sm border border-black/10 shadow-sm" />
            </button>
            <button 
              onClick={() => {
                ttsRequestSeqRef.current += 1;
                stopCurrentSpeech(true);
                setTtsLoading(false);
                setLanguageInverted(config.language === 'vi');
              }} 
              className={`hover:scale-110 transition-all ${(!languageInverted && config.language === 'en') || (languageInverted && config.language === 'vi') ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'opacity-40 saturate-50 hover:opacity-80'}`}
              title="English"
            >
              <img src="https://flagcdn.com/w80/us.png" alt="US" className="w-[44px] md:w-[50px] h-[34px] md:h-[38px] object-cover rounded-sm border border-black/10 shadow-sm" />
            </button>
            <div className="hidden xl:block w-px h-6 bg-slate-500/30 mx-1"></div>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSettings(true); }} 
              className="p-1.5 md:p-2 mt-2 xl:mt-0 bg-slate-800/80 text-white rounded-full hover:bg-slate-700/80 transition-colors shadow-md border border-slate-700 cursor-pointer"
              title="Stage Settings"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Neon Borders Blue & Red Gradient */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-550" />

          {/* Active pacing remaining indicator bubbles */}
          <div className="absolute bottom-5 right-5 flex items-center gap-2.5 z-10">
            {isFullscreen && (
              <button 
                onClick={toggleFullscreen}
                type="button"
                className={`p-1.5 rounded-lg transition-all cursor-pointer bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20`}
                title="Thoát toàn màn hình (Exit Fullscreen)"
              >
                <Minimize className="w-3.5 h-3.5" />
              </button>
            )}
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
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3.5 flex-wrap">
                <h2 
                  id="primary-cue-text"
                  className={`${fontSizeClass} font-display font-black tracking-tight animate-scale-up select-all break-words leading-tight drop-shadow-md transition-all ${textColorClass || titleColor}`}
                  style={customFontSize ? { fontSize: `${customFontSize}px` } : undefined}
                >
                  {languageInverted && currentCue.translation ? currentCue.translation : currentCue.text}
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakCue(languageInverted && currentCue.translation ? currentCue.translation : currentCue.text, currentCue.id, languageInverted);
                  }}
                  className={`p-1.5 md:p-2.5 rounded-full border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-xs group/speak ${
                    theme === 'black'
                      ? 'bg-neutral-900 hover:bg-neutral-850 border-neutral-800 text-red-500 hover:text-red-400 hover:scale-110'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-250 text-indigo-650 hover:scale-110'
                  }`}
                  title="Phát lại giọng đọc (Replay sound)"
                >
                  <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-red-500 animate-pulse group-hover/speak:animate-none" />
                </button>
              </div>
              {(languageInverted ? currentCue.text : currentCue.translation) && (
                <p className={`${fontSizeClass === 'text-xl md:text-3xl' ? 'text-sm md:text-base' : fontSizeClass === 'text-4xl md:text-6xl' ? 'text-lg md:text-2xl' : 'text-base md:text-lg'} font-serif italic font-medium tracking-wide transition-all ${labelColor}`}>
                  {languageInverted ? currentCue.text : currentCue.translation}
                </p>
              )}
            </div>

            {/* Mode-Aware Visual Card Layout */}
            {config.mode === 'motion' ? (
              <div className="flex flex-row items-center justify-center gap-4 animate-fade-in w-full mt-2">
                {/* Animated Human-Like Pose Sketch Guide */}
                <div className={`w-36 h-40 shrink-0 rounded-2xl flex items-center justify-center shadow-inner border overflow-hidden relative ${
                  theme === 'black' ? 'bg-neutral-900/50 border-neutral-800' : 'bg-slate-100/50 border-slate-200'
                }`}>
                  <div className="w-24 h-24">
                    {currentCue.svgData ? (
                      <div className="w-full h-full flex items-center justify-center" dangerouslySetInnerHTML={{ __html: currentCue.svgData }} />
                    ) : (
                      <PoseSketch poseJson={currentCue.poseJson} />
                    )}
                  </div>
                  <div className="absolute top-2 left-2 text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Pose Guide
                  </div>
                </div>
              </div>
            ) : config.mode === 'sound' ? (
              <div className="flex flex-col items-center animate-fade-in w-full mt-2">
                <div className="flex gap-4 items-stretch justify-center w-full relative">
                  <div className={`w-32 h-40 shrink-0 rounded-2xl flex flex-col items-center justify-center p-2 relative overflow-hidden shadow-md border ${
                    theme === 'black' ? 'bg-neutral-950 border-neutral-900' : 'bg-white border-slate-200'
                  }`}>
                    {currentCue.svgData ? (
                      <div className="w-full h-full flex items-center justify-center" dangerouslySetInnerHTML={{ __html: currentCue.svgData }} />
                    ) : (
                      <Volume2 className="w-12 h-12 text-red-500 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Emotion Default Mode - only displays primary text, no hint */
              null
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
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
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
                onClick={() => {
                  const targetText = languageInverted && h.translation ? h.translation : h.text;
                  speakCue(targetText, h.id, languageInverted);
                }}
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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className={`w-full max-w-lg rounded-2xl border p-6 flex flex-col gap-6 transform transition-all shadow-2xl ${
            theme === 'black' ? 'bg-[#0E0808] border-neutral-900 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-500" />
                Stage Settings
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className={`p-1.5 rounded-lg border transition-all ${
                  theme === 'black' ? 'hover:bg-neutral-900 border-neutral-800' : 'hover:bg-slate-100 border-slate-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-neutral-800/20 dark:border-neutral-800/50 pb-2">
              <button 
                onClick={() => setActiveSettingsTab('design')}
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
                  activeSettingsTab === 'design' 
                    ? 'bg-red-500 text-white' 
                    : (theme === 'black' ? 'text-slate-400 hover:text-slate-200 hover:bg-neutral-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')
                }`}
              >
                Design & Hotkeys
              </button>
              <button 
                onClick={() => setActiveSettingsTab('settings')}
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
                  activeSettingsTab === 'settings' 
                    ? 'bg-red-500 text-white' 
                    : (theme === 'black' ? 'text-slate-400 hover:text-slate-200 hover:bg-neutral-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')
                }`}
              >
                9Router
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
              {activeSettingsTab === 'design' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'black' ? 'text-slate-500' : 'text-slate-400'}`}>Main Font Size (Text)</label>
                    <div className="flex gap-2">
                      <button onClick={() => { setFontSizeClass('text-xl md:text-3xl'); setCustomFontSize(null); }} className={`flex-1 py-2 rounded text-xs font-bold transition-all border ${fontSizeClass === 'text-xl md:text-3xl' ? 'border-red-500 text-red-500 bg-red-500/10' : (theme === 'black' ? 'border-neutral-800 text-slate-400 hover:border-neutral-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>Small</button>
                      <button onClick={() => { setFontSizeClass('text-3xl md:text-5xl'); setCustomFontSize(null); }} className={`flex-1 py-2 rounded text-xs font-bold transition-all border ${fontSizeClass === 'text-3xl md:text-5xl' ? 'border-red-500 text-red-500 bg-red-500/10' : (theme === 'black' ? 'border-neutral-800 text-slate-400 hover:border-neutral-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>Normal</button>
                      <button onClick={() => { setFontSizeClass('text-4xl md:text-6xl'); setCustomFontSize(null); }} className={`flex-1 py-2 rounded text-xs font-bold transition-all border ${fontSizeClass === 'text-4xl md:text-6xl' ? 'border-red-500 text-red-500 bg-red-500/10' : (theme === 'black' ? 'border-neutral-800 text-slate-400 hover:border-neutral-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>Large</button>
                      <button onClick={() => { setFontSizeClass('text-6xl md:text-8xl'); setCustomFontSize(null); }} className={`flex-1 py-2 rounded text-xs font-bold transition-all border ${fontSizeClass === 'text-6xl md:text-8xl' ? 'border-red-500 text-red-500 bg-red-500/10' : (theme === 'black' ? 'border-neutral-800 text-slate-400 hover:border-neutral-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>Very Large</button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'black' ? 'text-slate-500' : 'text-slate-400'}`}>Primary Text Color (Override)</label>
                    <div className="flex gap-2">
                      <button onClick={() => setTextColorClass('')} className={`flex-1 py-2 rounded border text-xs font-bold transition-all ${textColorClass === '' ? 'border-red-500 bg-red-500/10 text-red-500' : (theme === 'black' ? 'border-neutral-800 text-slate-400' : 'border-slate-200 text-slate-600')}`}>Auto</button>
                      <button onClick={() => setTextColorClass('text-red-500')} className={`flex-1 py-2 rounded border text-xs font-bold text-red-500 transition-all ${textColorClass === 'text-red-500' ? 'border-red-500 bg-red-500/10' : (theme === 'black' ? 'border-neutral-800' : 'border-slate-200')}`}>Red</button>
                      <button onClick={() => setTextColorClass('text-amber-400')} className={`flex-1 py-2 rounded border text-xs font-bold text-amber-400 transition-all ${textColorClass === 'text-amber-400' ? 'border-amber-500 bg-amber-500/10' : (theme === 'black' ? 'border-neutral-800' : 'border-slate-200')}`}>Amber</button>
                      <button onClick={() => setTextColorClass('text-emerald-400')} className={`flex-1 py-2 rounded border text-xs font-bold text-emerald-400 transition-all ${textColorClass === 'text-emerald-400' ? 'border-emerald-500 bg-emerald-500/10' : (theme === 'black' ? 'border-neutral-800' : 'border-slate-200')}`}>Emerald</button>
                      <button onClick={() => setTextColorClass('text-cyan-400')} className={`flex-1 py-2 rounded border text-xs font-bold text-cyan-400 transition-all ${textColorClass === 'text-cyan-400' ? 'border-cyan-500 bg-cyan-500/10' : (theme === 'black' ? 'border-neutral-800' : 'border-slate-200')}`}>Cyan</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'black' ? 'text-slate-500' : 'text-slate-400'}`}>Stage Backdrop Background Image</label>
                    <input 
                      type="text" 
                      value={bgImage} 
                      onChange={(e) => setBgImage(e.target.value)} 
                      placeholder="Image URL (Clear to remove)..."
                      className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 transition-all ${theme === 'black' ? 'bg-neutral-950 border border-neutral-800 text-slate-300' : 'bg-slate-50 border border-slate-200 text-slate-800'}`}
                    />
                  </div>

                  <div className={`p-4 rounded-xl border text-xs ${theme === 'black' ? 'bg-neutral-900/50 border-neutral-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <h4 className="font-bold mb-3 text-sm text-red-500">Stage Hotkeys Map</h4>
                    <ul className="space-y-2.5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5">
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">Space</span> <span>Pause / Resume</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">Enter</span> <span>Next Target</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">Esc</span> <span>Exit Live Mode</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">L</span> <span>Toggle Language Target</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">F</span> <span>Toggle Fullscreen</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">Z</span> <span>Zoom Text +10px</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">V</span> <span>Speak Vietnamese</span></li>
                      <li className="flex justify-between items-center"><span className="px-1.5 py-0.5 rounded border border-current font-bold uppercase text-[10px]">E</span> <span>Speak English</span></li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'settings' && (
                <div className="space-y-5">
                  <p className={`text-xs leading-relaxed ${theme === 'black' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Active session environment uses the following <strong>9Router Orchestration</strong> configurations. Changes must be applied in the Dashboard prior to launching the Stage.
                  </p>
                  
                  <div className="space-y-4">
                    <div className={`p-3 rounded-xl border ${theme === 'black' ? 'bg-neutral-900/40 border-neutral-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className={`block text-[10px] uppercase tracking-widest font-bold mb-1 ${theme === 'black' ? 'text-slate-500' : 'text-slate-400'}`}>Status</span>
                      <div className="text-sm font-bold flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${nineRouterConfig?.enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div> 
                        {nineRouterConfig?.enabled ? 'Online / Actively Routed' : 'Offline / Default Gateway'}
                      </div>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'black' ? 'text-slate-600' : 'text-slate-400'}`}>Instance Origin URL</span>
                      <span className="text-xs font-mono opacity-80 break-all">{nineRouterConfig?.url || 'N/A'}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'black' ? 'text-slate-600' : 'text-slate-400'}`}>Generative LLM Model</span>
                      <span className="text-xs font-mono opacity-80 bg-black/10 px-1 py-0.5 rounded">{nineRouterConfig?.llmModel || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className={`block text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'black' ? 'text-slate-600' : 'text-slate-400'}`}>Vietnamese TTS</span>
                        <span className="text-xs font-mono opacity-80 block truncate" title={nineRouterConfig?.ttsModelVi}>{nineRouterConfig?.ttsModelVi || 'N/A'}</span>
                      </div>
                      <div>
                        <span className={`block text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'black' ? 'text-slate-600' : 'text-slate-400'}`}>English TTS</span>
                        <span className="text-xs font-mono opacity-80 block truncate" title={nineRouterConfig?.ttsModelEn}>{nineRouterConfig?.ttsModelEn || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
