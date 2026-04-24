"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { api } from "~/trpc/react";

import { CitationText } from "./citation";
import { getChatInputState } from "./chat-panel-state";

function subscribeToHydration() {
  return () => undefined;
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const hasMounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { messages, sendMessage, status, error } = useChat();
  const documents = api.documents.list.useQuery(undefined, {
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      return data.some((d) => d.status === "processing") ? 2000 : false;
    },
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";
  const readyDocumentIds =
    documents.data?.filter((d) => d.status === "ready").map((d) => d.id) ?? [];
  const hasReadyDocuments = readyDocumentIds.length > 0;
  const inputState = getChatInputState({
    hasMounted,
    hasReadyDocuments,
    input,
    isStreaming,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming || !inputState.canChat) return;
    void sendMessage({ text }, { body: { documentIds: readyDocumentIds } });
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[72ch] flex-col gap-6 px-6 py-10 md:px-10">
          {messages.length === 0 && (
            <div className="anim-fade-in max-w-[56ch]">
              <h2 className="text-ink mb-3 font-serif text-[1.55rem] leading-snug">
                基于已上传的 PDF 回答问题
              </h2>
              <p className="text-ink-muted font-sans text-[15px] leading-relaxed">
                页码标注形如 <span className="citation-ref">p.5</span>
                。如果文档中没有相关内容，回答会是「未提及」。
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="border-oxidized border-l-2 py-2 pl-4">
              <p className="text-oxidized mb-1 font-mono text-[10px] tracking-widest uppercase">
                错误
              </p>
              <p className="text-ink-muted font-sans text-sm">
                {error.message}
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`anim-msg-enter ${
                m.role === "user" ? "max-w-[85%] self-end" : "w-full self-start"
              }`}
            >
              {m.role === "user" ? (
                <div className="border-vermillion border-l-2 py-0.5 pl-4">
                  <div className="text-ink font-serif text-[17px] leading-relaxed whitespace-pre-wrap">
                    {m.parts.map((p, i) =>
                      p.type === "text" ? <span key={i}>{p.text}</span> : null,
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-ink font-sans text-[15px] leading-[1.75] whitespace-pre-wrap">
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      <CitationText key={i} text={p.text} />
                    ) : null,
                  )}
                </div>
              )}
            </div>
          ))}

          {isStreaming && (
            <div className="anim-fade-in flex items-center gap-3">
              <div className="bg-paper-sunken relative h-[2px] w-32 overflow-hidden rounded-full">
                <span className="bg-amber anim-scan absolute inset-y-0 left-0 w-1/3" />
              </div>
              <p className="text-ink-subtle font-sans text-xs">生成中</p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-rule bg-paper border-t">
        <div className="mx-auto w-full max-w-[72ch] px-6 py-5 md:px-10">
          <div className="border-rule focus-within:border-amber flex items-end gap-4 border-b pb-3 transition-colors duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              rows={2}
              placeholder={inputState.placeholder}
              className="text-ink placeholder:text-ink-subtle flex-1 resize-none bg-transparent font-sans text-[15px] leading-relaxed placeholder:font-sans focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={inputState.textareaDisabled}
              aria-label="输入你的问题"
            />
            <button
              type="submit"
              disabled={inputState.submitDisabled}
              className="group text-ink-muted hover:text-amber disabled:text-ink-faint self-end pb-1 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors duration-150 disabled:cursor-not-allowed"
            >
              <span className="group-hover:border-amber group-focus-visible:border-amber border-b border-transparent transition-colors">
                发送
              </span>
              <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </button>
          </div>
          <p className="text-ink-faint mt-2 font-mono text-[10px] tracking-wider">
            回车发送 · Shift+回车换行
          </p>
        </div>
      </form>
    </div>
  );
}
