/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/upload": [
      "./node_modules/pdfjs-dist/cmaps/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
    ],
  },
};

export default config;
