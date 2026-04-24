"use client";

import React from "react";

const CITATION_PATTERN = /\[p\.(\d+(?:\s*,\s*\d+)*)\]/g;

interface CitationProps {
  pages: number[];
}

function CitationChip({ pages }: CitationProps) {
  const label =
    pages.length === 1 ? `p.${pages[0]}` : `pp. ${pages.join(", ")}`;
  const title =
    pages.length === 1 ? `页 ${pages[0]}` : `页 ${pages.join(", ")}`;
  return (
    <span className="citation-ref" title={title} role="note">
      {label}
    </span>
  );
}

/**
 * Renders text containing [p.NN] markers (or [p.NN,MM]) as inline
 * footnote-styled references.
 */
export function CitationText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) out.push(text.slice(lastIndex, idx));
    const pages = match[1]!
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    out.push(<CitationChip key={`c-${key++}`} pages={pages} />);
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return <>{out}</>;
}
