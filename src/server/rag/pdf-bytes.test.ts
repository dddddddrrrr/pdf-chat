import { describe, expect, test } from "vitest";

import { splitPdfBytes } from "./pdf-bytes";

describe("splitPdfBytes", () => {
  test("returns independent copies for ingest and storage", () => {
    const input = new Uint8Array([1, 2, 3, 4]);

    const { ingestBytes, storageBytes } = splitPdfBytes(input);

    ingestBytes[0] = 9;
    expect(storageBytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(ingestBytes.buffer).not.toBe(storageBytes.buffer);
  });
});
