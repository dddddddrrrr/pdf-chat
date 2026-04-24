"use client";

import { useRef, useState } from "react";

import { api } from "~/trpc/react";

type Phase = "idle" | "transferring" | "reading" | "embedding" | "filing";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  transferring: "上传中",
  reading: "解析中",
  embedding: "生成索引",
  filing: "即将完成",
};

export function UploadPanel() {
  const utils = api.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);

  const busy = phase !== "idle";

  async function handleFile(file: File) {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("仅支持 PDF 文件");
      return;
    }
    setError(null);
    setCurrentName(file.name);
    setPhase("transferring");

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `上传失败（${res.status}）`);
      }
      setPhase("reading");
      await new Promise((r) => setTimeout(r, 420));
      setPhase("embedding");
      await utils.documents.list.invalidate();
      setPhase("filing");
      await new Promise((r) => setTimeout(r, 320));
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setPhase("idle");
      setCurrentName(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!busy) setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const accentBar = dragActive
    ? "bg-amber"
    : busy
      ? "bg-patina anim-patina"
      : "bg-rule group-hover:bg-amber";

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-busy={busy}
        aria-label="上传 PDF"
        className={`group border-rule relative cursor-pointer overflow-hidden border-t border-b px-5 py-6 transition-colors duration-200 select-none ${
          dragActive
            ? "bg-amber-wash border-amber"
            : "hover:bg-paper-sunken/50"
        } ${busy ? "cursor-wait opacity-95" : ""}`}
      >
        <span
          className={`absolute top-0 left-0 h-full w-[2px] transition-colors duration-200 ${accentBar}`}
        />

        {!busy && (
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="font-serif text-ink text-base leading-tight">
                {dragActive ? "松开上传" : "选择或拖入 PDF"}
              </p>
              <p className="text-ink-muted mt-1 font-sans text-xs">
                {dragActive ? "释放文件" : "点击此处或拖拽文件到这里"}
              </p>
            </div>
            <span className="text-ink-faint shrink-0 font-mono text-[10px] tracking-widest uppercase">
              pdf
            </span>
          </div>
        )}

        {busy && (
          <div className="flex flex-col gap-2">
            <p className="font-serif text-ink text-sm">
              {PHASE_LABEL[phase]}…
            </p>
            {currentName && (
              <p className="text-ink-muted truncate font-mono text-[11px]">
                {currentName}
              </p>
            )}
            <div className="bg-paper-sunken relative mt-1 h-[2px] overflow-hidden rounded-full">
              <span className="bg-amber anim-scan absolute inset-y-0 left-0 w-1/3" />
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {error && (
        <p
          role="alert"
          className="border-oxidized text-oxidized border-l-2 pt-1 pl-3 font-sans text-xs"
        >
          {error}
        </p>
      )}
    </div>
  );
}
