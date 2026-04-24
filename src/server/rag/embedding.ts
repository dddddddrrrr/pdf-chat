import "server-only";
import { embed, embedMany } from "ai";

import { embeddingModel } from "./openai";

const BATCH_SIZE = 100;

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
  });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values: slice,
    });
    out.push(...embeddings);
  }
  return out;
}

export function embeddingToBuffer(embedding: number[]): Buffer {
  const f32 = new Float32Array(embedding);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

export function bufferToEmbedding(buf: Buffer): Float32Array {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(ab);
}
