import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({ storage: multer.memoryStorage() });

const PORT = 3000;

// Lazy-loaded GoogleGenAI Helper
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Sensible default fallback cues if the Gemini API is unconfigured or rate-limited
const fallbackCues: Record<string, Array<{ text: string; translation: string }>> = {
  "vi_School_Easy": [
    { text: "Bút chì", translation: "Pencil" },
    { text: "Học sinh", translation: "Student" },
    { text: "Thầy giáo", translation: "Teacher" },
    { text: "Bảng đen", translation: "Blackboard" },
    { text: "Thước kẻ", translation: "Ruler" }
  ],
  "vi_Any_Medium": [
    { text: "Chim ưng", translation: "Falcon" },
    { text: "Báo đốm", translation: "Jaguar" },
    { text: "Con sói", translation: "Wolf" }
  ],
  "en_Any_Medium": [
    { text: "Cloud", translation: "Đám mây" },
    { text: "Submarine", translation: "Tàu ngầm" },
    { text: "Galaxy", translation: "Thiên hà" }
  ],
  "vi_Question_Easy": [
    { text: "Tại sao?", translation: "Why?" },
    { text: "Ai đó?", translation: "Who is it?" },
    { text: "Cái gì?", translation: "What?" },
    { text: "Ở đâu?", translation: "Where?" },
    { text: "Khi nào?", translation: "When?" }
  ],
  "vi_Question_Medium": [
    { text: "Được chứ?", translation: "Is it okay?" },
    { text: "Như thế nào?", translation: "How so?" },
    { text: "Đâu rồi?", translation: "Where has it gone?" },
    { text: "Thật sao?", translation: "Is that real?" },
    { text: "Đúng không?", translation: "Am I right?" }
  ],
  "vi_Question_Hard": [
    { text: "Tại sao không?", translation: "Why not?" },
    { text: "Bao lâu nữa?", translation: "How much longer?" },
    { text: "Vì điều gì?", translation: "For what reason?" },
    { text: "Bằng cách nào?", translation: "By what means?" },
    { text: "Được chưa nhỉ?", translation: "Is it completed yet?" }
  ],
  "en_Question_Easy": [
    { text: "Why?", translation: "Tại sao?" },
    { text: "Who?", translation: "Ai?" },
    { text: "What?", translation: "Cái gì?" },
    { text: "Where?", translation: "Ở đâu?" },
    { text: "Really?", translation: "Thật sao?" }
  ],
  "en_Question_Medium": [
    { text: "Who's there?", translation: "Ai ở đó thế?" },
    { text: "Why not?", translation: "Tại sao lại không?" },
    { text: "Which one?", translation: "Cái nào cơ?" },
    { text: "Is it safe?", translation: "Có an toàn không?" },
    { text: "Any news?", translation: "Có tin gì mới không?" }
  ],
  "en_Question_Hard": [
    { text: "How is it possible?", translation: "Làm sao có thể chứ?" },
    { text: "For what purpose?", translation: "Vì mục đích gì?" },
    { text: "Are we ready yet?", translation: "Chúng ta sẵn sàng chưa nhỉ?" },
    { text: "Whose turn is it?", translation: "Đến lượt ai vậy?" },
    { text: "Could it be real?", translation: "Liệu đó có phải sự thật?" }
  ]
};

// Returns robust fallback data based on configurations
function getFallbackCuesByConfig(lang: string, topic: string, wordType: string, level: string, count: number) {
  const normWordType = (wordType || '').trim();
  let key = `${lang}_${wordType === 'Bất kỳ' || wordType === 'Any' ? 'Any' : 'School'}_${level}`;
  
  if (normWordType === "Dạng câu hỏi" || normWordType === "Question") {
    key = `${lang}_Question_${level}`;
  }
  
  const list = fallbackCues[key] || fallbackCues[`${lang}_Question_Easy`] || fallbackCues["vi_School_Easy"];
  const finalCues = [];
  for (let i = 0; i < count; i++) {
    const item = list[i % list.length];
    finalCues.push({
      id: `fallback-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
      text: `${item.text} ${i > list.length - 1 ? `(${Math.floor(i / list.length) + 1})` : ''}`.trim(),
      translation: item.translation
    });
  }
  return finalCues;
}

// API: Generate Cues Live
app.post("/api/cue/generate", async (req, res) => {
  const { topic, wordType, level, language, count = 5, nineRouterConfig } = req.body;
  const currentLangCode = language || 'vi';

  const wordTypePrompt = wordType && wordType !== 'Bất kỳ' && wordType !== 'Any'
    ? `Ensure every generated item fits the format/grammatical word category: "${wordType}".`
    : "Any word type (nouns, verbs, adjectives, questions) is fine.";

  const prompt = `Generate a list of exactly ${count} creative, spontaneous, energetic speaking prompt cues for an improvisation/speaking live class.
Topic/Theme of prompt cues: "${topic || 'General classroom topics'}"
Difficulty Level: "${level || 'Easy'}"
Primary output language of the cues: ${currentLangCode === 'vi' ? 'Vietnamese (Tiếng Việt)' : 'English'}.
${wordTypePrompt}

CRITICAL REQUIREMENT: Each cue MUST contain ONLY a single vocabulary word, extremely short expression, or short question (maximum of 1 to 2 words maximum, e.g., "Bút chì", "Chạy bộ", "Thông minh", "Tại sao?", "Thật hả?" / "Pencil", "Running", "Intelligent", "Why?", "Really?"). Do NOT output any long sentences, phrases, descriptions, scenarios, or instructions. Keep it strictly as distinct vocabulary/question items.

Each cue must have:
1. 'text': The lively short vocabulary or question word (1-2 words maximum) in the primary language.
2. 'translation': Direct translation of the word or question (English if Primary Lang is Vietnamese; Vietnamese if Primary Lang is English).
Ensure outputs are educational, appropriate, totally random, and avoid dry generic words.

Besides 'cues', you must also generate a 'suggestedSlug' string representing the lesson name translated into English components separated by hyphens. Format: "[theme]-[wordType]-[difficulty]". For example, "life-nouns-easy", "animals-verbs-medium", "space-questions-hard".`;

  // Check 9Router Pathway first, allowing use without standard Gemini Key
  if (nineRouterConfig && nineRouterConfig.enabled) {
    try {
      const baseUrl = nineRouterConfig.url || "http://localhost:20128";
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (nineRouterConfig.apiKey) {
        headers["Authorization"] = `Bearer ${nineRouterConfig.apiKey}`;
      }

      console.log(`Routing cue generation to 9Router (${baseUrl}) using LLM model: ${nineRouterConfig.llmModel}`);

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: nineRouterConfig.llmModel || "openai/gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a creative speaking assistant. Always respond with raw valid JSON containing a single root key 'cues' which is an array of prompt cards, and a 'suggestedSlug' string."
            },
            {
              role: "user",
              content: `${prompt}\nThe response MUST strictly be a JSON object containing a "cues" array and a "suggestedSlug" string: {"cues": [{"text": "...", "translation": "..."}], "suggestedSlug": "..."}`
            }
          ],
          response_format: { type: "json_object" },
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`9Router error ${response.status}`);
      }

      const jsonRes = await response.json();
      const content = jsonRes.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No text content returned from 9Router LLM completions.");
      }

      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
      }
      const data = JSON.parse(cleaned);
      const processedCues = (data.cues || []).map((cue: any, idx: number) => ({
        id: `9r-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        text: cue.text,
        translation: cue.translation
      }));

      return res.json({ cues: processedCues, suggestedSlug: data.suggestedSlug || null, source: `9router-${nineRouterConfig.llmModel}` });
    } catch (err: any) {
      console.warn("Failed to generate cues using 9Router API:", err.message);
      // Fall back to local mock cues seamlessly
      return res.json({
        cues: getFallbackCuesByConfig(currentLangCode, topic || 'Chung', wordType || 'Bất kỳ', level || 'Easy', count),
        suggestedSlug: "offline-fallback-cues",
        source: "fallback",
        error: err.message || "Failed 9Router query"
      });
    }
  }

  const ai = getAIClient();
  if (!ai) {
    console.log("GEMINI_API_KEY is not configured or placeholder remains. Serving high-fidelity mock cues seamlessly.");
    return res.json({
      cues: getFallbackCuesByConfig(currentLangCode, topic || 'Chung', wordType || 'Bất kỳ', level || 'Easy', count),
      suggestedSlug: "offline-fallback-cues",
      source: "fallback"
    });
  }

  // Attempt generation with a retry block
  let attempts = 2;
  let lastError: any = null;

  while (attempts > 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedSlug: {
                type: Type.STRING,
                description: "Short english slug for lesson based on topic, wordType, and level. Formatting: '[topic]-[wordType]-[difficulty]'"
              },
              cues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "The short vocabulary word or expression to display on screen" },
                    translation: { type: Type.STRING, description: "Direct english/vietnamese equivalent translation" }
                  },
                  required: ["text", "translation"]
                }
              }
            },
            required: ["cues", "suggestedSlug"]
          }
        }
      });

      const bodyText = response.text;
      if (!bodyText) {
        throw new Error("Empty response from AI generation model");
      }

      const data = JSON.parse(bodyText.trim());
      const processedCues = (data.cues || []).map((cue: any, idx: number) => ({
        id: `ai-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        text: cue.text,
        translation: cue.translation
      }));

      return res.json({ cues: processedCues, suggestedSlug: data.suggestedSlug || null, source: "gemini-ai" });

    } catch (error: any) {
      lastError = error;
      attempts--;
      console.warn(`Gemini generation attempt failed (${attempts} attempts remaining).`);
      if (attempts > 0) {
        // Simple artificial delay before retry
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
  }

  // If retries are all exhausted, gracefully fall back to high quality mocks without raising a hard system exception
  console.log("Gemini API queue exhausted or experiencing high demand. Gracefully serving offline backup cues.");
  return res.json({
    cues: getFallbackCuesByConfig(currentLangCode, topic || 'Chung', wordType || 'Bất kỳ', level || 'Easy', count),
    suggestedSlug: "offline-fallback-cues",
    source: "fallback",
    error: lastError?.message || "Unavailable"
  });
});


// API: Speech to Text (using 9Router STT)
app.post("/api/stt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing uploaded audio file." });
    }

    const { nineRouterConfig: rawConfig, language } = req.body;
    let config;
    try {
      config = rawConfig ? JSON.parse(rawConfig) : null;
    } catch (e) {
      return res.status(400).json({ error: "Invalid nineRouterConfig parameter." });
    }

    if (!config || !config.enabled) {
      return res.status(400).json({ error: "9Router must be configured and enabled for STT support." });
    }

    const baseUrl = config.url || "http://localhost:20128";
    const sttModel = config.sttModel || "openai/whisper-1";

    console.log(`STT proxy routing to 9Router (${baseUrl}) with model: ${sttModel}`);

    const formData = new FormData();
    formData.append("model", sttModel);
    
    // Create audio Blob from req.file buffer
    const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" });
    formData.append("file", audioBlob, req.file.originalname || "audio.webm");

    if (language) {
      formData.append("language", language);
    }

    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error(`9Router STT reported error ${response.status}`);
    }

    const data = await response.json();
    return res.json({ text: data.text || "", source: `9router-stt-${sttModel}` });

  } catch (error: any) {
    console.warn("STT Proxy processing failed:", error.message);
    return res.status(500).json({ error: error.message || "Speech transcription failed." });
  }
});


// API: LLM Prompt/Transcription Analysis (using 9Router LLM)
app.post("/api/stt/analyze", async (req, res) => {
  try {
    const { cueText, transcribedText, nineRouterConfig, language } = req.body;
    if (!transcribedText) {
      return res.status(400).json({ error: "transcribedText is required." });
    }

    let config = nineRouterConfig;
    if (!config || !config.enabled) {
      return res.status(400).json({ error: "9Router must be configured and enabled for Analysis support." });
    }

    const baseUrl = config.url || "http://localhost:20128";
    const llmModel = config.llmModel || "openai/gpt-4o";

    console.log(`LLM Analysis proxy routing to 9Router (${baseUrl}) with model: ${llmModel}`);

    const prompt = language === 'vi' 
      ? `Với tư cách là một giáo viên dạy nói tiếng Anh/tiếng Việt tinh nghịch và chu đáo, hãy nhận xét ngắn gọn về câu nói tự phát của học sinh:
Khái niệm gốc (Cue Word): "${cueText}"
Câu học sinh nói: "${transcribedText}"

Yêu cầu nhận xét:
1. Sửa lỗi ngữ pháp/từ vựng (nếu có) một cách nhẹ nhàng.
2. Đề xuất 1 câu mẫu tự nhiên, sành điệu, thời thượng hơn (kèm dịch).
3. Đánh giá nhanh về sự tự tin và tính lưu loát bằng tiếng Việt.
Giữ nhận xét cực kỳ ngắn gọn (tối đa 4 câu), vui nhộn và cổ vũ học sinh!`
      : `As a fun, supportive speaking coach in an improv classroom, evaluate the student's spontaneous spoken sentence:
Target concept (Cue Word): "${cueText}"
Student said: "${transcribedText}"

Requirements:
1. Fix any minor grammar/vocab errors smoothly.
2. Suggest 1 natural, cooler, more idiomatic way to say it (with short Vietnamese translation).
3. Give encouragement.
Keep the advice very short (max 4 sentences), using highly energetic, warm language!`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: "system", content: "You are an energetic, fun speaking coach." },
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`9Router Analysis error ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || "Coach analysis could not be retrieved.";
    return res.json({ analysis: resultText, source: `9router-analysis-${llmModel}` });

  } catch (error: any) {
    console.warn("LLM Analysis Proxy failed:", error.message);
    return res.status(500).json({ error: error.message || "Speaking evaluation analysis failed." });
  }
});


// API: Test 9Router connection & list models
app.post("/api/9router/test", async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    const baseUrl = url || "http://localhost:20128";
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers
    });
    if (response.ok) {
      const data = await response.json();
      return res.json({ ok: true, models: data.data?.map((m: any) => m.id) || [] });
    }
    const errText = await response.text();
    return res.status(400).json({ ok: false, error: errText });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// API: System status telemetry check
app.get("/api/status", (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  let lessonCount = 0;
  try {
    const lessons = readLessonsDb();
    lessonCount = Array.isArray(lessons) ? lessons.length : 0;
  } catch (e) {}

  res.json({
    ok: true,
    geminiKeyConfigured: hasGeminiKey,
    lessonCount,
    nodeVersion: process.version,
    env: process.env.NODE_ENV || "development"
  });
});

// Database Lessons file path
const LESSONS_FILE = path.join(process.cwd(), "lessons_db.json");

// Default initial preset lessons (Motion, Sound, Emotion)
const INITIAL_PRESET_LESSONS: any[] = [];

// Helper to read database safely
function readLessonsDb() {
  try {
    if (!fs.existsSync(LESSONS_FILE)) {
      fs.writeFileSync(LESSONS_FILE, JSON.stringify(INITIAL_PRESET_LESSONS, null, 2), "utf8");
      return INITIAL_PRESET_LESSONS;
    }
    const data = fs.readFileSync(LESSONS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err: any) {
    console.warn("Error reading lessons database file:", err.message);
    return INITIAL_PRESET_LESSONS;
  }
}

// Helper to write database safely
function writeLessonsDb(data: any) {
  try {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err: any) {
    console.warn("Error writing lessons database file:", err.message);
    return false;
  }
}

// API: Get all custom & preset lessons
app.get("/api/lessons", (req, res) => {
  const data = readLessonsDb();
  res.json(data);
});

// Server-side helper to synthesize and return base64 audio
async function generateAudioBase64(text: string, language: string, nineRouterConfig?: any): Promise<string | null> {
  if (!text) return null;

  // Try 9Router if enabled
  if (nineRouterConfig && nineRouterConfig.enabled) {
    try {
      const baseUrl = nineRouterConfig.url || "http://localhost:20128";
      const model = language === "en"
        ? (nineRouterConfig.ttsModelEn || "edge-tts/en-US-AriaNeural")
        : (nineRouterConfig.ttsModelVi || "edge-tts/vi-VN-HoaiMyNeural");

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (nineRouterConfig.apiKey) {
        headers["Authorization"] = `Bearer ${nineRouterConfig.apiKey}`;
      }

      const response = await fetch(`${baseUrl}/v1/audio/speech?response_format=json`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          input: text
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audio) return data.audio;
      }
    } catch (e: any) {
      console.warn(`Internal generation audio via 9Router failed (${e.name || 'Error'}). Trying Gemini fallback.`);
    }
  }

  // Fallback to Gemini
  const ai = getAIClient();
  if (ai) {
    try {
      const isVi = language === 'vi';
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: isVi ? 'Kore' : 'Zephyr' },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return base64Audio;
      }
    } catch (e: any) {
      console.log("Audio synthesis redirected to fallback engine.");
    }
  }

  // Final Failsafe: Google Translate TTS API (returns standard mp3 voiceover stream)
  try {
    console.log(`Using final fallback Google Translate TTS for language: ${language}, text: "${text}"`);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${language}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      return base64Audio;
    }
  } catch (fallbackErr: any) {
    console.warn("Google Translate TTS fallback also failed:", fallbackErr.message);
  }

  return null;
}

// API: Create or update lesson
app.post("/api/lessons", async (req, res) => {
  const { id, topic, type, level, language, cues, nineRouterConfig } = req.body;
  if (!topic || !type || !cues) {
    return res.status(400).json({ error: "Missing required fields (topic, type, cues)" });
  }

  const lessons = readLessonsDb();
  const lessonId = id || `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  // Clone cues to ensure local safety
  const updatedCues = JSON.parse(JSON.stringify(cues));

// Removed eager audio synthesis to prevent timeouts and quota limit spikes
  // Audio will be synthesized lazily at runtime or via the explicit generate-audio endpoint

  const newLesson = {
    id: lessonId,
    topic,
    type,
    level: level || "Easy",
    language: language || "vi",
    cues: updatedCues
  };

  const existingIndex = lessons.findIndex((l: any) => l.id === lessonId);
  if (existingIndex >= 0) {
    lessons[existingIndex] = newLesson;
  } else {
    lessons.push(newLesson);
  }

  writeLessonsDb(lessons);
  res.json({ success: true, lesson: newLesson });
});

// API: Seed Default sample lessons with customized Audio
app.post("/api/lessons/seed", async (req, res) => {
  const { nineRouterConfig } = req.body;
  const lessons = readLessonsDb();

  const seedLessons = [
    {
      id: "seed-words-office",
      topic: "Đời sống Công sở (Words List)",
      type: "emotion",
      level: "Medium",
      language: "vi",
      cues: [
        { id: "sw1", text: "Thăng tiến", translation: "Promotion" },
        { id: "sw2", text: "Bàn làm việc", translation: "Office desk" },
        { id: "sw3", text: "Sếp khó tính", translation: "Grumpy boss" },
        { id: "sw4", text: "Đồng nghiệp", translation: "Co-workers" },
        { id: "sw5", text: "Tăng ca đêm", translation: "Overtime midnight" }
      ]
    },
    {
      id: "seed-words-travel",
      topic: "Du lịch Bốn phương (Words List)",
      type: "emotion",
      level: "Easy",
      language: "vi",
      cues: [
        { id: "st1", text: "Bãi biển", translation: "Sunny beach" },
        { id: "st2", text: "Khách sạn", translation: "Luxury hotel" },
        { id: "st3", text: "Máy bay", translation: "Commercial airplane" },
        { id: "st4", text: "Bản đồ", translation: "Tourist map" },
        { id: "st5", text: "Máy ảnh", translation: "Vintage camera" }
      ]
    },
    {
      id: "seed-motion-fitness",
      topic: "Động tác Thể thao (Motion List)",
      type: "motion",
      level: "Hard",
      language: "vi",
      cues: [
        { id: "sm1", text: "Gánh tạ", translation: "Squat exercise", category: "pose", poseJson: "{\"head\": [50, 25], \"spine\": [[50,25], [50,55]], \"leftArm\": [[50,30], [25,20]], \"rightArm\": [[50,30], [75,20]], \"leftLeg\": [[50,55], [30,70], [35,85]], \"rightLeg\": [[50,55], [70,70], [65,85]]}" },
        { id: "sm2", text: "Nhảy dây", translation: "Jump rope", category: "pose", poseJson: "{\"head\": [50, 15], \"spine\": [[50,15], [50,55]], \"leftArm\": [[50,30], [20,40], [10,25]], \"rightArm\": [[50,30], [80,40], [90,25]], \"leftLeg\": [[50,55], [45,80]], \"rightLeg\": [[50,55], [55,80]]}" }
      ]
    },
    {
      id: "seed-sound-jungle",
      topic: "Thuộc địa Rừng sâu (Sound List)",
      type: "sound",
      level: "Medium",
      language: "vi",
      cues: [
        { id: "ss1", text: "Tiếng gió rít", translation: "Wind howling", category: "sound", soundText: "Whooooosh!" },
        { id: "ss2", text: "Tiếng mưa rơi", translation: "Rain dripping", category: "sound", soundText: "Pitter-patter!" },
        { id: "ss3", text: "Ếch kêu", translation: "Frog croaking", category: "sound", soundText: "Ribbit! Ribbit!" }
      ]
    }
  ];

  let addedCount = 0;
  for (const sl of seedLessons) {
    const exists = lessons.some((l: any) => l.topic === sl.topic);
    if (!exists) {
      lessons.push(sl);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    writeLessonsDb(lessons);
  }

  res.json({ success: true, seededCount: addedCount, total: lessons.length });
});

// API: Delete custom lesson

// API: Delete custom lesson
app.delete("/api/lessons/:id", (req, res) => {
  const { id } = req.params;
  const lessons = readLessonsDb();
  const filtered = lessons.filter((l: any) => l.id !== id);
  writeLessonsDb(filtered);
  res.json({ success: true, idDeleted: id });
});

// API: Update custom lesson
app.put("/api/lessons/:id", (req, res) => {
  const { id } = req.params;
  const { topic, cues } = req.body;
  const lessons = readLessonsDb();
  const lessonIndex = lessons.findIndex((l: any) => l.id === id);
  if (lessonIndex > -1) {
    if (topic) lessons[lessonIndex].topic = topic;
    if (cues !== undefined) lessons[lessonIndex].cues = cues;
    writeLessonsDb(lessons);
    res.json({ success: true, updatedLesson: lessons[lessonIndex] });
  } else {
    res.status(404).json({ error: "Lesson not found" });
  }
});

// API: Check & Generate missing audios for a lesson
app.post("/api/lessons/:id/generate-audio", async (req, res) => {
  const { id } = req.params;
  const { nineRouterConfig } = req.body;
  const lessons = readLessonsDb();
  const lessonIndex = lessons.findIndex((l: any) => l.id === id);
  
  if (lessonIndex === -1) {
    return res.status(404).json({ error: "Lesson not found" });
  }

  const lesson = lessons[lessonIndex];
  if (!lesson.cues) {
    return res.json({ success: true, message: "No cues found in this lesson", checked: 0, generated: 0 });
  }

  let generatedCount = 0;
  let skippedCount = 0;

  const isViOriginal = !(lesson.language === 'en'); // default to vi if undefined

  for (const cue of lesson.cues) {
    try {
      const vtText = isViOriginal ? cue.text : (cue.translation || cue.text);
      const enText = isViOriginal ? (cue.translation || cue.text) : cue.text;

      // Check VI audio
      if (!cue.audioVi && vtText) {
        console.log(`Generating missing database audioVi for cue: "${vtText}"`);
        const vtAudio = await generateAudioBase64(vtText, "vi", nineRouterConfig);
        if (vtAudio) {
          cue.audioVi = vtAudio;
          generatedCount++;
        }
      } else {
        skippedCount++;
      }

      // Check EN audio
      if (!cue.audioEn && enText) {
        console.log(`Generating missing database audioEn for cue: "${enText}"`);
        const enAudio = await generateAudioBase64(enText, "en", nineRouterConfig);
        if (enAudio) {
          cue.audioEn = enAudio;
          generatedCount++;
        }
      } else {
        skippedCount++;
      }
    } catch (err: any) {
      console.warn(`Error generating audio for cue:`, err.message);
    }
  }

  if (generatedCount > 0) {
    lessons[lessonIndex] = lesson;
    writeLessonsDb(lessons);
  }

  res.json({
    success: true,
    message: `Generated ${generatedCount} missing voiceovers, skipped ${skippedCount} already present.`,
    generated: generatedCount,
    skipped: skippedCount,
    total: lesson.cues.length * 2
  });
});


// API: Visual SVG Generation via LLM
app.post("/api/generate-svg", async (req, res) => {
  const { text, category, language } = req.body;
  if (!text) return res.status(400).json({ error: "Text requirement missing" });

  const ai = getAIClient();
  if (!ai) {
    return res.status(500).json({ error: "No Gemini API Key available" });
  }

  try {
    const prompt = `You are an expert graphic designer and SVG coder. Generate a clean, simple, flat-style SVG vector graphic representing the concept: "${text}" (Category: ${category}, Language: ${language}). The SVG should have a viewBox="0 0 100 100". Use a modern pastel or vibrant color palette. Return ONLY the raw SVG code without any markdown blocks or html boilerplate. Start directly with <svg> and end with </svg>. Make sure the svg uses percentages or is completely responsive (100% width and height).`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
      }
    });
    
    let svgStr = response.text() || "";
    svgStr = svgStr.replace(/```svg\n?/gi, '').replace(/```\n?/gi, '').trim();

    res.json({ svg: svgStr });
  } catch (err: any) {
    console.error("SVG generation failed:", err);
    res.status(500).json({ error: "SVG Generation failed" });
  }
});


// API: Generate Audio (TTS Adapter Endpoint)
app.post("/api/tts", async (req, res) => {
  const { text, language, ttsMode, nineRouterConfig } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text parameter is required" });
  }

  // Handle 9Router option if chosen or enabled
  if (ttsMode === "9router") {
    if (!nineRouterConfig || !nineRouterConfig.url) {
      return res.status(400).json({ error: "9Router URL configuration is required for 9Router Speech synthesis." });
    }
    try {
      const baseUrl = nineRouterConfig.url || "http://localhost:20128";
      const model = language === "en"
        ? (nineRouterConfig.ttsModelEn || "edge-tts/en-US-AriaNeural")
        : (nineRouterConfig.ttsModelVi || "edge-tts/vi-VN-HoaiMyNeural");

      console.log(`TTS proxy routing to 9Router (${baseUrl}) using model: ${model}`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (nineRouterConfig.apiKey) {
        headers["Authorization"] = `Bearer ${nineRouterConfig.apiKey}`;
      }

      const response = await fetch(`${baseUrl}/v1/audio/speech?response_format=json`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`9Router TTS endpoint error ${response.status}`);
      }

      const data = await response.json();
      return res.json({ audio: data.audio });
    } catch (error: any) {
      console.log(`9Router TTS Proxy: Model unavailable or unreachable. Bypassing safely to local TTS engine.`);
      return res.json({ fallbackLocal: true, code: "9ROUTER_UNAVAILABLE", error: "9Router TTS bypassed." });
    }
  }

  const ai = getAIClient();
  if (!ai) {
    return res.status(400).json({ error: "No client. Text to Speech server-side requires process.env.GEMINI_API_KEY." });
  }

  try {
    const isVi = (language || 'vi') === 'vi';
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // "Kore" or "Puck" for VI, "Zephyr" or "Charon" for EN
            prebuiltVoiceConfig: { voiceName: isVi ? 'Kore' : 'Zephyr' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({ audio: base64Audio });
    } else {
      console.log("No audio stream returned from Gemini TTS. Handing off to Translate fallback.");
    }
  } catch (error: any) {
    console.log("Gemini API TTS request redirected to fallback translator.");
  }

  // Universal failsafe inside API: Google Translate TTS url
  try {
    const langCode = (language || 'vi') === 'vi' ? 'vi' : 'en';
    console.log(`Using live translation tts fallback in API for "${text}" (${langCode})`);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const resTts = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (resTts.ok) {
      const arrayBuffer = await resTts.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      return res.json({ audio: base64Audio });
    }
  } catch (fallbackErr: any) {
    console.warn("API Translate fallback also failed:", fallbackErr.message);
  }

  return res.json({ fallbackLocal: true, error: "Speech synthesis totally exhausted" });
});

// Configure Vite middleware and static asset server
async function startServer() {
  // Auto-seed if database is currently empty (Zero configuration initialization!)
  try {
    const lessons = readLessonsDb();
    if (lessons.length === 0) {
      console.log("lessons_db.json is empty. Auto-seeding default Words List collections...");
      const seedLessons = [
        {
          id: "seed-words-office",
          topic: "Đời sống Công sở (Words List)",
          type: "emotion",
          level: "Medium",
          language: "vi",
          cues: [
            { id: "sw1", text: "Thăng tiến", translation: "Promotion" },
            { id: "sw2", text: "Bàn làm việc", translation: "Office desk" },
            { id: "sw3", text: "Sếp khó tính", translation: "Grumpy boss" },
            { id: "sw4", text: "Đồng nghiệp", translation: "Co-workers" },
            { id: "sw5", text: "Tăng ca đêm", translation: "Overtime midnight" }
          ]
        },
        {
          id: "seed-words-travel",
          topic: "Du lịch Bốn phương (Words List)",
          type: "emotion",
          level: "Easy",
          language: "vi",
          cues: [
            { id: "st1", text: "Bãi biển", translation: "Sunny beach" },
            { id: "st2", text: "Khách sạn", translation: "Luxury hotel" },
            { id: "st3", text: "Máy bay", translation: "Commercial airplane" },
            { id: "st4", text: "Bản đồ", translation: "Tourist map" },
            { id: "st5", text: "Máy ảnh", translation: "Vintage camera" }
          ]
        }
      ];
      writeLessonsDb(seedLessons);
    }
  } catch (e: any) {
    console.warn("Error auto-seeding Database on starup:", e.message);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Improv Platform Server actively running on http://localhost:${PORT}`);
  });
}

startServer();
