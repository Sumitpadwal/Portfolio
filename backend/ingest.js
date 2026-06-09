import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { chunkDocument } from "./chunker.js";
import { embedTexts } from "./embeddings.js";
import { saveIndex } from "./vector-store.js";

const supportedExtensions = new Set([".md", ".txt"]);
const files = fs
  .readdirSync(config.dataDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort();

if (!files.length) {
  throw new Error(`No .md or .txt files found in ${config.dataDir}`);
}

const chunks = files.flatMap((file) => {
  const text = fs.readFileSync(path.join(config.dataDir, file), "utf8");
  return chunkDocument(text, file);
});

console.log(`Embedding ${chunks.length} chunks from ${files.length} files...`);
const vectors = await embedTexts(chunks.map((chunk) => chunk.text));
const records = chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index] }));
await saveIndex(records);
console.log(`Saved local vector index to ${config.vectorFile}`);
