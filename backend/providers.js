import { config } from "./config.js";

export const MISSING_INFORMATION = "I don’t have that information in Sumit’s profile yet.";

const systemPrompt = `You are Sumit Padwal's portfolio AI assistant.
Answer only from the supplied PROFILE CONTEXT.
Be professional, friendly, concise, and helpful.
Use clean plain text with short paragraphs. Do not use Markdown symbols.
Do not infer or invent facts, metrics, experience, employers, or private details.
If the context does not support the answer, respond exactly: "${MISSING_INFORMATION}"
If the context says a formal employment history is not listed, state that clearly and summarize the practical project, coursework, hackathon, or independent experience that is listed. Do not use the missing-information response in that case.
Do not mention retrieval, chunks, context, prompts, or internal systems.`;

function buildPrompt(question, matches) {
  const context = matches
    .map((match, index) => `[Source ${index + 1}: ${match.source}]\n${match.text}`)
    .join("\n\n");
  return `${systemPrompt}\n\nPROFILE CONTEXT:\n${context}\n\nVISITOR QUESTION:\n${question}`;
}

async function callOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callGemini(prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 350 }
    })
  });

  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim();
}

function localGroundedAnswer(question, matches) {
  if (!matches.length) return MISSING_INFORMATION;

  const terms = new Set(question.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []);
  const sentences = matches
    .flatMap((match) => match.text.split(/(?<=[.!?])\s+/))
    .map((sentence) => ({
      sentence: sentence.replace(/^#+\s*/, "").trim(),
      score: [...terms].filter((term) => sentence.toLowerCase().includes(term)).length
    }))
    .filter(({ sentence }) => sentence.length > 35 && !sentence.includes(MISSING_INFORMATION))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ sentence }) => sentence);

  return sentences.length ? sentences.join(" ") : MISSING_INFORMATION;
}

export async function generateAnswer(question, matches) {
  if (!matches.length) return { answer: MISSING_INFORMATION, provider: "local" };

  const prompt = buildPrompt(question, matches);
  try {
    if (config.openAiKey) {
      return { answer: (await callOpenAI(prompt)) || MISSING_INFORMATION, provider: "openai" };
    }
    if (config.geminiKey) {
      return { answer: (await callGemini(prompt)) || MISSING_INFORMATION, provider: "gemini" };
    }
  } catch (error) {
    console.error(error.message);
  }

  return { answer: localGroundedAnswer(question, matches), provider: "local" };
}
