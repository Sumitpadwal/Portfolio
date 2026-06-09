import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { config, rootDir } from "./config.js";
import { generateAnswer } from "./providers.js";
import { retrieve } from "./retriever.js";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) throw new Error("Request is too large.");
  }
  return JSON.parse(body || "{}");
}

async function handleChat(request, response) {
  try {
    const body = await readJson(request);
    const question = String(body.question || "").trim();
    if (!question || question.length > 500) {
      return sendJson(response, 400, { error: "Please enter a question under 500 characters." });
    }

    const matches = await retrieve(question);
    const result = await generateAnswer(question, matches);
    return sendJson(response, 200, {
      answer: result.answer,
      provider: result.provider,
      sources: matches.map(({ source, score }) => ({ source, score: Number(score.toFixed(3)) }))
    });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, {
      error: error.message.includes("Vector index")
        ? error.message
        : "The portfolio agent is temporarily unavailable."
    });
  }
}

function serveStatic(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const blockedRoots = new Set(["backend", "data", "node_modules", "vector_store", ".cache"]);
  const firstSegment = relativePath.split(/[\\/]/)[0];
  const filePath = path.resolve(rootDir, relativePath);

  if (
    relativePath.startsWith(".") ||
    relativePath.startsWith("package") ||
    blockedRoots.has(firstSegment) ||
    !filePath.startsWith(`${rootDir}${path.sep}`) ||
    !fs.existsSync(filePath) ||
    !fs.statSync(filePath).isFile()
  ) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    return handleChat(request, response);
  }
  if (request.method === "GET" && request.url === "/api/health") {
    return sendJson(response, 200, { status: "ok", agent: "Sumit Portfolio AI" });
  }
  if (request.method === "GET") return serveStatic(request, response);

  response.writeHead(405, { Allow: "GET, POST" });
  response.end("Method not allowed");
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Portfolio and AI agent running at http://127.0.0.1:${config.port}`);
});
