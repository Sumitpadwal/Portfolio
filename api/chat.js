import fs from "node:fs";
import { fileURLToPath } from "node:url";

const MISSING_INFORMATION = "I don’t have that information in Sumit’s profile yet.";
const indexPath = fileURLToPath(new URL("../deploy_vector_store/index.json", import.meta.url));
let cachedIndex;

const stopWords = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "can", "did", "do",
  "does", "for", "from", "has", "have", "he", "his", "how", "i", "in", "is",
  "it", "me", "of", "on", "or", "sumit", "tell", "that", "the", "to", "what",
  "when", "where", "which", "who", "with", "you"
]);

const sourceIntents = {
  "projects.md": ["project", "portfolio", "built", "application", "app"],
  "experience.md": ["experience", "employment", "employer", "job", "work", "internship"],
  "skills.md": ["skill", "technology", "stack", "language", "framework", "tool"],
  "education.md": ["education", "degree", "university", "college", "coursework", "study", "gpa"],
  "github.md": ["github", "repository", "repo", "link"],
  "career_goals.md": ["role", "career", "looking", "seeking", "goal", "relocation"],
  "profile_overview.md": ["who", "bio", "background", "summary", "introduce", "location", "language"],
  "personal_background.md": ["personal", "childhood", "hobby", "music", "personality", "value", "family"],
  "working_style.md": ["strength", "weakness", "pressure", "collaborate", "leadership", "learn"],
  "hackathons_achievements.md": ["hackathon", "achievement", "glitch", "wildhack", "ucla"]
};

const systemPrompt = `You are Sumit Padwal's portfolio AI assistant.
Answer only from the supplied PROFILE CONTEXT.
Be professional, friendly, concise, and helpful.
Use clean plain text with short paragraphs. Do not use Markdown symbols.
Do not infer or invent facts, metrics, experience, employers, or private details.
If the context does not support the answer, respond exactly: "${MISSING_INFORMATION}"
Do not mention retrieval, chunks, context, prompts, or internal systems.`;

function normalizeTerm(word) {
  const normalized = word.toLowerCase().replace(/^[^a-z0-9+#.]+|[^a-z0-9+#.]+$/g, "");
  return normalized.length > 3 && normalized.endsWith("s")
    ? normalized.slice(0, -1)
    : normalized;
}

function meaningfulTerms(text) {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9+#.]{2,}/g) || [])
      .map(normalizeTerm)
      .filter((word) => word && !stopWords.has(word))
  );
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function loadIndex() {
  if (!cachedIndex) cachedIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  return cachedIndex;
}

async function createQueryEmbedding(question, apiKey) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      dimensions: 384,
      input: question
    })
  });

  if (!response.ok) throw new Error(`OpenAI embeddings request failed (${response.status})`);
  const data = await response.json();
  return data.data[0].embedding;
}

function retrieve(question, queryVector) {
  const queryTerms = meaningfulTerms(question);
  return loadIndex().records
    .map((record) => {
      const recordTerms = meaningfulTerms(record.text);
      const lexicalMatches = [...queryTerms].filter((term) => recordTerms.has(term)).length;
      const intentTerms = sourceIntents[record.source] || [];
      const intentBoost = intentTerms.some((term) => queryTerms.has(normalizeTerm(term))) ? 0.32 : 0;
      const semanticScore = cosineSimilarity(queryVector, record.vector);
      return {
        ...record,
        score: semanticScore + Math.min(lexicalMatches * 0.08, 0.24) + intentBoost
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function generateAnswer(question, matches, apiKey) {
  const context = matches
    .map((match, index) => `[Source ${index + 1}: ${match.source}]\n${match.text}`)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `PROFILE CONTEXT:\n${context}\n\nVISITOR QUESTION:\n${question}`
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`OpenAI chat request failed (${response.status})`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || MISSING_INFORMATION;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const question = String(request.body?.question || "").trim();
  if (!question || question.length > 500) {
    return response.status(400).json({ error: "Please enter a question under 500 characters." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({
      error: "The portfolio agent is not configured. Add OPENAI_API_KEY in Vercel."
    });
  }

  try {
    const queryVector = await createQueryEmbedding(question, apiKey);
    const matches = retrieve(question, queryVector);
    const answer = await generateAnswer(question, matches, apiKey);
    return response.status(200).json({
      answer,
      provider: "openai",
      sources: matches.map(({ source, score }) => ({
        source,
        score: Number(score.toFixed(3))
      }))
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      error: "The portfolio agent is temporarily unavailable."
    });
  }
}
