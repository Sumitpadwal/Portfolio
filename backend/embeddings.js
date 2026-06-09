import { env, pipeline } from "@huggingface/transformers";
import { config } from "./config.js";

env.cacheDir = config.modelCacheDir;
env.allowRemoteModels = true;

let extractorPromise;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", config.embeddingModel, {
      dtype: "q8"
    });
  }
  return extractorPromise;
}

export async function embedTexts(texts) {
  const extractor = await getExtractor();
  const vectors = [];

  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    vectors.push(Array.from(output.data));
  }

  return vectors;
}
