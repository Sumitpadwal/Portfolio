import { config } from "./config.js";
import { embedTexts } from "./embeddings.js";
import { queryIndex } from "./vector-store.js";

const stopWords = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "can", "did", "do",
  "does", "for", "from", "has", "have", "he", "his", "how", "i", "in", "is",
  "it", "me", "of", "on", "or", "sumit", "tell", "that", "the", "to", "what",
  "when", "where", "which", "who", "with", "you"
]);

const sourceIntents = {
  "projects.md": ["project", "portfolio", "built", "application", "app"],
  "experience.md": ["experience", "employment", "employer", "job", "work", "worked"],
  "skills.md": ["skill", "technology", "stack", "language", "framework", "tool"],
  "education.md": ["education", "degree", "university", "college", "coursework", "study"],
  "github.md": ["github", "repository", "repo", "link"],
  "career_goals.md": ["role", "career", "looking", "seeking", "goal", "relocation"],
  "profile_overview.md": ["who", "bio", "background", "summary", "introduce", "location", "language"],
  "personal_background.md": ["personal", "childhood", "hobby", "music", "personality", "value", "family"],
  "working_style.md": ["work style", "strength", "weakness", "pressure", "collaborate", "leadership", "learn"],
  "hackathons_achievements.md": ["hackathon", "achievement", "glitch", "wildhack", "ucla"]
};

function normalizeTerm(word) {
  const normalized = word.toLowerCase().replace(/^[^a-z0-9+#.]+|[^a-z0-9+#.]+$/g, "");
  return normalized.length > 3 && normalized.endsWith("s")
    ? normalized.slice(0, -1)
    : normalized;
}

function meaningfulTerms(text) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9+#.]{2,}/g)
      ?.map(normalizeTerm)
      .filter((word) => word && !stopWords.has(word)) || []
  );
}

function sourceIntentBoost(source, queryTerms) {
  const intentTerms = sourceIntents[source] || [];
  return intentTerms.some((term) => queryTerms.has(normalizeTerm(term))) ? 0.32 : 0;
}

export async function retrieve(question) {
  const [queryVector] = await embedTexts([question]);
  const queryTerms = meaningfulTerms(question);
  const records = await queryIndex(queryVector, question, 50);

  return records
    .map((record) => {
      const recordTerms = meaningfulTerms(record.text);
      const lexicalMatches = [...queryTerms].filter((term) => recordTerms.has(term)).length;
      const intentBoost = sourceIntentBoost(record.source, queryTerms);
      return {
        ...record,
        semanticScore: record.score,
        lexicalMatches,
        intentBoost,
        score: record.score + Math.min(lexicalMatches * 0.08, 0.24) + intentBoost
      };
    })
    .filter(
      (record) =>
        record.semanticScore >= config.minScore ||
        record.lexicalMatches > 0 ||
        record.intentBoost > 0
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, config.topK);
}
