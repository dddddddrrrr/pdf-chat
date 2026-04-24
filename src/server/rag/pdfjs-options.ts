import { join, sep } from "node:path";

export interface PdfjsDocumentOptions {
  cMapPacked: boolean;
  cMapUrl: string;
  standardFontDataUrl: string;
}

function pdfjsAssetUrl(assetDir: "cmaps" | "standard_fonts"): string {
  return `${join(process.cwd(), "node_modules", "pdfjs-dist", assetDir)}${sep}`;
}

export function pdfjsDocumentOptions(): PdfjsDocumentOptions {
  return {
    cMapPacked: true,
    cMapUrl: pdfjsAssetUrl("cmaps"),
    standardFontDataUrl: pdfjsAssetUrl("standard_fonts"),
  };
}
