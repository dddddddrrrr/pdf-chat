import { describe, expect, test } from "vitest";

import config from "../next.config.js";

describe("next standalone tracing", () => {
  test("includes pdf.js runtime font assets for upload extraction", () => {
    expect(config.output).toBe("standalone");
    expect(config.outputFileTracingIncludes?.["/api/upload"]).toEqual(
      expect.arrayContaining([
        "./node_modules/pdfjs-dist/cmaps/**/*",
        "./node_modules/pdfjs-dist/standard_fonts/**/*",
      ]),
    );
  });
});
