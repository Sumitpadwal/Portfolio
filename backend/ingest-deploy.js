import fs from "node:fs";
import path from "node:path";
import { chunkDocument } from "./chunker.js";
import { config, rootDir } from "./config.js";

const apiKey = process.env.OPENAI_API_KEY || config.openAiKey;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required to build the deployment vector index.");
}

const supportedExtensions = new Set([".md", ".txt"]);
const files = fs
  .readdirSync(config.dataDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort();

const chunks = files.flatMap((file) => {
  const text = fs.readFileSync(path.join(config.dataDir, file), "utf8");
  return chunkDocument(text, file);
});

const response = await fetch("https://api.openai.com/v1/embeddings", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "text-embedding-3-small",
    dimensions: 384,
    input: chunks.map((chunk) => chunk.text)
  })
});

if (!response.ok) {
  throw new Error(`OpenAI embeddings request failed (${response.status}): ${await response.text()}`);
}

const payload = await response.json();
const records = chunks.map((chunk, index) => ({
  ...chunk,
  vector: payload.data[index].embedding
}));

const outputDir = path.join(rootDir, "deploy_vector_store");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "index.json"),
  JSON.stringify({
    version: 1,
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 384,
    createdAt: new Date().toISOString(),
    records
  })
);

console.log(`Saved ${records.length} deployment vectors to deploy_vector_store/index.json`);
