import { answerQuestion } from "../backend/chat-service.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = typeof request.body === "string"
      ? JSON.parse(request.body || "{}")
      : request.body || {};
    const result = await answerQuestion(body.question);
    return response.status(200).json(result);
  } catch (error) {
    console.error(error);
    const status = error.statusCode || 500;
    return response.status(status).json({
      error: status === 500
        ? "The portfolio agent is temporarily unavailable."
        : error.message
    });
  }
}
