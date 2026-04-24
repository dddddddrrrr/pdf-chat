import { describe, expect, it } from "vitest";

import { bufferToEmbedding, embeddingToBuffer } from "./embedding";

describe("Float32Array <-> Buffer roundtrip", () => {
  it("round-trips a typical embedding without precision loss", () => {
    const original = Array.from({ length: 1536 }, (_, i) => Math.sin(i) * 0.5);
    const buf = embeddingToBuffer(original);
    expect(buf.byteLength).toBe(1536 * 4); // 4 bytes per float32

    const restored = bufferToEmbedding(buf);
    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!, 5);
    }
  });

  it("handles empty embedding", () => {
    const buf = embeddingToBuffer([]);
    expect(buf.byteLength).toBe(0);
    const restored = bufferToEmbedding(buf);
    expect(restored.length).toBe(0);
  });
});
