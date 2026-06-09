export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  return response.status(200).json({
    status: "ok",
    agent: "Sumit Portfolio AI",
    runtime: "vercel"
  });
}
