import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({ storage: multer.memoryStorage() });

const PORT = Number(process.env.PORT) || 3000;

// Lazy-loaded GoogleGenAI Helper
let aiClient: GoogleGenAI | null = null;

function normalizeNineRouterApiBase(url: string = "http://localhost:20128") {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function isLoopbackNineRouterUrl(url?: string) {
  if (!url) return true;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url.trim());
}

function getEnvNineRouterConfig() {
  const url = process.env.NINE_ROUTER_URL;
  if (!url) return null;
  return {
    enabled: process.env.NINE_ROUTER_ENABLED !== "false",
    url,
    apiKey: process.env.NINE_ROUTER_API_KEY || "",
    llmModel: process.env.NINE_ROUTER_LLM_MODEL || "lucy",
    sttModel: process.env.NINE_ROUTER_STT_MODEL || "openai/whisper-1",
    ttsModelVi: process.env.NINE_ROUTER_TTS_MODEL_VI || "edge-tts/vi-VN-HoaiMyNeural",
    ttsModelEn: process.env.NINE_ROUTER_TTS_MODEL_EN || "edge-tts/en-US-AriaNeural"
  };
}

function resolveNineRouterConfig(incoming?: any) {
  const envConfig = getEnvNineRouterConfig();
  if (!incoming || !incoming.enabled) return envConfig || incoming;

  // In production, browser defaults like localhost point to the user's device, not Cloud Run.
  // Use Cloud Run's shared 9Router config when the incoming config is local/default/incomplete.
  if (envConfig && (isLoopbackNineRouterUrl(incoming.url) || !incoming.apiKey)) {
    return { ...envConfig, enabled: true };
  }

  return incoming;
}

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
  ],
  "vi_Sentence_Easy": [
    { text: "Em thích đọc sách.", translation: "I like reading books." },
    { text: "Trời hôm nay rất đẹp.", translation: "The weather is very nice today." },
    { text: "Mẹ nấu cơm ngon.", translation: "Mom cooks delicious rice." },
    { text: "Bạn em chơi bóng.", translation: "My friend plays ball." },
    { text: "Con mèo đang ngủ.", translation: "The cat is sleeping." }
  ],
  "vi_Sentence_Medium": [
    { text: "Em muốn đi thư viện, nhưng hôm nay em phải học tiếng Anh.", translation: "I want to go to the library, but today I have to study English." },
    { text: "Sau giờ học, chúng em thường chơi thể thao và nói chuyện với bạn bè.", translation: "After school, we often play sports and talk with friends." },
    { text: "Bạn Lan thích du lịch vì bạn ấy muốn khám phá nhiều thành phố mới.", translation: "Lan likes traveling because she wants to explore many new cities." },
    { text: "Khi rảnh rỗi, em nghe nhạc hoặc luyện nói với gia đình.", translation: "In my free time, I listen to music or practice speaking with my family." },
    { text: "Bữa sáng rất quan trọng, vì nó giúp em có năng lượng cả ngày.", translation: "Breakfast is important because it gives me energy all day." }
  ],
  "vi_Sentence_Hard": [
    { text: "Mặc dù công nghệ giúp học tập nhanh hơn, chúng ta vẫn cần suy nghĩ độc lập và sáng tạo.", translation: "Although technology helps us learn faster, we still need independent and creative thinking." },
    { text: "Nếu mọi người bảo vệ môi trường mỗi ngày, thành phố sẽ trở nên sạch đẹp và đáng sống hơn.", translation: "If everyone protects the environment every day, the city will become cleaner and more livable." },
    { text: "Khi đối mặt với áp lực, em cố gắng bình tĩnh để tìm giải pháp phù hợp.", translation: "When facing pressure, I try to stay calm to find a suitable solution." },
    { text: "Văn hóa địa phương rất đa dạng, nên du khách có thể học được nhiều góc nhìn mới.", translation: "Local culture is very diverse, so visitors can learn many new perspectives." },
    { text: "Dù bài thuyết trình khá khó, nhóm em đã hợp tác tốt và hoàn thành đúng hạn.", translation: "Although the presentation was quite difficult, my team cooperated well and finished on time." }
  ],
  "en_Sentence_Easy": [
    { text: "I like my school.", translation: "Em thích trường của em." },
    { text: "The sun is bright.", translation: "Mặt trời rất sáng." },
    { text: "My dog runs fast.", translation: "Con chó của em chạy nhanh." },
    { text: "We eat rice today.", translation: "Hôm nay chúng em ăn cơm." },
    { text: "She has a red bag.", translation: "Cô ấy có một chiếc cặp màu đỏ." }
  ],
  "en_Sentence_Medium": [
    { text: "I want to visit the museum, but I have homework tonight.", translation: "Em muốn thăm bảo tàng, nhưng tối nay em có bài tập." },
    { text: "After school, we play football and talk about our favorite movies.", translation: "Sau giờ học, chúng em chơi bóng đá và nói về những bộ phim yêu thích." },
    { text: "My brother learns English because he wants to travel next year.", translation: "Anh trai em học tiếng Anh vì anh ấy muốn đi du lịch vào năm tới." },
    { text: "Healthy food gives us energy, so we should eat more vegetables.", translation: "Đồ ăn lành mạnh cho chúng ta năng lượng, vì vậy chúng ta nên ăn nhiều rau hơn." },
    { text: "On weekends, my family often cooks together and listens to music.", translation: "Vào cuối tuần, gia đình em thường nấu ăn cùng nhau và nghe nhạc." }
  ],
  "en_Sentence_Hard": [
    { text: "Although technology changes quickly, students still need patience, curiosity, and clear communication.", translation: "Mặc dù công nghệ thay đổi nhanh chóng, học sinh vẫn cần kiên nhẫn, tò mò và giao tiếp rõ ràng." },
    { text: "If people protect local parks, the city will feel healthier and more peaceful.", translation: "Nếu mọi người bảo vệ công viên địa phương, thành phố sẽ lành mạnh và yên bình hơn." },
    { text: "When I feel nervous, I breathe slowly and focus on one small step.", translation: "Khi em cảm thấy lo lắng, em thở chậm và tập trung vào một bước nhỏ." },
    { text: "Because cultures are different, travelers should listen carefully and respect local habits.", translation: "Vì các nền văn hóa khác nhau, du khách nên lắng nghe cẩn thận và tôn trọng thói quen địa phương." },
    { text: "Even when a project is difficult, teamwork can turn pressure into creative energy.", translation: "Ngay cả khi dự án khó, tinh thần đồng đội có thể biến áp lực thành năng lượng sáng tạo." }
  ],
  "en_OneSyllable_Easy": [
    { text: "tree", translation: "cây" },
    { text: "free", translation: "tự do / miễn phí" },
    { text: "mine", translation: "của tôi / mỏ" },
    { text: "sun", translation: "mặt trời" },
    { text: "book", translation: "sách" }
  ],
  "en_OneSyllable_Medium": [
    { text: "bridge", translation: "cây cầu" },
    { text: "growth", translation: "sự phát triển" },
    { text: "choice", translation: "sự lựa chọn" },
    { text: "dream", translation: "giấc mơ" },
    { text: "truth", translation: "sự thật" }
  ],
  "en_OneSyllable_Hard": [
    { text: "strength", translation: "sức mạnh" },
    { text: "thought", translation: "ý nghĩ" },
    { text: "scheme", translation: "kế hoạch / mưu đồ" },
    { text: "glimpse", translation: "cái nhìn thoáng qua" },
    { text: "depth", translation: "chiều sâu" }
  ],
  "vi_OneSyllable_Easy": [
    { text: "tree", translation: "cây" },
    { text: "free", translation: "tự do / miễn phí" },
    { text: "mine", translation: "của tôi / mỏ" },
    { text: "sun", translation: "mặt trời" },
    { text: "book", translation: "sách" }
  ],
  "vi_OneSyllable_Medium": [
    { text: "bridge", translation: "cây cầu" },
    { text: "growth", translation: "sự phát triển" },
    { text: "choice", translation: "sự lựa chọn" },
    { text: "dream", translation: "giấc mơ" },
    { text: "truth", translation: "sự thật" }
  ],
  "vi_OneSyllable_Hard": [
    { text: "strength", translation: "sức mạnh" },
    { text: "thought", translation: "ý nghĩ" },
    { text: "scheme", translation: "kế hoạch / mưu đồ" },
    { text: "glimpse", translation: "cái nhìn thoáng qua" },
    { text: "depth", translation: "chiều sâu" }
  ]
};

function normalizeWordType(value: string = "") {
  return value.trim().toLowerCase();
}

function isQuestionWordType(value: string = "") {
  const normalized = normalizeWordType(value);
  return normalized === "dạng câu hỏi" || normalized === "question";
}

function isSentenceWordType(value: string = "") {
  const normalized = normalizeWordType(value);
  return (
    normalized === "dạng câu" ||
    normalized === "câu" ||
    normalized === "câu ngắn" ||
    normalized === "sentence" ||
    normalized === "short sentence"
  );
}

function isOneSyllableWordType(value: string = "") {
  const normalized = normalizeWordType(value);
  return (
    normalized === "1 âm tiết" ||
    normalized === "một âm tiết" ||
    normalized === "từ một âm tiết" ||
    normalized === "one syllable" ||
    normalized === "one-syllable" ||
    normalized === "monosyllable" ||
    normalized === "monosyllabic word"
  );
}

// Returns robust fallback data based on configurations
function getFallbackCuesByConfig(lang: string, topic: string, wordType: string, level: string, count: number) {
  const fallbackLang = isOneSyllableWordType(wordType) ? 'en' : lang;
  let key = `${fallbackLang}_${wordType === 'Bất kỳ' || wordType === 'Any' ? 'Any' : 'School'}_${level}`;
  
  if (isQuestionWordType(wordType)) {
    key = `${fallbackLang}_Question_${level}`;
  } else if (isSentenceWordType(wordType)) {
    key = `${fallbackLang}_Sentence_${level}`;
  } else if (isOneSyllableWordType(wordType)) {
    key = `en_OneSyllable_${level}`;
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
  const isSentenceRequest = isSentenceWordType(wordType);
  const isQuestionRequest = isQuestionWordType(wordType);
  const isOneSyllableRequest = isOneSyllableWordType(wordType);
  const currentLangCode = isOneSyllableRequest ? 'en' : (language || 'vi');
  const wordTypePrompt = wordType && wordType !== 'Bất kỳ' && wordType !== 'Any'
    ? `Ensure every generated item fits the format/grammatical word category: "${wordType}".`
    : "Any word type (nouns, verbs, adjectives, questions) is fine.";

  const cueShapePrompt = isSentenceRequest
    ? `CRITICAL SENTENCE REQUIREMENT: Each cue MUST be one complete sentence in the primary language, not an isolated word or phrase.
Difficulty-specific sentence rules:
- Easy: a simple single-clause sentence under 10 words, using basic everyday vocabulary and beginner topics such as family, school, food, weather, classroom, colors, animals, or daily actions.
- Medium: a compound/two-part sentence around 12-20 words, using A2-B1 topics such as routines, travel, hobbies, health, work, shopping, plans, opinions, or experiences. Use connectors like "and", "but", "because", "so" / "và", "nhưng", "vì", "nên".
- Hard: a higher-level compound or complex two-part sentence around 18-25 words, using richer topics such as culture, environment, technology, emotions, problem solving, teamwork, creativity, or community.
Do NOT output questions unless the selected word type is Question. Keep each cue as exactly one sentence.`
    : isOneSyllableRequest
      ? `CRITICAL ONE-SYLLABLE REQUIREMENT: Ignore the requested UI language for this word type. Every cue MUST be English first, then Vietnamese translation.
Each cue.text MUST be exactly one single English word with exactly one spoken syllable, such as "tree", "free", "mine", "sun", "book", "bridge", "strength".
Each cue.translation MUST be the Vietnamese meaning of that English word. Do NOT output Vietnamese in text. Do NOT output two-syllable words, phrases, sentences, or questions. Avoid invalid examples like "sunshine" because it has two syllables; use "sun" instead.
Difficulty-specific one-syllable rules:
- Easy: common beginner one-syllable English words from basic vocabulary.
- Medium: useful A2-B1 one-syllable English words with slightly richer meaning.
- Hard: advanced or challenging one-syllable English words with consonant clusters or abstract meanings.`
      : `CRITICAL REQUIREMENT: Each cue MUST contain ONLY a single vocabulary word, extremely short expression, or short question (maximum of 1 to 2 words maximum, e.g., "Bút chì", "Chạy bộ", "Thông minh", "Tại sao?", "Thật hả?" / "Pencil", "Running", "Intelligent", "Why?", "Really?"). Do NOT output any long sentences, phrases, descriptions, scenarios, or instructions. Keep it strictly as distinct vocabulary/question items.`;

  const cueTextDescription = isSentenceRequest
    ? "The lively sentence cue in the primary language."
    : isQuestionRequest
      ? "The lively short question word or question expression (1-2 words maximum) in the primary language."
      : isOneSyllableRequest
        ? "Exactly one one-syllable English word."
        : "The lively short vocabulary or expression (1-2 words maximum) in the primary language.";

  const prompt = `Generate a list of exactly ${count} creative, spontaneous, energetic speaking prompt cues for an improvisation/speaking live class.
Topic/Theme of prompt cues: "${topic || 'General classroom topics'}"
Difficulty Level: "${level || 'Easy'}"
Primary output language of the cues: ${isOneSyllableRequest ? 'English only for text, Vietnamese only for translation' : currentLangCode === 'vi' ? 'Vietnamese (Tiếng Việt)' : 'English'}.
${wordTypePrompt}

${cueShapePrompt}

Each cue must have:
1. 'text': ${cueTextDescription}
2. 'translation': Direct translation of the cue (English if Primary Lang is Vietnamese; Vietnamese if Primary Lang is English).
Ensure outputs are educational, appropriate, totally random, and avoid dry generic words.

Besides 'cues', you must also generate a 'suggestedSlug' string representing the lesson name translated into English components separated by hyphens. Format: "[theme]-[wordType]-[difficulty]". For example, "life-nouns-easy", "animals-verbs-medium", "space-questions-hard", "daily-sentences-easy".`;

  // Check 9Router Pathway first, allowing use without standard Gemini Key
  const cueNineRouterConfig = resolveNineRouterConfig(nineRouterConfig);
  if (cueNineRouterConfig && cueNineRouterConfig.enabled) {
    try {
      const apiBaseUrl = normalizeNineRouterApiBase(cueNineRouterConfig.url || "http://localhost:20128");
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (cueNineRouterConfig.apiKey) {
        headers["Authorization"] = `Bearer ${cueNineRouterConfig.apiKey}`;
      }

      console.log(`Routing cue generation to 9Router (${apiBaseUrl}) using LLM model: ${cueNineRouterConfig.llmModel}`);

      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: cueNineRouterConfig.llmModel || "lucy",
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

      return res.json({ cues: processedCues, suggestedSlug: data.suggestedSlug || null, source: `9router-${cueNineRouterConfig.llmModel}` });
    } catch (err: any) {
      console.warn("Failed to generate cues using 9Router API:", err.message);
      if (isOneSyllableRequest) {
        return res.status(502).json({
          error: err.message || "Failed 9Router query",
          source: "9router-error",
          message: "One-syllable mode requires live LLM generation. Fallback/mock cue lists are disabled for this word type."
        });
      }
      // Fall back to local mock cues seamlessly for non one-syllable modes
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
    if (isOneSyllableRequest) {
      return res.status(503).json({
        error: "Live LLM is required for one-syllable generation. Enable 9Router or configure GEMINI_API_KEY.",
        source: "llm-required",
        message: "Fallback/mock cue lists are disabled for one-syllable mode."
      });
    }
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
                    text: { type: Type.STRING, description: "The cue text to display on screen: short vocabulary/question by default, an English one-syllable word when One Syllable is selected, or a full sentence when Sentence is selected" },
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

  if (isOneSyllableRequest) {
    return res.status(502).json({
      error: lastError?.message || "Unavailable",
      source: "llm-error",
      message: "One-syllable mode requires live LLM generation. Fallback/mock cue lists are disabled for this word type."
    });
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
      config = resolveNineRouterConfig(rawConfig ? JSON.parse(rawConfig) : null);
    } catch (e) {
      return res.status(400).json({ error: "Invalid nineRouterConfig parameter." });
    }

    if (!config || !config.enabled) {
      return res.status(400).json({ error: "9Router must be configured and enabled for STT support." });
    }

    const baseUrl = normalizeNineRouterApiBase(config.url || "http://localhost:20128");
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

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
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

    let config = resolveNineRouterConfig(nineRouterConfig);
    if (!config || !config.enabled) {
      return res.status(400).json({ error: "9Router must be configured and enabled for Analysis support." });
    }

    const baseUrl = normalizeNineRouterApiBase(config.url || "http://localhost:20128");
    const llmModel = config.llmModel || "lucy";

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

    const response = await fetch(`${baseUrl}/chat/completions`, {
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
    const config = resolveNineRouterConfig({ enabled: true, url, apiKey });
    const baseUrl = normalizeNineRouterApiBase(config?.url || "http://localhost:20128");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (config?.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    const response = await fetch(`${baseUrl}/models`, {
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

// Database Lessons file path
const LESSONS_FILE = path.join(process.cwd(), "lessons_db.json");
const LESSONS_GCS_BUCKET = process.env.LESSONS_GCS_BUCKET || "";
const LESSONS_GCS_FILE = process.env.LESSONS_GCS_FILE || "lessons_db.json";
const storage = LESSONS_GCS_BUCKET ? new Storage() : null;

// Default initial preset lessons (Motion, Sound, Emotion)
const INITIAL_PRESET_LESSONS: any[] = [];

async function readLocalLessonsDb() {
  if (!fs.existsSync(LESSONS_FILE)) {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(INITIAL_PRESET_LESSONS, null, 2), "utf8");
    return INITIAL_PRESET_LESSONS;
  }
  const data = fs.readFileSync(LESSONS_FILE, "utf8");
  return JSON.parse(data);
}

async function writeLocalLessonsDb(data: any) {
  fs.writeFileSync(LESSONS_FILE, JSON.stringify(data, null, 2), "utf8");
  return true;
}

// Helper to read database safely. Uses GCS in production when LESSONS_GCS_BUCKET is configured.
async function readLessonsDb() {
  try {
    if (storage && LESSONS_GCS_BUCKET) {
      const file = storage.bucket(LESSONS_GCS_BUCKET).file(LESSONS_GCS_FILE);
      try {
        const [contents] = await file.download();
        return JSON.parse(contents.toString("utf8"));
      } catch (err: any) {
        if (err?.code === 404) {
          await file.save(JSON.stringify(INITIAL_PRESET_LESSONS, null, 2), {
            contentType: "application/json",
            resumable: false
          });
          return INITIAL_PRESET_LESSONS;
        }
        throw err;
      }
    }
    return await readLocalLessonsDb();
  } catch (err: any) {
    console.warn("Error reading lessons database:", err.message);
    return INITIAL_PRESET_LESSONS;
  }
}

// Helper to write database safely. Uses GCS in production when LESSONS_GCS_BUCKET is configured.
async function writeLessonsDb(data: any) {
  try {
    if (storage && LESSONS_GCS_BUCKET) {
      const file = storage.bucket(LESSONS_GCS_BUCKET).file(LESSONS_GCS_FILE);
      await file.save(JSON.stringify(data, null, 2), {
        contentType: "application/json",
        resumable: false,
        metadata: { cacheControl: "no-store" }
      });
      return true;
    }
    return await writeLocalLessonsDb(data);
  } catch (err: any) {
    console.warn("Error writing lessons database:", err.message);
    return false;
  }
}

// API: System status telemetry check
app.get("/api/status", async (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  const envNineRouterConfig = getEnvNineRouterConfig();
  let lessonCount = 0;
  try {
    const lessons = await readLessonsDb();
    lessonCount = Array.isArray(lessons) ? lessons.length : 0;
  } catch (e) {}

  res.json({
    ok: true,
    geminiKeyConfigured: hasGeminiKey,
    lessonCount,
    nodeVersion: process.version,
    env: process.env.NODE_ENV || "development",
    nineRouterConfigured: !!envNineRouterConfig,
    nineRouterUrl: envNineRouterConfig ? normalizeNineRouterApiBase(envNineRouterConfig.url).replace(/\/v1$/, "") : null,
    nineRouterModel: envNineRouterConfig?.llmModel || null,
    lessonsStorage: LESSONS_GCS_BUCKET ? "gcs" : "local",
    lessonsBucket: LESSONS_GCS_BUCKET || null,
    lessonsFile: LESSONS_GCS_FILE
  });
});

// API: Get all custom & preset lessons
app.get("/api/lessons", async (req, res) => {
  const data = await readLessonsDb();
  res.json(data);
});

// Server-side helper to synthesize and return base64 audio
async function generateAudioBase64(text: string, language: string, nineRouterConfig?: any): Promise<string | null> {
  if (!text) return null;

  // Try 9Router if enabled
  const resolvedNineRouterConfig = resolveNineRouterConfig(nineRouterConfig);
  if (resolvedNineRouterConfig && resolvedNineRouterConfig.enabled) {
    try {
      const baseUrl = normalizeNineRouterApiBase(resolvedNineRouterConfig.url || "http://localhost:20128");
      const model = language === "en"
        ? (resolvedNineRouterConfig.ttsModelEn || "edge-tts/en-US-AriaNeural")
        : (resolvedNineRouterConfig.ttsModelVi || "edge-tts/vi-VN-HoaiMyNeural");

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (resolvedNineRouterConfig.apiKey) {
        headers["Authorization"] = `Bearer ${resolvedNineRouterConfig.apiKey}`;
      }

      const response = await fetch(`${baseUrl}/audio/speech?response_format=json`, {
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

  const lessons = await readLessonsDb();
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

  await writeLessonsDb(lessons);
  res.json({ success: true, lesson: newLesson });
});

// API: Seed Default sample lessons with customized Audio
app.post("/api/lessons/seed", async (req, res) => {
  const { nineRouterConfig } = req.body;
  const lessons = await readLessonsDb();

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
    await writeLessonsDb(lessons);
  }

  res.json({ success: true, seededCount: addedCount, total: lessons.length });
});

// API: Delete custom lesson

// API: Delete custom lesson
app.delete("/api/lessons/:id", async (req, res) => {
  const { id } = req.params;
  const lessons = await readLessonsDb();
  const filtered = lessons.filter((l: any) => l.id !== id);
  await writeLessonsDb(filtered);
  res.json({ success: true, idDeleted: id });
});

// API: Update custom lesson
app.put("/api/lessons/:id", async (req, res) => {
  const { id } = req.params;
  const { topic, cues } = req.body;
  const lessons = await readLessonsDb();
  const lessonIndex = lessons.findIndex((l: any) => l.id === id);
  if (lessonIndex > -1) {
    if (topic) lessons[lessonIndex].topic = topic;
    if (cues !== undefined) lessons[lessonIndex].cues = cues;
    await writeLessonsDb(lessons);
    res.json({ success: true, updatedLesson: lessons[lessonIndex] });
  } else {
    res.status(404).json({ error: "Lesson not found" });
  }
});

// API: Check & Generate missing audios for a lesson
app.post("/api/lessons/:id/generate-audio", async (req, res) => {
  const { id } = req.params;
  const { nineRouterConfig } = req.body;
  const lessons = await readLessonsDb();
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
    await writeLessonsDb(lessons);
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
    
    let svgStr = response.text || "";
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
    const resolvedNineRouterConfig = resolveNineRouterConfig(nineRouterConfig);
    if (!resolvedNineRouterConfig || !resolvedNineRouterConfig.url) {
      return res.status(400).json({ error: "9Router URL configuration is required for 9Router Speech synthesis." });
    }
    try {
      const baseUrl = normalizeNineRouterApiBase(resolvedNineRouterConfig.url || "http://localhost:20128");
      const model = language === "en"
        ? (resolvedNineRouterConfig.ttsModelEn || "edge-tts/en-US-AriaNeural")
        : (resolvedNineRouterConfig.ttsModelVi || "edge-tts/vi-VN-HoaiMyNeural");

      console.log(`TTS proxy routing to 9Router (${baseUrl}) using model: ${model}`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (resolvedNineRouterConfig.apiKey) {
        headers["Authorization"] = `Bearer ${resolvedNineRouterConfig.apiKey}`;
      }

      const response = await fetch(`${baseUrl}/audio/speech?response_format=json`, {
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
    const lessons = await readLessonsDb();
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
      await writeLessonsDb(seedLessons);
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
