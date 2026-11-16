import { GoogleGenAI } from "@google/genai";

let ai = null;
function getAI() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY?.trim();
    console.log("KEY CHECK:", key ? key.substring(0,10)+"..." : "MISSING!!!");
    if (!key || key.length < 10) {
      throw new Error("GEMINI_API_KEY missing in backend/.env - add it!");
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];

async function tryModels(prompt) {
  const client = getAI();
  for (const m of MODELS) {
    try {
      console.log(`-> Trying ${m}`);
      const res = await client.models.generateContent({ model: m, contents: prompt });
      console.log(`SUCCESS with ${m} !!!`);
      return res.text;
    } catch (e) {
      console.log(`Failed ${m}:`, e.message.substring(0,200));
    }
  }
  throw new Error("All models failed");
}

function getFullText(doc) {
  if (!doc) return "";
  if (Array.isArray(doc)) {
    return doc.map(c => c.content || c.text || "").join('\n\n');
  }
  if (doc.extractedText && doc.extractedText.length > 50) return doc.extractedText;
  if (doc.chunks && doc.chunks.length > 0) {
    return doc.chunks.map(c => c.content || c.text || "").join('\n\n');
  }
  return "";
}

export const generateFlashcards = async (doc, count = 8) => {
  let t = "";
  if (typeof doc === "string") t = doc;
  else t = getFullText(doc);
  t = t.substring(0, 12000);

  const p = `Create ${count} flashcards from ONLY this text below. Do not use outside knowledge. Do not invent facts.

TEXT:
${t}

Return ONLY a valid JSON array, no markdown, no explanation. Format exactly like this:
[{"question": "...", "answer": "...", "difficulty": "easy"}]`;

  const r = await tryModels(p);
  try { return JSON.parse(r.replace(/```json|```/g, '').trim()); } catch {
    return [];
  }
};

export const generateQuiz = async (doc, numQuestions = 5) => {
  const t = (typeof doc === 'string' ? doc : getFullText(doc)).substring(0,12000);
  const p = `Create ${numQuestions} MCQs from th is text: ${t}

  Return ONLY valid JSON array, no markdown. Format exactly like this:
  [
    {
      "question": "What is React?",
      "options": ["Library", "Framework", "Language", "Database"],
      "correctAnswer": "Library",
      "explanation": "React is a JavaScript library for building UI because it helps create components",
      "difficulty": "easy"
    }
  ]
  Rules: correctAnswer must be one of options. explanation must be 1-2 sentences, never empty. difficulty is easy, medium or hard.`;
  const r = await tryModels(p);
  try { return JSON.parse(r.replace(/'''json|'''/g,'').trim()); } catch {
    console.log("Raw quiz response:", r);
    throw new Error("Failed to parse quiz JSON");
  }
};

export const generateSummary = async (doc) => {
  // THIS FIX: Use chunks if extractedText is empty
  let text = doc.extractedText || "";
  if (text.length < 100 && doc.chunks?.length > 0) {
    text = doc.chunks.map(c => c.content).join("\n\n");
  }
  
  console.log("TEXT LENGTH FOR GEMINI:", text.length); // will show in terminal

  const prompt = `Summarize in 7 bullet points:\n\n${text.substring(0,15000)}`;
  
  // your existing tryModels call
  return await tryModels(prompt);
}

export const chatWithDocument = async (doc, question, history=[]) => {
  const full = getFullText(doc);
  const t = full.substring(0,10000);
  console.log("CHAT TEXT LENGTH:", t.length);
  const prompt = `You are a helpful assistant. Answer the question from the context below.

Context:
${t}

Question: ${question}

Answer in detail using only the context above.`;
  return await tryModels(prompt);
};

export const explainConcept = async (doc, concept) => {
  const t = getFullText(doc).substring(0,10000);
  return await tryModels(`Explain "${concept}" simply with example. Context: ${t}`);
};