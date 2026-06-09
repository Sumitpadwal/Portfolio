import { LocalIndex } from "vectra";
import { config } from "./config.js";

function getIndex() {
  return new LocalIndex(config.vectorDir);
}

export async function saveIndex(records) {
  const index = getIndex();
  if (await index.isIndexCreated()) await index.deleteIndex();
  await index.createIndex({
    version: 1,
    metadata_config: { indexed: ["source", "model"] }
  });

  await index.batchInsertItems(
    records.map(({ id, source, text, vector }) => ({
      id,
      vector,
      metadata: {
        source,
        text,
        model: config.embeddingModel
      }
    }))
  );
}

export async function queryIndex(vector, question, topK) {
  const index = getIndex();
  if (!(await index.isIndexCreated())) {
    throw new Error("Vector index not found. Run `npm run ingest` first.");
  }

  const stats = await index.getIndexStats();
  if (!stats.items) {
    throw new Error("Vector index is empty. Run `npm run ingest` first.");
  }

  const results = await index.queryItems(
    vector,
    "",
    topK,
    { model: { $eq: config.embeddingModel } },
    false
  );

  return results.map(({ item, score }) => ({
    id: item.id,
    source: String(item.metadata.source),
    text: String(item.metadata.text),
    score
  }));
}
