const DEFAULT_CHUNK_WORDS = 150;
const DEFAULT_OVERLAP_WORDS = 30;

export function chunkDocument(text, source, maxWords = DEFAULT_CHUNK_WORDS) {
  const cleaned = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  const sections = cleaned.split(/\n{2,}/).filter(Boolean);
  const chunks = [];
  let buffer = [];
  let bufferWordCount = 0;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join("\n\n").trim();
    chunks.push({
      id: `${source}-${chunks.length + 1}`,
      source,
      text
    });
    const overlap = text.split(/\s+/).slice(-DEFAULT_OVERLAP_WORDS);
    buffer = overlap.length ? [overlap.join(" ")] : [];
    bufferWordCount = overlap.length;
  };

  for (const section of sections) {
    const words = section.split(/\s+/);
    if (buffer.length && bufferWordCount + words.length > maxWords) flush();

    if (words.length > maxWords) {
      for (let i = 0; i < words.length; i += maxWords - DEFAULT_OVERLAP_WORDS) {
        chunks.push({
          id: `${source}-${chunks.length + 1}`,
          source,
          text: words.slice(i, i + maxWords).join(" ")
        });
      }
      buffer = [];
      bufferWordCount = 0;
    } else {
      buffer.push(section);
      bufferWordCount += words.length;
    }
  }

  if (buffer.length) {
    chunks.push({
      id: `${source}-${chunks.length + 1}`,
      source,
      text: buffer.join("\n\n").trim()
    });
  }

  return chunks;
}
