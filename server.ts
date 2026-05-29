import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
app.use(express.json());

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
Ensure outputs are educational, appropriate, totally random, and avoid dry generic words.`;

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
              content: "You are a creative speaking assistant. Always respond with raw valid JSON containing a single root key 'cues' which is an array of prompt cards conforming to the schema of cues array."
            },
            {
              role: "user",
              content: `${prompt}\nThe response MUST strictly be a JSON object containing a "cues" array: {"cues": [{"text": "...", "translation": "..."}]}`
            }
          ],
          response_format: { type: "json_object" },
          stream: false
        })
      });

      if (!response.ok) {
        const errTxt = await response.text();
        throw new Error(`9Router error ${response.status}: ${errTxt}`);
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

      return res.json({ cues: processedCues, source: `9router-${nineRouterConfig.llmModel}` });
    } catch (err: any) {
      console.error("Failed to generate cues using 9Router API:", err);
      // Fall back to local mock cues seamlessly
      return res.json({
        cues: getFallbackCuesByConfig(currentLangCode, topic || 'Chung', wordType || 'Bất kỳ', level || 'Easy', count),
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
      source: "fallback"
    });
  }

  // Attempt generation with a retry block
  let attempts = 2;
  let lastError: any = null;

  while (attempts > 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
            required: ["cues"]
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

      return res.json({ cues: processedCues, source: "gemini-ai" });

    } catch (error: any) {
      lastError = error;
      attempts--;
      console.warn(`Gemini generation attempt failed (${attempts} attempts remaining):`, error.message || error);
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
      const errTxt = await response.text();
      console.error(`9Router STT reported error ${response.status}`, errTxt);
      throw new Error(`9Router STT reported error: ${errTxt}`);
    }

    const data = await response.json();
    return res.json({ text: data.text || "", source: `9router-stt-${sttModel}` });

  } catch (error: any) {
    console.error("STT Proxy processing failed:", error);
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
      const errTxt = await response.text();
      throw new Error(`9Router Analysis error ${response.status}: ${errTxt}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || "Coach analysis could not be retrieved.";
    return res.json({ analysis: resultText, source: `9router-analysis-${llmModel}` });

  } catch (error: any) {
    console.error("LLM Analysis Proxy failed:", error);
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
const INITIAL_PRESET_LESSONS = [
  {
    id: "preset-emo-classroom",
    topic: "Trường học mộng mơ",
    type: "emotion",
    level: "Easy",
    language: "vi",
    cues: [
      { id: "e1", text: "Bút chì", translation: "Pencil" },
      { id: "e2", text: "Bảng đen", translation: "Blackboard" },
      { id: "e3", text: "Thầy giáo", translation: "Teacher" },
      { id: "e4", text: "Lớp học", translation: "Classroom" }
    ]
  },
  {
    id: "preset-mot-nature",
    topic: "Chinh phục rừng xanh",
    type: "motion",
    level: "Medium",
    language: "vi",
    cues: [
      { 
        id: "m1", 
        text: "Báo đốm", 
        translation: "Jaguar", 
        category: "pose",
        poseJson: "{\"head\": [50, 20], \"spine\": [[50,20], [45,40], [30,55]], \"leftArm\": [[45,40], [55,50], [65,60]], \"rightArm\": [[45,40], [30,30], [20,25]], \"leftLeg\": [[30,55], [35,75], [40,90]], \"rightLeg\": [[30,55], [20,70], [10,85]]}"
      },
      { 
        id: "m2", 
        text: "Chim ưng", 
        translation: "Falcon", 
        category: "pose",
        poseJson: "{\"head\": [50, 15], \"spine\": [[50,15], [50,55]], \"leftArm\": [[50,30], [20,25], [5,25]], \"rightArm\": [[50,30], [80,25], [95,25]], \"leftLeg\": [[50,55], [40,85]], \"rightLeg\": [[50,55], [60,85]]}"
      },
      { 
        id: "m3", 
        text: "Con rùa", 
        translation: "Turtle", 
        category: "pose",
        poseJson: "{\"head\": [50, 20], \"spine\": [[50,20], [50,55]], \"leftArm\": [[50,30], [30,30], [10,30]], \"rightArm\": [[50,30], [60,40], [65,55]], \"leftLeg\": [[50,55], [35,85]], \"rightLeg\": [[50,55], [65,85]]}"
      }
    ]
  },
  {
    id: "preset-snd-farm",
    topic: "Thành phố nông trại",
    type: "sound",
    level: "Easy",
    language: "vi",
    cues: [
      { id: "s1", text: "Con vịt", translation: "Duck", category: "sound", soundText: "Quack! Quack! Quack!" },
      { id: "s2", text: "Sư tử", translation: "Lion", category: "sound", soundText: "Roar! Roaaaaar!" },
      { id: "s3", text: "Con cừu", translation: "Sheep", category: "sound", soundText: "Baaah! Baaaah!" }
    ]
  }
];

// Helper to read database safely
function readLessonsDb() {
  try {
    if (!fs.existsSync(LESSONS_FILE)) {
      fs.writeFileSync(LESSONS_FILE, JSON.stringify(INITIAL_PRESET_LESSONS, null, 2), "utf8");
      return INITIAL_PRESET_LESSONS;
    }
    const data = fs.readFileSync(LESSONS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading lessons database file:", err);
    return INITIAL_PRESET_LESSONS;
  }
}

// Helper to write database safely
function writeLessonsDb(data: any) {
  try {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error writing lessons database file:", err);
    return false;
  }
}

// API: Get all custom & preset lessons
app.get("/api/lessons", (req, res) => {
  const data = readLessonsDb();
  res.json(data);
});

// API: Create or update lesson
app.post("/api/lessons", (req, res) => {
  const { id, topic, type, level, language, cues } = req.body;
  if (!topic || !type || !cues) {
    return res.status(400).json({ error: "Missing required fields (topic, type, cues)" });
  }

  const lessons = readLessonsDb();
  const lessonId = id || `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  const newLesson = {
    id: lessonId,
    topic,
    type,
    level: level || "Easy",
    language: language || "vi",
    cues
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

// API: Delete custom lesson
app.delete("/api/lessons/:id", (req, res) => {
  const { id } = req.params;
  const lessons = readLessonsDb();
  const filtered = lessons.filter((l: any) => l.id !== id);
  writeLessonsDb(filtered);
  res.json({ success: true, idDeleted: id });
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
        const errTxt = await response.text();
        throw new Error(`9Router TTS endpoint error ${response.status}: ${errTxt}`);
      }

      const data = await response.json();
      return res.json({ audio: data.audio });
    } catch (error: any) {
      console.error("9Router TTS process failed, cascading to fallback:", error);
      return res.json({ fallbackLocal: true, code: "9ROUTER_ERROR", error: error.message || "9Router Speech synthesis failed." });
    }
  }

  const ai = getAIClient();
  if (!ai) {
    return res.status(400).json({ error: "No client. Text to Speech server-side requires process.env.GEMINI_API_KEY." });
  }

  try {
    const isVi = (language || 'vi') === 'vi';
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ['AUDIO'],
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
      console.warn("No audio stream returned from Gemini TTS. Handing off to local.");
      return res.json({ fallbackLocal: true, error: "Empty stream returned" });
    }
  } catch (error: any) {
    const isRateLimit = error.message?.includes("RESOURCE_EXHAUSTED") || error.status === 429 || error.statusCode === 429 || String(error).includes("429");
    if (isRateLimit) {
      console.warn("Gemini premium TTS call rate-limited. Instructing client to fallback to Local TTS smoothly.");
      return res.json({ fallbackLocal: true, code: "RESOURCE_EXHAUSTED", error: "Rate limit exceeded" });
    }
    console.warn("Gemini premium TTS call failed:", error.message || error);
    return res.json({ fallbackLocal: true, code: "INTERNAL_ERROR", error: error.message || "Speech synthesis failed" });
  }
});

// Configure Vite middleware and static asset server
async function startServer() {
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
