import React, { useState, useEffect } from 'react';
import { SessionConfig, NineRouterConfig, CueItem } from '../types';
import { 
  Sparkles, 
  HelpCircle, 
  GraduationCap, 
  Languages, 
  Play, 
  Clock, 
  Check, 
  Trash2, 
  Volume2, 
  Settings, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Link2, 
  Brain, 
  Save, 
  Plus, 
  Flame, 
  VolumeX, 
  BookOpen,
  Eye,
  Info,
  Sliders,
  Database,
  ChevronDown,
  ChevronUp,
  Terminal,
  Code,
  Globe,
  Send,
  Activity,
  X
} from 'lucide-react';

interface SetupPresenterProps {
  onStart: (
    config: SessionConfig, 
    ttsMode: 'local' | 'gemini' | 'silent' | '9router',
    preloadedCues?: CueItem[]
  ) => void;
  nineRouterConfig: NineRouterConfig;
  onUpdateNineRouter: (config: NineRouterConfig) => void;
  theme: 'black' | 'light';
}

const POSE_PRESETS = [
  {
    name: "Chim ưng lướt gió",
    coords: '{"head": [50, 15], "spine": [[50,15], [50,55]], "leftArm": [[50,30], [20,25], [5,25]], "rightArm": [[50,30], [80,25], [95,25]], "leftLeg": [[50,55], [40,85]], "rightLeg": [[50,55], [60,85]]}'
  },
  {
    name: "Báo đốm vồ mồi",
    coords: '{"head": [50, 20], "spine": [[50,20], [45,40], [30,55]], "leftArm": [[45,40], [55,50], [65,60]], "rightArm": [[45,40], [30,30], [20,25]], "leftLeg": [[30,55], [35,75], [40,90]], "rightLeg": [[30,55], [20,70], [10,85]]}'
  },
  {
    name: "Chiến binh hiên ngang",
    coords: '{"head": [50, 18], "spine": [[50,18], [50,55]], "leftArm": [[50,28], [30,28], [15,15]], "rightArm": [[50,28], [70,28], [85,40]], "leftLeg": [[50,55], [35,85]], "rightLeg": [[50,55], [65,85]]}'
  }
];

function PosePreviewBox({ poseJson }: { poseJson: string }) {
  try {
    const coords = JSON.parse(poseJson);
    const head = coords.head || [50, 20];
    const spine = coords.spine || [[50, 20], [50, 55]];
    const leftArm = coords.leftArm || [[50, 30], [30, 30]];
    const rightArm = coords.rightArm || [[50, 30], [70, 30]];
    const leftLeg = coords.leftLeg || [[50, 55], [35, 85]];
    const rightLeg = coords.rightLeg || [[50, 55], [65, 85]];

    return (
      <svg viewBox="0 0 100 100" className="w-16 h-16 stroke-amber-400 stroke-[3.5] fill-none stroke-round overflow-visible">
        <circle cx={head[0]} cy={head[1]} r="7" className="stroke-amber-400 fill-amber-500/10" />
        {spine.length > 1 && <path d={`M ${spine.map((p: any) => p.join(',')).join(' L ')}`} />}
        {leftArm.length > 1 && <path d={`M ${leftArm.map((p: any) => p.join(',')).join(' L ')}`} />}
        {rightArm.length > 1 && <path d={`M ${rightArm.map((p: any) => p.join(',')).join(' L ')}`} />}
        {leftLeg.length > 1 && <path d={`M ${leftLeg.map((p: any) => p.join(',')).join(' L ')}`} />}
        {rightLeg.length > 1 && <path d={`M ${rightLeg.map((p: any) => p.join(',')).join(' L ')}`} />}
      </svg>
    );
  } catch (e) {
    return (
      <div className="text-[10px] text-amber-500/80 font-mono text-center">Invalid coordinates</div>
    );
  }
}

const API_ENDPOINTS = [
  {
    name: "System Status & Telemetry",
    method: "GET",
    path: "/api/status",
    description: "Returns physical host info, custom lesson database counts, Node runner version, and active Gemini credential keys.",
    defaultBody: "",
    hasBody: false
  },
  {
    name: "Retrieve Physical Lessons",
    method: "GET",
    path: "/api/lessons",
    description: "Queries and fetches all stored theatrical lesson blueprints & gestural blueprints saved in the database storage.",
    defaultBody: "",
    hasBody: false
  },
  {
    name: "Save Custom Lesson Record",
    method: "POST",
    path: "/api/lessons",
    description: "Saves a newly constructed custom training lesson & physical gestures to the local JSON database.",
    defaultBody: JSON.stringify({
      topic: "Kiểm thử API Tự động",
      type: "emotion",
      cues: [
        {
          id: "test-cue-1",
          text: "Hạnh phúc ngập tràn",
          translation: "Radiant happiness with hands on chest",
          category: "emotion"
        },
        {
          id: "test-cue-2",
          text: "Sợ hãi rụt rè",
          translation: "Timid fright with hands shielding eyes",
          category: "emotion"
        }
      ]
    }, null, 2),
    hasBody: true
  },
  {
    name: "Generate Prompts with AI (LLM)",
    method: "POST",
    path: "/api/cue/generate",
    description: "Invokes standard Gemini AI schemas or custom 9Router LLM with criteria to return 5 distinct structured gestural/theatrical prompts.",
    defaultBody: JSON.stringify({
      mode: "emotion",
      topic: "Đời sống nơi văn phòng công sở",
      wordType: "Danh từ vui vẻ",
      level: "Medium",
      language: "vi",
      count: 2
    }, null, 2),
    hasBody: true
  },
  {
    name: "Speech-To-Text (STT) Audio Analyzer",
    method: "POST",
    path: "/api/stt/analyze",
    description: "Performs phoneme alignment comparison on spoken user lines against designated response targets of chosen prompts.",
    defaultBody: JSON.stringify({
      originalText: "I am flying high like a strong eagle inside the storm.",
      spokenText: "I am flying high like a strong eagle in the storm."
    }, null, 2),
    hasBody: true
  },
  {
    name: "Synthesize Vocal Waves (TTS)",
    method: "POST",
    path: "/api/tts",
    description: "Translates and synthesizes Vietnamese or English theatrical lines to fluid human speaking voice audio data streams.",
    defaultBody: JSON.stringify({
      text: "Hãy tự tin giải phóng toàn bộ năng lượng hình thể của bạn trên sân khấu kịch tương tác!",
      language: "vi",
      nineRouterConfig: {
        enabled: false,
        url: "http://localhost:3000",
        llmModel: "gemini-2.5-flash",
        sttModel: "whisper-1",
        ttsModelVi: "edge-tts/vi-VN-HoaiMyNeural",
        ttsModelEn: "edge-tts/en-US-AriaNeural"
      }
    }, null, 2),
    hasBody: true
  }
];

export default function SetupPresenter({ onStart, nineRouterConfig, onUpdateNineRouter, theme }: SetupPresenterProps) {
  // Navigation Dashboard states: 'launcher' | 'database' | 'settings' | 'api'
  const [cockpitTab, setCockpitTab] = useState<'launcher' | 'database' | 'settings' | 'api'>('launcher');

  // Interactive API Sandbox Console states
  const [selectedApiIndex, setSelectedApiIndex] = useState<number>(0);
  const [apiRequestBody, setApiRequestBody] = useState<string>('');
  const [apiRequestHeaders, setApiRequestHeaders] = useState<string>('{\n  "Content-Type": "application/json"\n}');
  const [apiResponseStatus, setApiResponseStatus] = useState<number | null>(null);
  const [apiResponseHeaders, setApiResponseHeaders] = useState<string>('');
  const [apiResponseBody, setApiResponseBody] = useState<string>('');
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [apiExecutionTime, setApiExecutionTime] = useState<number | null>(null);

  // Sync default payload when selected API changes
  useEffect(() => {
    const endpoint = API_ENDPOINTS[selectedApiIndex];
    if (endpoint) {
      setApiRequestBody(endpoint.defaultBody || '');
      setApiResponseStatus(null);
      setApiResponseHeaders('');
      setApiResponseBody('');
      setApiExecutionTime(null);
    }
  }, [selectedApiIndex]);

  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [topic, setTopic] = useState<string>('Thế giới động vật hoang dã');
  const [wordType, setWordType] = useState<string>('Bất kỳ');
  const [level, setLevel] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [duration, setDuration] = useState<number>(5);
  // Default speaking modes - using 9router as specified by user intent
  const [ttsMode, setTtsMode] = useState<'local' | 'gemini' | 'silent' | '9router'>('9router');

  // Mode Selection Tabs (Motion, Sound, Emotion)
  const [activeTab, setActiveTab] = useState<'motion' | 'sound' | 'emotion'>('emotion');

  // Database lessons loading
  const [savedLessons, setSavedLessons] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [seedingLoading, setSeedingLoading] = useState<boolean>(false);
  const [dbStatusMsg, setDbStatusMsg] = useState<string>('');
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');
  const [dbCategoryFilter, setDbCategoryFilter] = useState<'all' | 'motion' | 'sound' | 'emotion'>('all');

  // Dynamically pre-filter database based on currently active launcher tab!
  useEffect(() => {
    if (cockpitTab === 'database') {
      setDbCategoryFilter(activeTab);
    }
  }, [cockpitTab, activeTab]);

  // Design enhancements: state to manage expandable/collapsible details
  const [expandedCueId, setExpandedCueId] = useState<string | null>('d1');
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [generatingAudioLessonId, setGeneratingAudioLessonId] = useState<string | null>(null);
  const [loadedLessonId, setLoadedLessonId] = useState<string | null>(null);
  const [sampleCardCount, setSampleCardCount] = useState<number>(5);

  // 9Router Testing states
  const [routerTesting, setRouterTesting] = useState<boolean>(false);
  const [routerTestFeedback, setRouterTestFeedback] = useState<string>('');
  const [routerTestedModels, setRouterTestedModels] = useState<string[]>([]);
  const [showSampleGenerator, setShowSampleGenerator] = useState<boolean>(false);
  
  // Sample Generator Modal States
  const [sampleTopic, setSampleTopic] = useState<string>('Cuộc sống hằng ngày');
  const [sampleLevel, setSampleLevel] = useState<string>('Dễ - Mầm non & Tiểu học');
  const [sampleCount, setSampleCount] = useState<number>(5);
  const [sampleType, setSampleType] = useState<'emotion' | 'motion' | 'sound'>('emotion');
  const [sampleLang, setSampleLang] = useState<'vi' | 'en'>('vi');
  const [sampleWordType, setSampleWordType] = useState<string>('Từ đơn');

  // Draft Cues - Initialized with exactly 4 elegant, multi-category cards (Draft Lesson Cards (4))
  const [customCues, setCustomCues] = useState<CueItem[]>([
    { 
      id: 'd1', 
      text: 'Chim ưng', 
      translation: 'Falcon', 
      category: 'motion', 
      poseJson: '{"head": [50, 15], "spine": [[50,15], [50,55]], "leftArm": [[50,30], [20,25], [5,25]], "rightArm": [[50,30], [80,25], [95,25]], "leftLeg": [[50,55], [40,85]], "rightLeg": [[50,55], [60,85]]}' 
    },
    { 
      id: 'd2', 
      text: 'Con sói', 
      translation: 'Wolf', 
      category: 'sound', 
      soundText: 'Awooooo! Awooo!' 
    },
    { 
      id: 'd3', 
      text: 'Con người', 
      translation: 'Human', 
      category: 'emotion' 
    },
    { 
      id: 'd4', 
      text: 'Sư tử', 
      translation: 'Lion', 
      category: 'emotion' 
    },
    { 
      id: 'd5', 
      text: 'Cây', 
      translation: 'Tree', 
      category: 'emotion' 
    }
  ]);

  // Read Database safest
  const loadLessons = async () => {
    setDbLoading(true);
    try {
      const res = await fetch('/api/lessons');
      if (res.ok) {
        const data = await res.json();
        setSavedLessons(data);
      }
    } catch (e) {
      console.error("Unable to load lessons database", e);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, []);

  // Update topic automatically if it is currently a default title, but DO NOT overwrite draft cards!
  useEffect(() => {
    if (!topic || topic === 'Thế giới động vật hoang dã' || topic === 'Physical animal actions and gestures' || topic === 'Animal Sound Imitation' || topic === 'Trường học mộng mơ') {
      if (activeTab === 'motion') {
        setTopic('Physical animal actions and gestures');
      } else if (activeTab === 'sound') {
        setTopic('Animal Sound Imitation');
      } else {
        setTopic('Trường học mộng mơ');
      }
    }
  }, [activeTab]);

  // Handle resetting or reloading tab default presets on demand
  const handleLoadModePresets = () => {
    setLoadedLessonId(null);
    if (activeTab === 'motion') {
      setCustomCues([
        { id: 'm1', text: 'Báo đốm', translation: 'Jaguar', category: 'motion', poseJson: '{"head": [50, 20], "spine": [[50,20], [45,40], [30,55]], "leftArm": [[45,40], [55,50], [65,60]], "rightArm": [[45,40], [30,30], [20,25]], "leftLeg": [[30,55], [35,75], [40,90]], "rightLeg": [[30,55], [20,70], [10,85]]}' },
        { id: 'm2', text: 'Chim ưng', translation: 'Falcon', category: 'motion', poseJson: '{"head": [50, 15], "spine": [[50,15], [50,55]], "leftArm": [[50,30], [20,25], [5,25]], "rightArm": [[50,30], [80,25], [95,25]], "leftLeg": [[50,55], [40,85]], "rightLeg": [[50,55], [60,85]]}' }
      ]);
    } else if (activeTab === 'sound') {
      setCustomCues([
        { id: 's1', text: 'Con vịt', translation: 'Duck', category: 'sound', soundText: 'Quack! Quack!' },
        { id: 's2', text: 'Con sói', translation: 'Wolf', category: 'sound', soundText: 'Awooooo! Awooo!' }
      ]);
    } else {
      setCustomCues([
        { id: 'e1', text: 'Con người', translation: 'Human', category: 'emotion' },
        { id: 'e2', text: 'Sư tử', translation: 'Lion', category: 'emotion' },
        { id: 'e3', text: 'Cây', translation: 'Tree', category: 'emotion' }
      ]);
    }
    setDbStatusMsg(`🔄 Reset loaded default preset draft cues for ${activeTab}!`);
    setTimeout(() => setDbStatusMsg(''), 2500);
  };

  // Persist Current Cue List
  const handleSaveToDatabase = async () => {
    if (!topic.trim()) {
      setDbStatusMsg("⚠️ Please enter a topic title first.");
      setTimeout(() => setDbStatusMsg(''), 3000);
      return;
    }
    setDbStatusMsg("💾 Persisting deck to JSON Storage...");
    try {
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: loadedLessonId,
          topic: topic.trim(),
          type: activeTab,
          level,
          language,
          cues: customCues,
          nineRouterConfig
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.lesson && data.lesson.id) {
          setLoadedLessonId(data.lesson.id);
        }
        setDbStatusMsg("✅ Successfully saved library lesson!");
        loadLessons();
        setTimeout(() => setDbStatusMsg(''), 2500);
      } else {
        throw new Error("Bad backend status");
      }
    } catch (err: any) {
      setDbStatusMsg(`❌ Save failed: ${err.message}`);
      setTimeout(() => setDbStatusMsg(''), 3000);
    }
  };

  // Transfer and Auto-Classify Draft Cards (4) into their appropriate Folder Categories (Directories) in DB
  const handleAutoClassifyAndSave = async () => {
    if (!customCues || customCues.length === 0) {
      setDbStatusMsg("⚠️ Cues draft is empty. Please add some cards first.");
      setTimeout(() => setDbStatusMsg(''), 3000);
      return;
    }

    setDbStatusMsg("💾 Sorting and classifying cards into corresponding DB folder categories...");

    try {
      // Split cues based on their category field
      const motionCues = customCues.filter(c => c.category === 'motion');
      const soundCues = customCues.filter(c => c.category === 'sound');
      const emotionCues = customCues.filter(c => c.category === 'emotion' || !c.category);

      let savedFoldersCount = 0;

      // Classify & Save Motion section
      if (motionCues.length > 0) {
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `${topic.trim()} (Motion Library)`,
            type: 'motion',
            level,
            language,
            cues: motionCues,
            nineRouterConfig
          })
        });
        if (res.ok) savedFoldersCount++;
      }

      // Classify & Save Sound section
      if (soundCues.length > 0) {
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `${topic.trim()} (Sound Library)`,
            type: 'sound',
            level,
            language,
            cues: soundCues,
            nineRouterConfig
          })
        });
        if (res.ok) savedFoldersCount++;
      }

      // Classify & Save Words List section
      if (emotionCues.length > 0) {
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `${topic.trim()} (Words Library)`,
            type: 'emotion',
            level,
            language,
            cues: emotionCues,
            nineRouterConfig
          })
        });
        if (res.ok) savedFoldersCount++;
      }

      if (savedFoldersCount > 0) {
        setDbStatusMsg(`✅ Successfully sorted and saved ${customCues.length} draft cards into ${savedFoldersCount} DB folders!`);
        loadLessons();
      } else {
        throw new Error("Unable to categorize lessons at this time");
      }
      setTimeout(() => setDbStatusMsg(''), 4500);
    } catch (err: any) {
      setDbStatusMsg(`❌ Sorting failed: ${err.message}`);
      setTimeout(() => setDbStatusMsg(''), 4000);
    }
  };

  const handleLoadLesson = (lesson: any) => {
    setLoadedLessonId(lesson.id);
    setActiveTab(lesson.type);
    setTopic(lesson.topic);
    setLevel(lesson.level || 'Easy');
    setLanguage(lesson.language || 'vi');
    setCustomCues(lesson.cues || []);
    setDbStatusMsg(`Loaded "${lesson.topic}" into Launcher workspace memory!`);
    setCockpitTab('launcher');
    setTimeout(() => setDbStatusMsg(''), 3500);
  };

  const handleDeleteLesson = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Use safe state confirmation instead of browserconfirm
    setDeletingLessonId(id);
  };

  const handleExecuteDeleteLesson = async (id: string) => {
    setDbStatusMsg("🗑️ Deleting lesson from JSON storage...");
    try {
      const res = await fetch(`/api/lessons/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDbStatusMsg("✅ Successfully deleted lesson from database.");
        loadLessons();
      }
    } catch (err: any) {
      console.error("Delete call failed", err);
      setDbStatusMsg(`❌ Delete failed: ${err.message}`);
    } finally {
      setDeletingLessonId(null);
      setTimeout(() => setDbStatusMsg(''), 3000);
    }
  };

  const handleGenerateMissingAudio = async (lessonId: string) => {
    setGeneratingAudioLessonId(lessonId);
    setDbStatusMsg("⚡ Scanning cues & synthesizing missing audio voice clips...");
    try {
      const res = await fetch(`/api/lessons/${lessonId}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nineRouterConfig })
      });
      if (res.ok) {
        const data = await res.json();
        setDbStatusMsg(`🎉 Status: ${data.message}`);
        loadLessons();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Generation error");
      }
    } catch (err: any) {
      setDbStatusMsg(`❌ Audio synthesis failed: ${err.message}`);
    } finally {
      setGeneratingAudioLessonId(null);
      setTimeout(() => setDbStatusMsg(''), 5500);
    }
  };

  const generateSampleLessonViaLLM = async () => {
    setSeedingLoading(true);
    setDbStatusMsg("⚡ Đang dùng AI tạo bài học mẫu, vui lòng chờ...");
    try {
      // 1. Generate cues using LLM Route
      const res = await fetch('/api/cue/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: sampleTopic,
          wordType: sampleWordType,
          level: sampleLevel,
          language: sampleLang,
          count: sampleCount,
          nineRouterConfig
        })
      });
      
      if (!res.ok) throw new Error("Generative API failed");
      const data = await res.json();
      
      if (data.cues && data.cues.length > 0) {
        const soundViPresets = ['Gâu Gâu! 🐕', 'Meo Meo! 🐈', 'Quác Quác! 🦆', 'Ò ó o! 🐓', 'Oạp Oạp! 🐸', 'Húuuu! 🐺', 'U uuu! 🦍', 'Chíp Chíp! 🐥'];
        const soundEnPresets = ['Woof Woof! 🐕', 'Meow Meow! 🐈', 'Quack Quack! 🦆', 'Cock-a-doodle-doo! 🐓', 'Ribbit Ribbit! 🐸', 'Awooooo! 🐺', 'Hoot Hoot! 🦉', 'Tweet Tweet! 🐥'];
        
        const adapted = data.cues.map((cue: any, i: number) => ({
          id: `llm-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
          text: cue.text,
          translation: cue.translation,
          category: sampleType,
          poseJson: sampleType === 'motion' ? POSE_PRESETS[i % POSE_PRESETS.length].coords : undefined,
          soundText: sampleType === 'sound' ? (sampleLang === 'vi' ? soundViPresets[i % soundViPresets.length] : soundEnPresets[i % soundEnPresets.length]) : undefined
        }));

        // 2. Save directly to DB as a lesson
        const titleSuffix = sampleType === 'emotion' ? '(Từ vựng)' : sampleType === 'motion' ? '(Motion)' : '(Sound)';
        const saveRes = await fetch('/api/lessons/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `${sampleTopic} ${titleSuffix}`,
            type: sampleType,
            cues: adapted
          })
        });

        if (saveRes.ok) {
          setDbStatusMsg(`✅ Đã tạo thành công bài học mẫu: ${sampleTopic}`);
          setShowSampleGenerator(false);
          loadLessons();
        } else {
          throw new Error("Lỗi khi lưu bài học");
        }
      } else {
        throw new Error("Dữ liệu tạo ra trống");
      }
    } catch (err: any) {
      setDbStatusMsg(`❌ Lỗi tạo bài mẫu: ${err.message}`);
    } finally {
      setSeedingLoading(false);
      setTimeout(() => setDbStatusMsg(''), 4500);
    }
  };

  // Generate cues on the fly
  const handleGenerateViaLLM = async () => {
    setAiGenerating(true);
    setDbStatusMsg("⚡ Asking generative model for fresh ideas...");
    try {
      const res = await fetch('/api/cue/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          wordType,
          level,
          language,
          count: sampleCardCount,
          nineRouterConfig
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cues && data.cues.length > 0) {
          const soundViPresets = ['Gâu Gâu! 🐕', 'Meo Meo! 🐈', 'Quác Quác! 🦆', 'Ò ó o! 🐓', 'Oạp Oạp! 🐸', 'Húuuu! 🐺', 'U uuu! 🦍', 'Chíp Chíp! 🐥'];
          const soundEnPresets = ['Woof Woof! 🐕', 'Meow Meow! 🐈', 'Quack Quack! 🦆', 'Cock-a-doodle-doo! 🐓', 'Ribbit Ribbit! 🐸', 'Awooooo! 🐺', 'Hoot Hoot! 🦉', 'Tweet Tweet! 🐥'];
          
          const adapted = data.cues.map((cue: any, i: number) => ({
            id: `llm-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
            text: cue.text,
            translation: cue.translation,
            category: activeTab,
            poseJson: activeTab === 'motion' ? POSE_PRESETS[i % POSE_PRESETS.length].coords : undefined,
            soundText: activeTab === 'sound' ? (language === 'vi' ? soundViPresets[i % soundViPresets.length] : soundEnPresets[i % soundEnPresets.length]) : undefined
          }));
          setCustomCues(adapted);
          // Set first cue as expanded so they see details easily
          if (adapted.length > 0) {
            setExpandedCueId(adapted[0].id);
          }
          setDbStatusMsg(`✅ Generated ${adapted.length} scenic cues using AI!`);
          setTimeout(() => setDbStatusMsg(''), 4000);
        } else {
          throw new Error("Returned cues list was empty");
        }
      } else {
        throw new Error(`Error API Code ${res.status}`);
      }
    } catch (e: any) {
      setDbStatusMsg(`⚠️ Generated fail: ${e.message}. Tweak options or write cards.`);
      setTimeout(() => setDbStatusMsg(''), 5000);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddCueItem = () => {
    const nextId = String(customCues.length + 1) + '-' + Math.random().toString(36).substring(2, 4);
    
    let defaultText = 'Cây bút';
    let defaultTranslation = 'Pen';
    
    if (wordType === 'Dạng câu hỏi') {
      defaultText = language === 'vi' ? 'Tại sao?' : 'Why?';
      defaultTranslation = language === 'vi' ? 'Why?' : 'Tại sao?';
    } else {
      defaultText = activeTab === 'motion' ? 'Chạy' : activeTab === 'sound' ? 'Con mèo' : 'Cây bút';
      defaultTranslation = activeTab === 'motion' ? 'Run' : activeTab === 'sound' ? 'Cat' : 'Pen';
    }

    const newCue: CueItem = {
      id: nextId,
      text: defaultText,
      translation: defaultTranslation,
      category: activeTab,
      poseJson: activeTab === 'motion' ? POSE_PRESETS[0].coords : undefined,
      soundText: activeTab === 'sound' ? 'Meow Meow!' : undefined
    };
    setCustomCues([...customCues, newCue]);
    setExpandedCueId(nextId);
  };

  const handleUpdateCueValue = (cueId: string, field: keyof CueItem, value: string) => {
    setCustomCues(customCues.map(c => c.id === cueId ? { ...c, [field]: value } : c));
  };

  const handleRemoveCueItem = (id: string) => {
    setCustomCues(customCues.filter(c => c.id !== id));
  };

  const testRouterConnection = async () => {
    setRouterTesting(true);
    setRouterTestFeedback("Contacting 9Router Endpoint...");
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
      const data = await res.json();
      if (res.ok && data.ok) {
        setRouterTestFeedback(`✅ Connect successful! Connection works perfectly.`);
        setRouterTestedModels(data.models || []);
      } else {
        setRouterTestFeedback(`❌ Hook failed: ${data.error || "Internal error feedback"}`);
      }
    } catch (e: any) {
      setRouterTestFeedback(`❌ Connectivity error: ${e.message}`);
    } finally {
      setRouterTesting(false);
    }
  };

  const handleExecuteApiTest = async () => {
    setApiLoading(true);
    setApiResponseStatus(null);
    setApiResponseHeaders('');
    setApiResponseBody('');
    setApiExecutionTime(null);
    const startTime = performance.now();
    
    try {
      const endpoint = API_ENDPOINTS[selectedApiIndex];
      let finalPath = endpoint.path;
      const fetchOptions: RequestInit = {
        method: endpoint.method,
        headers: JSON.parse(apiRequestHeaders)
      };
      
      if (endpoint.hasBody && apiRequestBody) {
        fetchOptions.body = apiRequestBody;
      }
      
      const response = await fetch(finalPath, fetchOptions);
      const endTime = performance.now();
      setApiExecutionTime(Math.round(endTime - startTime));
      setApiResponseStatus(response.status);
      
      const responseText = await response.text();
      try {
        const parsed = JSON.parse(responseText);
        setApiResponseBody(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setApiResponseBody(responseText);
      }
      
      const headersMap: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headersMap[key] = val;
      });
      setApiResponseHeaders(JSON.stringify(headersMap, null, 2));
    } catch (err: any) {
      const endTime = performance.now();
      setApiExecutionTime(Math.round(endTime - startTime));
      setApiResponseStatus(500);
      setApiResponseBody(`Execution Error: ${err.message || 'Server connection failed.'}`);
    } finally {
      setApiLoading(false);
    }
  };

  const handleLaunchDirect = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      topic: topic || "Spontaneous Speaking HUD",
      wordType,
      level,
      language,
      duration,
      mode: activeTab,
      count: sampleCardCount
    }, ttsMode, customCues);
  };

  // High contrast palette assignment mapping
  const panelsBg = theme === 'black' ? 'bg-[#0E0808] border-neutral-900 shadow-neutral-950/40 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-sm';
  const headerText = theme === 'black' ? 'text-white' : 'text-slate-900';
  const labelText = theme === 'black' ? 'text-slate-400' : 'text-slate-500';
  const innerBg = theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900';
  const smallText = theme === 'black' ? 'text-slate-500' : 'text-slate-400';
  const borderStyle = theme === 'black' ? 'border-neutral-900' : 'border-slate-200';

  const filteredSavedLessons = savedLessons.filter(l => {
    const matchesSearch = l.topic?.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
                          l.type?.toLowerCase().includes(dbSearchQuery.toLowerCase());
    if (dbCategoryFilter === 'all') return matchesSearch;
    return matchesSearch && l.type === dbCategoryFilter;
  });

  return (
    <div id="setup-panel" className="max-w-6xl mx-auto py-2 px-6 h-full flex flex-col justify-center animate-fade-in">
      
      {/* Dynamic Header Section */}
      <div className="text-center mb-6">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border mb-3 shadow-inner ${
          theme === 'black' 
            ? 'bg-red-950/20 text-red-400 border-red-900/30' 
            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
        }`}>
          <GraduationCap className="w-3.5 h-3.5 animate-pulse" />
          <span>Interactive Improv projection HUD</span>
        </div>
        
        <h1 className={`text-3xl md:text-4xl font-display font-extrabold tracking-tight mb-2 ${headerText}`}>
          Improv Workspace Control <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent font-serif font-normal italic">Panel</span>
        </h1>
        <p className={`text-xs max-w-lg mx-auto leading-relaxed ${smallText}`}>
          Switch between quick stage setups, local JSON databases, and custom 9Router LLM/Speech settings from the menu below.
        </p>
      </div>

      {/* Primary Dashboard Navigation Bar (Horizontal Menu Navigation) */}
      <div className={`flex items-center justify-center p-1.5 rounded-2xl border mb-6 shadow-sm ${
        theme === 'black' ? 'bg-neutral-950/80 border-neutral-900' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => setCockpitTab('launcher')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase transition-all cursor-pointer ${
            cockpitTab === 'launcher'
              ? (theme === 'black' ? 'bg-[#180909] text-red-400 shadow' : 'bg-white text-indigo-700 shadow')
              : (theme === 'black' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>Stage Launcher</span>
        </button>

        <button
          type="button"
          onClick={() => setCockpitTab('database')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase transition-all cursor-pointer ${
            cockpitTab === 'database'
              ? (theme === 'black' ? 'bg-[#180909] text-red-400 shadow' : 'bg-white text-indigo-700 shadow')
              : (theme === 'black' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          <span>Database Explorer</span>
          {savedLessons.length > 0 && (
            <span className={`text-[10px] rounded-full px-1.5 py-0.5 leading-none font-bold ${
              theme === 'black' ? 'bg-[#3A1414] text-red-300' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {savedLessons.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCockpitTab('settings')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase transition-all cursor-pointer ${
            cockpitTab === 'settings'
              ? (theme === 'black' ? 'bg-[#180909] text-red-400 shadow' : 'bg-white text-indigo-700 shadow')
              : (theme === 'black' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>9Router Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setCockpitTab('api')}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase transition-all cursor-pointer ${
            cockpitTab === 'api'
              ? (theme === 'black' ? 'bg-[#180909] text-red-400 shadow' : 'bg-white text-indigo-700 shadow')
              : (theme === 'black' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')
          }`}
        >
          <Terminal className="w-4 h-4 shrink-0" />
          <span>API Console</span>
        </button>
      </div>

      {/* DB global feedback bar */}
      {dbStatusMsg && (
        <div className="mb-4 text-xs font-bold text-amber-500 bg-amber-500/15 border border-amber-500/25 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm animate-scale-up">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          <span>{dbStatusMsg}</span>
        </div>
      )}

      {/* TAB SUB-VIEWS */}
      <div className="w-full">
        
        {/* VIEW 1: COCKPIT LAUNCHER COMPONENT */}
        {cockpitTab === 'launcher' && (
          <form onSubmit={handleLaunchDirect} className={`p-6 rounded-2xl border shadow-xl flex flex-col gap-6 animate-scale-up ${panelsBg}`}>
            
            {/* Horizontal Sub-tabs for Improv Types (Motion, Sound, Emotion) */}
            <div className={`grid grid-cols-3 gap-2 p-1 border rounded-xl ${
              theme === 'black' ? 'bg-neutral-950/60 border-neutral-900/50' : 'bg-slate-50 border-slate-100'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('motion')}
                className={`py-2 px-3 rounded-lg font-bold text-[10px] md:text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'motion'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5 animate-pulse" />
                <span>Motion Tab</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sound')}
                className={`py-2 px-3 rounded-lg font-bold text-[10px] md:text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sound'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-500'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 animate-bounce text-red-500" />
                <span>Sound Tab</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('emotion')}
                className={`py-2 px-3 rounded-lg font-bold text-[10px] md:text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'emotion'
                    ? 'bg-blue-500/10 border border-blue-500/30 text-blue-500'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-blue-500" />
                <span>Từ vựng (Words list)</span>
              </button>
            </div>

            {/* Stage Options */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-8 flex flex-col gap-3">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>
                  Active Lesson Name / Topic
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Thế giới đại dương tinh nghịch..."
                  className={`w-full px-4 py-3 rounded-xl border text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-500 leading-none ${innerBg}`}
                  required
                />
              </div>

              <div className="md:col-span-4 flex items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerateViaLLM}
                  disabled={aiGenerating}
                  className="flex-1 py-3 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10 disabled:opacity-50"
                >
                  {aiGenerating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Brain className="w-3.5 h-3.5" />
                  )}
                  <span>{aiGenerating ? "Generating..." : "AI Autogen ⚡"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToDatabase}
                  className={`px-4 py-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                    theme === 'black'
                      ? 'bg-neutral-950 border-neutral-900 text-slate-300 hover:text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                  }`}
                  title="Persist changes to Lessons Database storage"
                >
                  <Save className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Save DB</span>
                </button>
              </div>
            </div>

            {/* AI Generation Loading Wave Overlay */}
            {aiGenerating && (
              <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center gap-3 animate-pulse ${
                theme === 'black' ? 'bg-neutral-950/80 border-rose-950' : 'bg-rose-50/50 border-rose-100'
              }`}>
                <div className="flex space-x-1.5 justify-center items-center h-8">
                  <div className="w-2.5 h-8 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2.5 h-8 bg-rose-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2.5 h-8 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <div className="w-2.5 h-8 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }}></div>
                </div>
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider ${headerText}`}>AI is cooking beautiful speaking cues...</h4>
                  <p className={`text-[10px] mt-1 ${smallText}`}>Designing physical poses, sounds, translations, and questions dynamically.</p>
                </div>
              </div>
            )}

            {/* Custom Draft Cues Row */}
            <div className={`p-4 rounded-xl border ${theme === 'black' ? 'bg-neutral-950/20' : 'bg-slate-50/50'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Draft Lesson Cards ({customCues.length})
                    </h3>
                    {loadedLessonId && (
                      <span className="text-[9px] font-black uppercase bg-amber-500/15 border border-amber-500/35 text-amber-500 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span>✏️ Editing Saved Lesson</span>
                        <button
                          type="button"
                          onClick={() => {
                            setLoadedLessonId(null);
                            setDbStatusMsg("Switched mode: Save will now create a NEW Lesson copy 📑");
                            setTimeout(() => setDbStatusMsg(''), 3000);
                          }}
                          className="hover:text-red-500 font-extrabold ml-1 text-[10px] cursor-pointer"
                          title="Click to detach and Save as a new copy"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] ${smallText}`}>
                    Define spontaneous items that students must read, speak or perform. Click to expand and tweak.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoClassifyAndSave}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                      theme === 'black' 
                        ? 'bg-amber-950/20 hover:bg-amber-900/30 border-amber-900 text-amber-400' 
                        : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-250 text-indigo-755 shadow-xs'
                    }`}
                    title="Phân loại các thẻ theo danh mục của chúng và lưu vào thư mục DB phù hợp"
                  >
                    <Save className="w-3.5 h-3.5 text-amber-500" />
                    <span>Phân loại & Lưu DB 📁</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadModePresets}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                      theme === 'black' 
                        ? 'bg-neutral-950 hover:bg-neutral-900 border-neutral-900 text-slate-400' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650 shadow-xs'
                    }`}
                    title="Nạp lại các thẻ mẫu mặc định cho tab này"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Nạp mẫu thẻ 🔄</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddCueItem}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                      theme === 'black' 
                        ? 'bg-neutral-950 hover:bg-neutral-900 border-neutral-900 text-red-400' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-indigo-700 shadow-xs'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm thẻ</span>
                  </button>
                </div>
              </div>

              {customCues.length === 0 ? (
                <div className={`p-8 text-center rounded-xl border border-dashed border-slate-350 text-xs font-semibold ${smallText}`}>
                  Your draft deck is currently empty. Use "Add card" or click "AI Autogen ⚡" to build coordinates!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {customCues.map((cue, idx) => {
                    const currentCategory = cue.category || 'emotion';
                    const isExpanded = expandedCueId === cue.id;

                    return (
                      <div 
                        key={cue.id} 
                        className={`p-3 rounded-xl border relative flex flex-col transition-all duration-250 ease-in-out group ${
                          isExpanded 
                            ? (theme === 'black' ? 'bg-[#150909]/40 border-red-500/35 ring-1 ring-red-500/20' : 'bg-indigo-50/20 border-indigo-500/35 shadow-xs') 
                            : (theme === 'black' ? 'bg-neutral-950/50 hover:bg-neutral-955 border-neutral-900' : 'bg-white hover:bg-slate-50/75 border-slate-200 shadow-3xs')
                        }`}
                      >
                        {/* Collapsed Header / Toggler Row */}
                        <div 
                          className={`flex items-center justify-between cursor-pointer select-none leading-none ${
                            isExpanded ? 'border-b pb-2.5 mb-2.5 border-neutral-900 style-border' : ''
                          }`}
                          onClick={() => setExpandedCueId(isExpanded ? null : cue.id)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded leading-none shrink-0 ${
                              currentCategory === 'motion' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' :
                              currentCategory === 'sound' ? 'bg-red-500/10 border border-red-500/30 text-rose-500' :
                              'bg-blue-500/10 border border-blue-500/30 text-blue-500'
                            }`}>
                              #{idx + 1} • {currentCategory === 'emotion' ? 'WORDS' : currentCategory.toUpperCase()}
                            </span>
                            
                            <span className={`text-xs font-black truncate leading-none ${headerText}`}>
                              {cue.text || 'Empty Card'}
                            </span>

                            {cue.translation && (
                              <span className={`text-[10px] truncate leading-none ${smallText}`}>
                                ({cue.translation})
                              </span>
                            )}

                            {/* Volatile audios cache indicators */}
                            <div className="flex gap-1 items-center shrink-0 select-none text-[8px] font-mono font-bold leading-none">
                              <span className={`px-1 rounded-sm ${
                                cue.audioVi ? 'bg-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-neutral-800 text-neutral-500 line-through'
                              }`} title={cue.audioVi ? "Vocal VI sẵn sàng" : "Chưa có audio VI"}>
                                VI
                              </span>
                              <span className={`px-1 rounded-sm ${
                                cue.audioEn ? 'bg-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-neutral-800 text-neutral-500 line-through'
                              }`} title={cue.audioEn ? "Vocal EN sẵn sàng" : "Chưa có audio EN"}>
                                EN
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCueItem(cue.id);
                              }}
                              className="text-slate-400 hover:text-red-500 p-1 rounded transition-all cursor-pointer hover:bg-red-500/10"
                              title="Delete card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Full Edit Form - Only displayed if isExpanded is true */}
                        {isExpanded && (
                          <div className="flex flex-col gap-3 animate-scale-up">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">Text/Phrase</label>
                                <input
                                  type="text"
                                  value={cue.text}
                                  onChange={(e) => handleUpdateCueValue(cue.id, 'text', e.target.value)}
                                  className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg}`}
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">Translation</label>
                                <input
                                  type="text"
                                  value={cue.translation || ''}
                                  onChange={(e) => handleUpdateCueValue(cue.id, 'translation', e.target.value)}
                                  className={`w-full px-2 py-1.5 rounded-lg border text-[11px] focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Thư mục phân loại (Folder Category)</label>
                                <select
                                  value={currentCategory}
                                  onChange={(e) => {
                                    const newCat = e.target.value;
                                    handleUpdateCueValue(cue.id, 'category', newCat);
                                    if (newCat === 'motion' && !cue.poseJson) {
                                      handleUpdateCueValue(cue.id, 'poseJson', POSE_PRESETS[0].coords);
                                    } else if (newCat === 'sound' && !cue.soundText) {
                                      handleUpdateCueValue(cue.id, 'soundText', 'Kêu to lên!');
                                    }
                                  }}
                                  className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer ${innerBg}`}
                                >
                                  <option value="emotion">Words List Folder (Từ vựng) 📁</option>
                                  <option value="motion">Motion Pose Folder 🏃‍♂️</option>
                                  <option value="sound">Sound Echoes Folder 🔊</option>
                                </select>
                              </div>
                            </div>

                            {/* MOTION (STICK POSES) SCENARIO */}
                            {currentCategory === 'motion' && (
                              <div className={`p-2.5 rounded-lg border space-y-2 text-[10px] ${
                                theme === 'black' ? 'bg-[#150A0A] border-red-950/20' : 'bg-slate-50 border-slate-200'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <label className="font-extrabold text-amber-500 uppercase text-[9px]">Pose Coordinates JSON</label>
                                  <span className="font-mono text-[8px] text-slate-400">stick model</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <textarea
                                    value={cue.poseJson || '{"head": [50, 20]}'}
                                    onChange={(e) => handleUpdateCueValue(cue.id, 'poseJson', e.target.value)}
                                    rows={2}
                                    className={`flex-1 px-1.5 py-1 rounded text-[9px] font-mono leading-tight focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none ${innerBg}`}
                                  />
                                  <div className="w-12 h-12 rounded bg-neutral-950/80 border border-neutral-900 flex items-center justify-center p-1 shrink-0">
                                    <PosePreviewBox poseJson={cue.poseJson || '{}'} />
                                  </div>
                                </div>
                                {/* Quick preset coordinates */}
                                <div className="flex flex-wrap gap-1">
                                  {POSE_PRESETS.map(p => (
                                    <button
                                      type="button"
                                      key={p.name}
                                      onClick={() => handleUpdateCueValue(cue.id, 'poseJson', p.coords)}
                                      className={`text-[8px] px-1 py-0.5 rounded font-bold cursor-pointer hover:scale-95 transition-all ${
                                        theme === 'black' ? 'bg-neutral-900 border border-neutral-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                                      }`}
                                    >
                                      {p.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* SOUND SCENARIO */}
                            {currentCategory === 'sound' && (
                              <div className={`p-2 rounded-lg border space-y-1 ${
                                theme === 'black' ? 'bg-[#150A0A] border-red-950/20' : 'bg-slate-50 border-slate-200'
                              }`}>
                                <label className="block text-[8px] font-black text-rose-500 uppercase">Vocal Onomatopoeia sound</label>
                                <input
                                  type="text"
                                  value={cue.soundText || ''}
                                  onChange={(e) => handleUpdateCueValue(cue.id, 'soundText', e.target.value)}
                                  placeholder="e.g. Quack! Quack! Quack!"
                                  className={`w-full px-2 py-1 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg}`}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Launch Parameter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 font-sans">
              <div className="space-y-1.5">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Speaking Language</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('vi')}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-black tracking-wide text-center cursor-pointer transition-all ${
                      language === 'vi'
                        ? 'bg-red-500/10 border-red-500 text-red-500 font-extrabold'
                        : (theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 shadow-xs')
                    }`}
                  >
                    🇻🇳 VI
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-black tracking-wide text-center cursor-pointer transition-all ${
                      language === 'en'
                        ? 'bg-red-500/10 border-red-500 text-red-500 font-extrabold'
                        : (theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 shadow-xs')
                    }`}
                  >
                    🇬🇧 EN
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Loại từ (Word Type)</label>
                <select
                  value={wordType}
                  onChange={(e) => setWordType(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-xs font-bold cursor-pointer ${innerBg}`}
                >
                  <option value="Bất kỳ" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Bất kỳ (Any)</option>
                  <option value="Danh từ" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Danh từ (Noun)</option>
                  <option value="Động từ" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Động từ (Verb)</option>
                  <option value="Tính từ" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Tính từ (Adjective)</option>
                  <option value="Dạng câu hỏi" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Dạng câu hỏi (Question)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Level Challenge</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-xs font-bold cursor-pointer ${innerBg}`}
                >
                  <option value="Easy" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Dễ (Easy)</option>
                  <option value="Medium" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Vừa (Medium)</option>
                  <option value="Hard" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Khó (Hard)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Số lượng thẻ (Cues)</label>
                <select
                  value={sampleCardCount}
                  onChange={(e) => setSampleCardCount(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-xs font-bold cursor-pointer ${innerBg}`}
                >
                  <option value={3} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>3 Thẻ (3 Cues)</option>
                  <option value={5} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>5 Thẻ (5 Cues)</option>
                  <option value={8} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>8 Thẻ (8 Cues)</option>
                  <option value={10} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>10 Thẻ (10 Cues)</option>
                  <option value={15} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>15 Thẻ (15 Cues)</option>
                  <option value={20} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>20 Thẻ (20 Cues)</option>
                  <option value={30} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>30 Thẻ (30 Cues)</option>
                  <option value={40} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>40 Thẻ (40 Cues)</option>
                  <option value={50} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>50 Thẻ (50 Cues)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Pacing Timer</label>
                  <span className="text-red-500 font-black text-xs">{duration}s</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="7"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full accent-red-500 h-1 rounded-lg cursor-pointer bg-slate-700 mt-2.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>TTS Voice Stream</label>
                <select
                  value={ttsMode}
                  onChange={(e) => setTtsMode(e.target.value as any)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-bold cursor-pointer ${innerBg}`}
                >
                  <option value="9router" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>9Router TTS 📻</option>
                  <option value="gemini" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Gemini AI ⭐</option>
                  <option value="local" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Local Voice</option>
                  <option value="silent" className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>Silent</option>
                </select>
              </div>
            </div>

            {/* Launch Trigger */}
            <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-4 ${
              theme === 'black' ? 'bg-neutral-950/40 border-neutral-900/50' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className={`text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-wide leading-none ${smallText}`}>
                <Info className="w-4 h-4 shrink-0 text-slate-400" />
                <span>Hotkey triggers: [Space] Pause • [Enter] Next • [Esc] Exit HUD</span>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-10 py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-lg shadow-red-550/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4.5 h-4.5 fill-current" />
                <span>Launch speaking HUD 🚀</span>
              </button>
            </div>

          </form>
        )}

        {/* VIEW 2: DEDICATED PERSISTENT LIBRARY DATABASE */}
        {cockpitTab === 'database' && (
          <div className={`p-6 rounded-2xl border shadow-xl flex flex-col gap-5 animate-scale-up ${panelsBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-style">
              <div>
                <h2 className={`text-lg font-display font-extrabold flex items-center gap-2 ${headerText}`}>
                  <BookOpen className="w-5 h-5 text-red-500" />
                  Lessons DB library
                </h2>
                <p className={`text-[10px] ${smallText} mt-0.5`}>
                  All customized preset files stored inside persistent flat database <code>lessons_db.json</code>.
                </p>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Filter lessons by title..."
                  value={dbSearchQuery}
                  onChange={(e) => setDbSearchQuery(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg}`}
                />

                <button
                  type="button"
                  onClick={loadLessons}
                  className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 hover:bg-neutral-900 ${
                    theme === 'black' ? 'bg-neutral-950 border-neutral-905 text-slate-300' : 'bg-white border-slate-200 text-slate-705 shadow-xs'
                  }`}
                  title="Force DB synchronization"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
              </div>
            </div>

            {/* Category Filter + Seeding Block */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b pb-3 border-style">
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDbCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    dbCategoryFilter === 'all'
                      ? 'bg-red-500/10 border-red-500/30 text-red-500 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Tất cả ({savedLessons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDbCategoryFilter('emotion')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    dbCategoryFilter === 'emotion'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                  title="Chỉ lọc bài học từ vựng"
                >
                  Từ vựng (Words List) ({savedLessons.filter(l => l.type === 'emotion').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDbCategoryFilter('motion')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    dbCategoryFilter === 'motion'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Motion Poser ({savedLessons.filter(l => l.type === 'motion').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDbCategoryFilter('sound')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    dbCategoryFilter === 'sound'
                      ? 'bg-red-500/10 border-red-500/30 text-red-500 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Sound Echo ({savedLessons.filter(l => l.type === 'sound').length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSampleGenerator(true)}
                disabled={seedingLoading}
                className={`w-full sm:w-auto px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                  theme === 'black'
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-550/20 disabled:opacity-50'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 disabled:opacity-50'
                }`}
                title="Tạo sẵn các bộ bài học mẫu phong phú qua AI"
              >
                <Database className={`w-3.5 h-3.5 ${seedingLoading ? 'animate-bounce' : ''}`} />
                <span>{seedingLoading ? "ĐANG TẠO..." : "TẠO BÀI HỌC MẪU ⚡"}</span>
              </button>
            </div>

            {filteredSavedLessons.length === 0 ? (
              <div className={`py-12 px-6 text-center border-2 border-dashed rounded-2xl ${borderStyle}`}>
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
                <p className={`text-xs font-bold ${headerText}`}>No stored custom files match filter</p>
                <p className={`text-[10px] max-w-sm mx-auto leading-relaxed mt-1 ${smallText}`}>
                  Designing a cue list with topic in the launcher tab, and clicking "Save DB" will store lesson cards persistently.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSavedLessons.map((les) => {
                  const isLessonExpanded = expandedLessonId === les.id;
                  const isCurrentlyActive = topic === les.topic;
                  const totalCues = les.cues?.length || 0;
                  const totalPossibleAudios = totalCues * 2;
                  const presentAudios = les.cues?.reduce((acc: number, c: any) => {
                    let count = 0;
                    if (c.audioVi) count++;
                    if (c.audioEn) count++;
                    return acc + count;
                  }, 0) || 0;
                  const hasAllAudios = presentAudios === totalPossibleAudios;

                  return (
                    <div
                      key={les.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col gap-3 group select-none ${
                        isCurrentlyActive 
                          ? (theme === 'black' ? 'border-red-500/40 bg-red-500/5 shadow-md shadow-red-500/5' : 'border-indigo-500/40 bg-indigo-50/20 shadow-xs')
                          : (theme === 'black' ? 'bg-neutral-950/40 hover:bg-[#110A0A]/45 border-neutral-900' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 shadow-2xs')
                      }`}
                    >
                      {/* Row layout with isolated click targets for expand and deletion actions */}
                      <div className="flex items-start justify-between gap-4">
                        {/* Expandable info block */}
                        <div 
                          onClick={() => setExpandedLessonId(isLessonExpanded ? null : les.id)}
                          className="flex-1 min-w-0 cursor-pointer flex items-start gap-4"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex gap-1.5 items-center flex-wrap leading-none">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded leading-none ${
                                les.type === 'motion' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' :
                                les.type === 'sound' ? 'bg-red-500/10 border border-red-500/30 text-red-500' :
                                'bg-blue-500/10 border border-blue-500/30 text-blue-500'
                              }`}>
                                {les.type === 'emotion' ? 'WORDS' : les.type}
                              </span>
                              <span className={`text-[9px] font-semibold font-mono ${smallText}`}>
                                {les.language === 'en' ? '🇬🇧 EN' : '🇻🇳 VI'} • {totalCues} cue cards
                              </span>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded leading-none flex items-center gap-1 ${
                                hasAllAudios 
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold' 
                                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-500'
                              }`} title="Trạng thái giọng đọc lưu trữ trong Database">
                                🔊 {presentAudios}/{totalPossibleAudios} Vocals Cached
                              </span>
                              {isCurrentlyActive && (
                                <span className="text-[8px] bg-red-500 text-white font-black px-1 rounded uppercase tracking-wide leading-none animate-pulse">ACTIVE ON HUDS</span>
                              )}
                            </div>

                            <h3 className={`text-sm font-extrabold group-hover:text-red-500 transition-all truncate ${headerText}`}>
                              {les.topic}
                            </h3>

                            {!isLessonExpanded && (
                              <p className={`text-[10px] truncate leading-none ${smallText}`}>
                                Cues sample: {les.cues?.map((c: any) => `"${c.text}"`).join(', ') || 'none'}
                              </p>
                            )}
                          </div>

                          <div className="p-1 rounded-lg border border-neutral-900/55 dark:border-neutral-800 text-slate-400 self-start">
                            {isLessonExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>

                        {/* Stably isolated action buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-start">
                          {deletingLessonId === les.id ? (
                            <div className="flex items-center gap-1 p-1 border border-red-500/40 rounded-lg bg-red-500/5 animate-pulse">
                              <span className="text-[8px] font-black text-red-500 uppercase">XÓA?</span>
                              <button
                                type="button"
                                onClick={() => handleExecuteDeleteLesson(les.id)}
                                className="px-1.5 py-0.5 rounded bg-red-650 hover:bg-red-700 text-white font-black text-[9px] uppercase cursor-pointer"
                              >
                                Có
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingLessonId(null)}
                                className="px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-700 text-white font-black text-[9px] uppercase cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingLessonId(les.id)}
                              className={`p-1.5 rounded-lg border opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer ${
                                theme === 'black' 
                                  ? 'bg-neutral-950 hover:bg-red-950 border-neutral-900 text-slate-500 hover:text-red-400' 
                                  : 'bg-white hover:bg-rose-50 border-slate-200 text-slate-400 hover:text-rose-600'
                              }`}
                              title="Xóa bài học 🗑️"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Section showing all Lesson Cues in collapsible structure */}
                      {isLessonExpanded && (
                        <div className="mt-1 pt-3 border-t border-dashed border-neutral-900/40 dark:border-neutral-800 animate-scale-up space-y-3 font-sans w-full">
                          <div className="space-y-1.5 w-full">
                            <span className={`block text-[9px] font-black uppercase text-slate-500`}>Detailed Cue Cards ({les.cues?.length || 0}):</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto">
                              {les.cues?.map((c: any, i: number) => {
                                const cueCategory = c.category || 'emotion';
                                return (
                                  <div 
                                    key={i} 
                                    className={`p-2 rounded-lg border text-[10px] font-bold flex items-center justify-between gap-2 leading-none ${
                                      theme === 'black' ? 'bg-neutral-950/65 border-neutral-900' : 'bg-white border-slate-150'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="text-[8px] opacity-40">#{i+1}</span>
                                      <span className={headerText}>{c.text}</span>
                                      {c.translation && (
                                        <span className={`text-[9px] font-normal font-sans ${smallText}`}>({c.translation})</span>
                                      )}
                                      
                                      {/* Cues Audio indicators */}
                                      <div className="flex gap-1 items-center shrink-0 ml-1.5">
                                        <span className={`text-[8px] font-mono select-none px-1 rounded ${
                                          c.audioVi ? 'bg-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-neutral-800 text-neutral-500 line-through'
                                        }`} title={c.audioVi ? "Vocal VI sẵn sàng" : "Chưa có Audio VI"}>
                                          VI
                                        </span>
                                        <span className={`text-[8px] font-mono select-none px-1 rounded ${
                                          c.audioEn ? 'bg-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-neutral-800 text-neutral-500 line-through'
                                        }`} title={c.audioEn ? "Vocal EN sẵn sàng" : "Chưa có Audio EN"}>
                                          EN
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`text-[7px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                      cueCategory === 'motion' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                      cueCategory === 'sound' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                      'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                    }`}>
                                      {cueCategory === 'emotion' ? 'WORDS' : cueCategory}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Quick Actions Drawer for the loaded database lesson */}
                          <div className="flex flex-wrap gap-2 items-center justify-end leading-none pt-2 border-t border-neutral-900/20">
                            <button
                              type="button"
                              onClick={() => handleGenerateMissingAudio(les.id)}
                              disabled={generatingAudioLessonId !== null}
                              className={`px-3 py-2 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
                                generatingAudioLessonId === les.id
                                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                                  : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                              }`}
                              title="Quốc tế hóa: Kiểm tra & tạo giọng TTS còn thiếu cho các thẻ card này"
                            >
                              <Volume2 className={`w-3.5 h-3.5 ${generatingAudioLessonId === les.id ? 'animate-bounce' : ''}`} />
                              <span>{generatingAudioLessonId === les.id ? "ĐANG TẠO... ⌛" : "TẠO AUDIO THIẾU ⚡"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleLoadLesson(les)}
                              className="px-3.5 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-650 hover:to-rose-700 text-white font-black text-[10px] uppercase tracking-wide rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10 transition-all active:scale-[0.98]"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Nạp &amp; Chạy HUD 🚀</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                handleLoadLesson(les);
                                setExpandedCueId(les.cues?.[0]?.id || null);
                                setCockpitTab('launcher');
                              }}
                              className={`px-3 py-2 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
                                theme === 'black' 
                                  ? 'bg-neutral-900 border-neutral-800 text-slate-300 hover:text-white' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                              }`}
                            >
                              <span>Sửa trong Launcher ✏️</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedLessonId(null)}
                              className={`px-2.5 py-2 rounded-lg border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-all ${
                                theme === 'black' ? 'bg-neutral-950 border-neutral-900 text-slate-400 hover:bg-neutral-900' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <span>Ẩn chi tiết 🔼</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`p-4 rounded-xl border flex items-start gap-2 text-xs leading-relaxed ${
              theme === 'black' ? 'bg-[#150A10]/20 border-red-950/20 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <Eye className="w-4.5 h-4.5 shrink-0 text-amber-500" />
              <span>Loaded lists from the persistent database bypass the AI rate-limits. Click on a database item to expand or immediately populate cards on your launch stage.</span>
            </div>
          </div>
        )}

        {/* VIEW 3: DEDICATED settings */}
        {cockpitTab === 'settings' && (
          <div className={`p-6 rounded-2xl border shadow-xl flex flex-col gap-6 animate-scale-up ${panelsBg}`}>
            <div className="flex items-center justify-between gap-4 border-b pb-4 border-style">
              <div>
                <h2 className={`text-lg font-display font-extrabold flex items-center gap-2 ${headerText}`}>
                  <Settings className="w-5 h-5 text-red-500 animate-spin" style={{ animationDuration: '4s' }} />
                  9Router Models & Endpoint parameter Cockpit
                </h2>
                <p className={`text-[10px] ${smallText} mt-0.5`}>
                  Manage high-speed 9Router proxies for local or high demand server tasks.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={nineRouterConfig.enabled}
                  onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={`w-10 h-5.5 rounded-full relative transition-all border ${
                  nineRouterConfig.enabled
                    ? 'bg-red-500/20 border-red-500 after:translate-x-4.5 after:bg-red-500'
                    : 'bg-neutral-850 border-neutral-700 after:bg-slate-500'
                } after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:rounded-full after:h-4 after:w-4 after:transition-all`}></div>
                <span className={`text-xs font-black uppercase tracking-wider ml-2.5 ${headerText}`}>
                  {nineRouterConfig.enabled ? "ACTIVE 📻" : "DISABLED"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div className="space-y-4">
                <h3 className={`text-xs font-black uppercase tracking-wide border-b pb-1.5 ${headerText}`}>
                  Endpoint Connection
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-1.5 ${labelText}`}>9Router Server Endpoint</label>
                    <input
                      type="text"
                      value={nineRouterConfig.url}
                      disabled={!nineRouterConfig.enabled}
                      onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, url: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg} ${
                        !nineRouterConfig.enabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-1.5 ${labelText}`}>Bearer API credentials Auth (Optional)</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={nineRouterConfig.apiKey || ''}
                        disabled={!nineRouterConfig.enabled}
                        placeholder="Enter bearer token key if requested..."
                        onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, apiKey: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg} ${
                          !nineRouterConfig.enabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                      <Key className="w-3.5 h-3.5 text-slate-600 absolute right-3.5 top-3" />
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 ${theme === 'black' ? 'bg-neutral-950/50' : 'bg-slate-50'}`}>
                  <h4 className={`text-[10px] font-bold uppercase ${headerText}`}>Interactive connection tool</h4>
                  <p className={`text-[10px] leading-relaxed ${smallText}`}>
                    Test hook to compile endpoints and fetch online model parameters.
                  </p>
                  
                  <button
                    type="button"
                    onClick={testRouterConnection}
                    disabled={!nineRouterConfig.enabled || routerTesting}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-wide rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${routerTesting ? 'animate-spin' : ''}`} />
                    <span>{routerTesting ? "Testing Connect..." : "Ping 9Router connection!"}</span>
                  </button>

                  {routerTestFeedback && (
                    <div className={`p-2.5 rounded-lg text-[10px] font-mono leading-normal border max-h-[140px] overflow-y-auto ${
                      routerTestFeedback.includes('✅') 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {routerTestFeedback}
                    </div>
                  )}

                  {routerTestedModels.length > 0 && (
                    <div className="space-y-1">
                      <span className={`block text-[9px] font-black uppercase text-slate-500`}>Supported models:</span>
                      <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                        {routerTestedModels.map(m => (
                          <span key={m} className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            theme === 'black' ? 'bg-neutral-900 border border-neutral-800 text-slate-400' : 'bg-white border-slate-200 text-slate-650'
                          }`}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="space-y-4">
                <h3 className={`text-xs font-black uppercase tracking-wide border-b pb-1.5 ${headerText}`}>
                  Model Mappings Parameters
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-1.5 ${labelText}`}>LLM Model for Cues</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.llmModel}
                      onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, llmModel: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${innerBg} ${
                        !nineRouterConfig.enabled ? 'opacity-50' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-1.5 ${labelText}`}>STT Model for Speech-to-Text</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.sttModel}
                      onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, sttModel: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${innerBg} ${
                        !nineRouterConfig.enabled ? 'opacity-50' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-1.5 ${labelText}`}>TTS Model for Vietnamese synthesis (Hoai My / Nam Minh)</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.ttsModelVi || ''}
                      placeholder="e.g. edge-tts/vi-VN-HoaiMyNeural"
                      onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, ttsModelVi: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${innerBg} ${
                        !nineRouterConfig.enabled ? 'opacity-50' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-1.5 ${labelText}`}>TTS Model for English synthesis (Aria / Guy)</label>
                    <input
                      type="text"
                      disabled={!nineRouterConfig.enabled}
                      value={nineRouterConfig.ttsModelEn || ''}
                      placeholder="e.g. edge-tts/en-US-AriaNeural"
                      onChange={(e) => onUpdateNineRouter({ ...nineRouterConfig, ttsModelEn: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 ${innerBg} ${
                        !nineRouterConfig.enabled ? 'opacity-50' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: DEDICATED SWISS-TYPE API INSTRUMENTATION PANEL */}
        {cockpitTab === 'api' && (
          <div className={`p-6 rounded-2xl border shadow-xl flex flex-col gap-6 animate-scale-up ${panelsBg}`}>
            
            {/* Tab header */}
            <div className="flex items-center justify-between gap-4 border-b pb-4 border-style">
              <div>
                <h2 className={`text-lg font-display font-extrabold flex items-center gap-2 ${headerText}`}>
                  <Terminal className="w-5 h-5 text-emerald-400 animate-pulse" />
                  Interactive API Console & Sandbox Playground
                </h2>
                <p className={`text-[10px] ${smallText} mt-0.5`}>
                  Inspect available custom Node.js Express server routes, run real-time request packets, and view debug trace headers.
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>SYSTEM API ONLINE</span>
              </div>
            </div>

            {/* Split layout: Endpoint Selection List vs Dynamic interactive sandbox tester */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: API Directory (span 5) */}
              <div className="lg:col-span-12 xl:col-span-5 space-y-3">
                <span className={`block text-[10px] font-black uppercase tracking-wider pb-1.5 border-b ${borderStyle} ${labelText}`}>
                  Routes Catalog
                </span>
                
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {API_ENDPOINTS.map((endpoint, idx) => {
                    const isSelected = selectedApiIndex === idx;
                    const isGet = endpoint.method === 'GET';
                    const isPost = endpoint.method === 'POST';
                    const isDelete = endpoint.method === 'DELETE';
                    const isPut = endpoint.method === 'PUT';
                    
                    let bgBadge = '';
                    let borderBadge = '';
                    let textBadge = '';
                    
                    if (isGet) {
                      bgBadge = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
                    } else if (isPost) {
                      bgBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                    } else if (isDelete) {
                      bgBadge = 'bg-rose-500/15 text-rose-450 border-rose-500/30';
                    } else {
                      bgBadge = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedApiIndex(idx)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 relative group ${
                          isSelected 
                            ? theme === 'black'
                              ? 'bg-neutral-900 border-[#2b0c0c] text-slate-100 shadow-md ring-1 ring-[#3b1212]'
                              : 'bg-indigo-50/60 border-indigo-250 text-indigo-900 ring-1 ring-indigo-150'
                            : theme === 'black'
                              ? 'bg-neutral-950/40 border-neutral-900 text-slate-400 hover:bg-neutral-900/40 hover:text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-150 hover:text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="text-xs font-bold leading-normal">{endpoint.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black border font-mono tracking-wider ${bgBadge}`}>
                            {endpoint.method}
                          </span>
                        </div>
                        
                        <span className={`text-[10px] font-mono leading-none tracking-tight block ${isSelected ? 'text-amber-500 font-bold' : smallText}`}>
                          {endpoint.path}
                        </span>

                        <p className={`text-[9.5px] leading-relaxed mt-0.5 line-clamp-2 ${isSelected ? (theme === 'black' ? 'text-slate-300' : 'text-slate-655') : smallText}`}>
                          {endpoint.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: API Playground (span 7) */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-4">
                <span className={`block text-[10px] font-black uppercase tracking-wider pb-1.5 border-b ${borderStyle} ${labelText}`}>
                  Interactive Sandbox Playground
                </span>
                
                {/* Active Endpoint header banner */}
                <div className={`p-4 rounded-xl border flex flex-col gap-1 ${
                  theme === 'black' ? 'bg-[#120a0a]/50 border-red-950/20' : 'bg-indigo-50/30 border-indigo-100/50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black border font-mono tracking-widest uppercase ${
                      API_ENDPOINTS[selectedApiIndex].method === 'GET' 
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' 
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}>
                      {API_ENDPOINTS[selectedApiIndex].method}
                    </span>
                    <span className={`text-[11px] font-mono font-bold ${headerText}`}>
                      {API_ENDPOINTS[selectedApiIndex].path}
                    </span>
                  </div>
                  <p className="text-[10.5px] mt-1.5 italic text-slate-500 leading-normal">
                    {API_ENDPOINTS[selectedApiIndex].description}
                  </p>
                </div>

                {/* HTTP Request Parameters (Headers + Body) */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Editable Headers */}
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Headers (JSON format)
                      </label>
                      <textarea
                        value={apiRequestHeaders}
                        onChange={(e) => setApiRequestHeaders(e.target.value)}
                        className={`w-full h-24 px-3 py-2 border rounded-xl font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg}`}
                      />
                    </div>

                    {/* Active Route Details */}
                    <div className="space-y-2 text-[10px] leading-relaxed">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Execution Metrics
                      </span>
                      <div className={`p-3 rounded-xl border space-y-2 h-24 flex flex-col justify-center ${theme === 'black' ? 'bg-neutral-950 border-neutral-900' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Status Code:</span>
                          <span className={`font-mono font-bold ${
                            apiResponseStatus === null 
                              ? 'text-slate-400' 
                              : apiResponseStatus >= 200 && apiResponseStatus < 300
                                ? 'text-emerald-400 animate-pulse'
                                : 'text-rose-400'
                          }`}>
                            {apiResponseStatus === null ? "No send execution" : apiResponseStatus === 0 ? "Network Error" : apiResponseStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Latency:</span>
                          <span className="font-mono font-bold text-amber-500">
                            {apiExecutionTime === null ? "--" : `${apiExecutionTime} ms`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Gateway host:</span>
                          <span className="font-mono text-slate-400">Local Container</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Request Body Payload */}
                  {API_ENDPOINTS[selectedApiIndex].hasBody && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                          JSON Request Body Payload
                        </label>
                        <span className="text-[8px] font-bold text-amber-500 font-mono tracking-wider">EDITABLE JSON</span>
                      </div>
                      <textarea
                        value={apiRequestBody}
                        onChange={(e) => setApiRequestBody(e.target.value)}
                        className={`w-full h-36 px-3 py-2 border rounded-xl font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-red-500 ${innerBg}`}
                      />
                    </div>
                  )}

                  {/* Submit Runner Button */}
                  <button
                    type="button"
                    onClick={handleExecuteApiTest}
                    disabled={apiLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-indigo-500 hover:from-emerald-600 hover:to-indigo-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 shadow-md"
                  >
                    {apiLoading ? <RefreshCw className="w-4 h-4 animate-spin text-slate-950" /> : <Send className="w-3.5 h-3.5 text-slate-950" />}
                    <span className="text-slate-950">{apiLoading ? "TRANSMITTING DATA..." : "RUN API HANDLER TEST"}</span>
                  </button>
                </div>

                {/* HTTP Response Visualizer Container */}
                <div className="space-y-2">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                    Response Package Output
                  </span>
                  
                  {apiResponseBody ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[9px] w-full overflow-hidden">
                      {/* JSON Response Body tree */}
                      <div className="space-y-1 w-full overflow-hidden">
                        <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-sans">Body output</span>
                        <pre className={`p-3 rounded-xl border h-60 overflow-auto text-slate-300 leading-normal font-mono w-full ${
                          theme === 'black' ? 'bg-[#060404] border-neutral-900/80 text-emerald-400' : 'bg-slate-950 border-slate-950/80 text-emerald-400'
                        }`}>
                          <code>{apiResponseBody}</code>
                        </pre>
                      </div>

                      {/* Header map attributes */}
                      <div className="space-y-1 w-full overflow-hidden">
                        <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-sans">Header trace metadata</span>
                        <pre className={`p-3 rounded-xl border h-60 overflow-auto text-slate-400 leading-normal font-mono w-full ${
                          theme === 'black' ? 'bg-[#040406] border-neutral-900/40 text-slate-400' : 'bg-[#151525] border-slate-900 text-slate-500'
                        }`}>
                          <code>{apiResponseHeaders || '// Headers not traced'}</code>
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-10 text-center rounded-xl border border-dashed text-[10px] uppercase font-bold tracking-wider ${
                      theme === 'black' ? 'border-neutral-900 text-slate-600' : 'border-slate-250 text-slate-400'
                    }`}>
                      No response payload buffered. Tap Submit API Request above.
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

      </div>

      {/* SAMPLE LESSON GENERATOR MODAL */}
      {showSampleGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-xl border overflow-hidden ${
            theme === 'black' ? 'bg-neutral-950 border-neutral-900' : 'bg-white border-slate-200'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              theme === 'black' ? 'border-neutral-900 bg-neutral-900/40' : 'border-slate-100 bg-slate-50'
            }`}>
              <h3 className={`text-lg font-bold font-display tracking-tight flex items-center gap-2 ${
                theme === 'black' ? 'text-slate-200' : 'text-slate-800'
              }`}>
                <Brain className="w-5 h-5 text-emerald-500" />
                Tạo Bài Học Mẫu Bằng AI
              </h3>
              <button 
                onClick={() => setShowSampleGenerator(false)}
                className={`p-1.5 rounded-full hover:bg-slate-500/10 transition-colors ${
                  theme === 'black' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Chủ đề / Tên bài</label>
                <input
                  type="text"
                  value={sampleTopic}
                  onChange={(e) => setSampleTopic(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 ${innerBg}`}
                  placeholder="Ví dụ: Động vật hoang dã, Các loại trái cây..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Ngôn ngữ</label>
                  <select
                    value={sampleLang}
                    onChange={(e) => setSampleLang(e.target.value as 'vi' | 'en')}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold cursor-pointer ${innerBg}`}
                  >
                    <option value="vi" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>🇻🇳 Tiếng Việt</option>
                    <option value="en" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>🇬🇧 Tiếng Anh</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Khóa học</label>
                  <select
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value as any)}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold cursor-pointer ${innerBg}`}
                  >
                    <option value="emotion" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>Từ Vựng (Words)</option>
                    <option value="motion" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>Hành động (Motion)</option>
                    <option value="sound" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>Âm thanh (Sound)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Số lượng thẻ</label>
                  <select
                    value={sampleCount}
                    onChange={(e) => setSampleCount(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold cursor-pointer ${innerBg}`}
                  >
                    <option value={3} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>3 Thẻ</option>
                    <option value={5} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>5 Thẻ</option>
                    <option value={8} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>8 Thẻ</option>
                    <option value={10} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>10 Thẻ</option>
                    <option value={15} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>15 Thẻ</option>
                    <option value={20} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>20 Thẻ</option>
                    <option value={30} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>30 Thẻ</option>
                    <option value={40} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>40 Thẻ</option>
                    <option value={50} className={theme === 'black' ? 'bg-neutral-950 text-slate-200' : 'bg-white text-slate-800'}>50 Thẻ</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={`block uppercase text-[10px] font-black tracking-wider ${labelText}`}>Cấp độ</label>
                  <select
                    value={sampleLevel}
                    onChange={(e) => setSampleLevel(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold cursor-pointer ${innerBg}`}
                  >
                    <option value="Dễ - Mầm non & Tiểu học" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>Dễ (Mầm non)</option>
                    <option value="Trung bình - Cấp 2" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>Trung bình</option>
                    <option value="Khó - Học thuật" className={theme === 'black' ? 'bg-neutral-950' : 'bg-white'}>Khó (Học thuật)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={`p-6 border-t flex justify-end gap-3 ${
              theme === 'black' ? 'border-neutral-900 bg-neutral-900/20' : 'border-slate-100 bg-slate-50/50'
            }`}>
              <button
                type="button"
                onClick={() => setShowSampleGenerator(false)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  theme === 'black' 
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-neutral-800' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                }`}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={seedingLoading || !sampleTopic.trim()}
                onClick={generateSampleLessonViaLLM}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedingLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    ĐANG TẠO...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    TẠO & LƯU BÀI HỌC
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
