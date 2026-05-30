export interface SessionConfig {
  topic: string;
  wordType: string; // e.g., "Noun" | "Verb"| "Adjective" | "Any" (translated to Vietnamese or English)
  level: 'Easy' | 'Medium' | 'Hard';
  language: 'vi' | 'en';
  duration: number; // default: 3 seconds
  mode: 'motion' | 'sound' | 'emotion'; // Tab/Mode selector
  count?: number; // customized card counts
}

export interface CueItem {
  id: string;
  text: string;           // The main word or phrase
  translation?: string;    // The translation (English if language is Vietnamese, or vice-versa)
  hint?: string;          // A short suggestion or prompt clue
  category?: string;      // metadata category (e.g., 'pose', 'sound', 'emotion')
  poseJson?: string;      // For physical poses: stick figure coordinates
  soundText?: string;     // For onomatopoeia sounds: e.g. "quack quack"
  svgData?: string;       // AI generated visual SVG code
  audioVi?: string;       // Base64 Vietnamese synthesized vocal file
  audioEn?: string;       // Base64 English synthesized vocal file
}

export type RoundStatus = 'idle' | 'running' | 'paused' | 'stopped';

export interface NineRouterConfig {
  enabled: boolean;
  url: string;      // default: http://localhost:20128 or https://api.9router.com
  apiKey: string;   // Optional bearer key
  llmModel: string; // e.g., "openai/gpt-4o", "gemini/gemini-2.0-flash", "cc/claude-3-5-sonnet"
  sttModel: string; // e.g., "openai/whisper-1", "groq/whisper-large-v3", "deepgram/nova-3"
  ttsModelVi?: string; // Voice/model for Vietnamese TTS, e.g. "edge-tts/vi-VN-HoaiMyNeural"
  ttsModelEn?: string; // Voice/model for English TTS, e.g. "edge-tts/en-US-AriaNeural"
}
