"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "~/trpc/react";

import { DocumentList } from "./document-list";
import { UploadPanel } from "./upload-panel";

export function MobileShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const list = api.documents.list.useQuery();
  const count = list.data?.length ?? 0;

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) triggerRef.current?.focus({ preventScroll: true });
  }, [drawerOpen]);

  return (
    <div className="bg-paper text-ink flex h-[100dvh] flex-col md:flex-row">
      <header className="border-rule bg-paper-raised flex items-center justify-between border-b px-5 py-3 md:hidden">
        <h1 className="font-serif text-lg leading-none tracking-tight">
          PDF Chat
        </h1>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          className="text-ink-muted hover:text-amber border-rule border-b border-dotted font-mono text-[11px] tracking-wider uppercase transition-colors"
        >
          {count} 份文档 · <span className="text-amber">展开</span>
        </button>
      </header>

      {children}

      {drawerOpen && (
        <div
          className="anim-fade-in fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="文档"
          id="mobile-drawer"
        >
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setDrawerOpen(false)}
            className="bg-paper/80 absolute inset-0 backdrop-blur-sm"
          />
          <div className="border-rule bg-paper-raised anim-sheet-rise absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t px-6 pt-6 pb-8">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">文档</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-ink-muted hover:text-vermillion font-mono text-xs transition-colors"
              >
                关闭
              </button>
            </div>
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h3 className="text-ink-muted font-sans text-[10px] font-semibold tracking-[0.22em] uppercase">
                  上传
                </h3>
                <UploadPanel />
              </section>
              <div className="rule-hair" />
              <section className="flex flex-col gap-3">
                <h3 className="text-ink-muted font-sans text-[10px] font-semibold tracking-[0.22em] uppercase">
                  文档
                </h3>
                <DocumentList />
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
