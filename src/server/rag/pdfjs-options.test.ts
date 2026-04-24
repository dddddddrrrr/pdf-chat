import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { pdfjsDocumentOptions } from "./pdfjs-options";

describe("pdfjsDocumentOptions", () => {
  test("provides local CMap and standard font assets for Node extraction", () => {
    const options = pdfjsDocumentOptions();

    expect(options.cMapUrl).toContain("/cmaps/");
    expect(options.cMapUrl).toBe(join(process.cwd(), "node_modules", "pdfjs-dist", "cmaps") + "/");
    expect(options.cMapUrl).not.toMatch(/^file:/);
    expect(options.cMapPacked).toBe(true);
    expect(options.standardFontDataUrl).toContain("/standard_fonts/");
    expect(options.standardFontDataUrl).not.toMatch(/^file:/);
  });
});
