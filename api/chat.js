import fs from "node:fs";
import { fileURLToPath } from "node:url";

const MISSING_INFORMATION = "I don’t have that information in Sumit’s profile yet.";
const dimensions = 384;
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

function normalizeTerm(word) {
  const normalized = word.toLowerCase().replace(/^[^a-z0-9+#.]+|[^a-z0-9+#.]+$/g, "");
  return normalized.length > 3 && normalized.endsWith("s")
    ? normalized.slice(0, -1)
    : normalized;
}

function meaningfulTerms(text) {
  const terms = new Set(
    (text.toLowerCase().match(/[a-z0-9+#.]{2,}/g) || [])
      .map(normalizeTerm)
      .filter((word) => word && !stopWords.has(word))
  );

  if (terms.has("personality")) {
    ["describe", "curious", "ambivert"].forEach((term) => terms.add(term));
  }
  if (terms.has("hobby")) {
    ["cycling", "fitness", "music"].forEach((term) => terms.add(term));
  }

  return terms;
}

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function embedText(text) {
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9+#.]{2,}/g) || [];
  const features = [...words];

  for (let index = 0; index < words.length - 1; index += 1) {
    features.push(`${words[index]}_${words[index + 1]}`);
  }

  for (const feature of features) {
    const hash = hashToken(feature);
    vector[hash % dimensions] += hash & 1 ? 1 : -1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
  }
  return dot;
}

function loadIndex() {
  if (!cachedIndex) cachedIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  return cachedIndex;
}

function retrieve(question) {
  const queryVector = embedText(question);
  const queryTerms = meaningfulTerms(question);

  return loadIndex().records
    .map((record) => {
      const recordTerms = meaningfulTerms(record.text);
      const lexicalMatches = [...queryTerms].filter((term) => recordTerms.has(term)).length;
      const intentTerms = sourceIntents[record.source] || [];
      const intentBoost = intentTerms.some((term) => queryTerms.has(normalizeTerm(term))) ? 0.45 : 0;
      const vectorScore = cosineSimilarity(queryVector, record.vector);
      return {
        ...record,
        lexicalMatches,
        intentBoost,
        vectorScore,
        score: vectorScore + Math.min(lexicalMatches * 0.14, 0.42) + intentBoost
      };
    })
    .filter((record) => record.lexicalMatches > 0 || record.intentBoost > 0 || record.vectorScore >= 0.16)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function cleanText(text) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionAnswers(text, queryTerms, limit = 5) {
  const sections = text.split(/\n(?=##\s)/).map((section) => section.trim()).filter(Boolean);
  return sections
    .map((section) => {
      const lines = section.split(/\n+/).map((line) => line.replace(/^#+\s*/, "").trim()).filter(Boolean);
      const title = lines.shift();
      const bodyCandidates = lines
        .filter((line) =>
          (line.length > 20 || /^(GPA|Role|Duration|Location):/i.test(line)) &&
          !/^(GitHub|Duration|Tech stack|Location|Years attended):/i.test(line)
        )
        .map((line, index) => {
          const terms = meaningfulTerms(line);
          const overlap = [...queryTerms].filter((term) => terms.has(term)).length;
          return { line, overlap, index };
        })
        .sort((a, b) => b.overlap - a.overlap || a.index - b.index);
      const body = bodyCandidates
        .slice(0, queryTerms.size > 1 ? 2 : 1)
        .map(({ line }) => line)
        .join(" ");
      const terms = meaningfulTerms(section);
      const relevance = [...queryTerms].filter((term) => terms.has(term)).length;
      return { title, body, relevance };
    })
    .filter(({ title, body }) => title && body)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map(({ title, body }) => `${title}: ${body}`);
}

function sentenceAnswer(question, matches) {
  const queryTerms = meaningfulTerms(question);
  const candidates = matches.flatMap((match) =>
    cleanText(match.text)
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => {
        const terms = meaningfulTerms(sentence);
        const overlap = [...queryTerms].filter((term) => terms.has(term)).length;
        return { sentence: sentence.trim(), overlap, sourceScore: match.score };
      })
  );

  const selected = [];
  const ranked = candidates.sort((a, b) =>
    b.overlap - a.overlap || b.sourceScore - a.sourceScore
  );
  const matchedCandidates = ranked.filter((candidate) => candidate.overlap > 0);
  const answerPool = matchedCandidates.length ? matchedCandidates : ranked;

  for (const candidate of answerPool) {
    if (
      candidate.sentence.length < 30 ||
      candidate.sentence.includes(MISSING_INFORMATION) ||
      selected.some((item) => item.toLowerCase() === candidate.sentence.toLowerCase())
    ) continue;
    selected.push(candidate.sentence);
    if (selected.length === 4) break;
  }

  return selected.length ? selected.join(" ") : MISSING_INFORMATION;
}

function buildAnswer(question, matches) {
  if (!matches.length) return MISSING_INFORMATION;

  const queryTerms = meaningfulTerms(question);
  const strongest = matches[0];
  if (strongest.lexicalMatches === 0 && strongest.intentBoost === 0 && strongest.vectorScore < 0.2) {
    return MISSING_INFORMATION;
  }

  const preferredSource = Object.entries(sourceIntents).find(([, terms]) =>
    terms.some((term) => queryTerms.has(normalizeTerm(term)))
  )?.[0];

  const sectionBasedSources = new Set([
    "projects.md",
    "experience.md",
    "skills.md",
    "education.md",
    "hackathons_achievements.md"
  ]);

  if (preferredSource && sectionBasedSources.has(preferredSource)) {
    const sourceText = loadIndex().records
      .filter((record) => record.source === preferredSource)
      .map((match) => match.text)
      .join("\n");
    const limit = preferredSource === "skills.md" ? 8 : 5;
    const sections = sectionAnswers(sourceText, queryTerms, limit);
    if (sections.length) return sections.join("\n\n");
  }

  return sentenceAnswer(question, matches);
}

export default function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const question = String(request.body?.question || "").trim();
  if (!question || question.length > 500) {
    return response.status(400).json({ error: "Please enter a question under 500 characters." });
  }

  try {
    const matches = retrieve(question);
    return response.status(200).json({
      answer: buildAnswer(question, matches),
      provider: "local-keyless",
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
