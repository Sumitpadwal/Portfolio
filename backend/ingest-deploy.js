import fs from "node:fs";
import path from "node:path";
import { config, rootDir } from "./config.js";

const dimensions = 384;

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
    const position = hash % dimensions;
    const sign = hash & 1 ? 1 : -1;
    vector[position] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

const supportedExtensions = new Set([".md", ".txt"]);
const files = fs
  .readdirSync(config.dataDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort();

function sectionRecords(text, source) {
  const normalized = text.replace(/\r/g, "").trim();
  const sections = normalized
    .split(/(?=^##\s+)/m)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section, index) => ({
    id: `${source}-${index + 1}`,
    source,
    text: section
  }));
}

const chunks = files.flatMap((file) => {
  const text = fs.readFileSync(path.join(config.dataDir, file), "utf8");
  return sectionRecords(text, file);
});

const records = chunks.map((chunk) => ({
  ...chunk,
  vector: embedText(chunk.text)
}));

const outputDir = path.join(rootDir, "deploy_vector_store");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "index.json"),
  JSON.stringify({
    version: 2,
    provider: "local-feature-hashing",
    model: "fnv1a-word-bigram",
    dimensions,
    createdAt: new Date().toISOString(),
    records
  })
);

console.log(`Saved ${records.length} keyless deployment vectors to deploy_vector_store/index.json`);
