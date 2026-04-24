"use client";

import { api } from "~/trpc/react";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatCallNumber(i: number): string {
  return `№${String(i + 1).padStart(3, "0")}`;
}

function StatusDot({ status }: { status: string }) {
  const meta =
    status === "ready"
      ? { color: "bg-amber", label: "就绪", pulse: false }
      : status === "error"
        ? { color: "bg-oxidized", label: "失败", pulse: false }
        : { color: "bg-patina", label: "处理中", pulse: true };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`block h-1.5 w-1.5 rounded-full ${meta.color} ${
          meta.pulse ? "anim-patina" : ""
        }`}
      />
      <span className="text-ink-muted font-mono text-[10px] tracking-wider">
        {meta.label}
      </span>
    </span>
  );
}

export function DocumentList() {
  const utils = api.useUtils();
  const list = api.documents.list.useQuery(undefined, {
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      return data.some((d) => d.status === "processing") ? 2000 : false;
    },
  });
  const del = api.documents.delete.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  });

  const docs = list.data ?? [];

  if (list.isLoading) {
    return <p className="text-ink-subtle font-sans text-xs">加载中…</p>;
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-ink-subtle font-sans text-sm leading-relaxed">
          暂无文档
        </p>
        <p className="text-ink-faint font-sans text-xs">
          上传 PDF 开始提问。
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {docs.map((d, i) => {
        const accent =
          d.status === "ready"
            ? "bg-amber"
            : d.status === "error"
              ? "bg-oxidized"
              : "bg-patina anim-patina";

        return (
          <li
            key={d.id}
            className="group border-rule hover:bg-paper-sunken/50 relative border-b py-3.5 pr-2 pl-4 transition-colors"
          >
            <span
              className={`absolute top-3 bottom-3 left-0 w-[2px] ${accent}`}
            />

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-faint font-mono text-[10px] tabular-nums">
                {formatCallNumber(i)}
              </span>
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => del.mutate({ id: d.id })}
                className="text-ink-faint hover:text-vermillion font-mono text-xs opacity-0 transition-colors transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                aria-label={`删除 ${d.name}`}
                title="删除"
              >
                ×
              </button>
            </div>

            <p
              className="text-ink mt-0.5 truncate font-serif text-[15px] leading-tight"
              title={d.name}
            >
              {d.name}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusDot status={d.status} />
              {d.status === "ready" && (
                <span className="text-ink-subtle font-mono text-[10px] tabular-nums">
                  {d.totalPages}&nbsp;页 · {formatBytes(d.byteSize)}
                </span>
              )}
              {d.status === "error" && d.errorMessage && (
                <span
                  className="text-oxidized truncate font-sans text-[11px]"
                  title={d.errorMessage}
                >
                  {d.errorMessage}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
