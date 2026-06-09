import { generateAnswer } from "./providers.js";
import { retrieve } from "./retriever.js";

export async function answerQuestion(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  if (!question || question.length > 500) {
    const error = new Error("Please enter a question under 500 characters.");
    error.statusCode = 400;
    throw error;
  }

  const matches = await retrieve(question);
  const result = await generateAnswer(question, matches);

  return {
    answer: result.answer,
    provider: result.provider,
    sources: matches.map(({ source, score }) => ({
      source,
      score: Number(score.toFixed(3))
    }))
  };
}
