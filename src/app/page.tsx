import { ChatPanel } from "~/app/_components/chat-panel";
import { DocumentList } from "~/app/_components/document-list";
import { MobileShell } from "~/app/_components/mobile-shell";
import { UploadPanel } from "~/app/_components/upload-panel";
import { HydrateClient, api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  void api.documents.list.prefetch();

  return (
    <HydrateClient>
      <MobileShell>
        <aside className="border-rule bg-paper-raised hidden w-[22rem] flex-col gap-8 overflow-y-auto border-r px-8 py-10 md:flex">
          <header className="flex flex-col gap-2">
            <h1 className="text-ink font-serif text-[2.1rem] leading-[1.02] tracking-[-0.02em]">
              PDF Chat
            </h1>
            <p className="text-ink-muted mt-1 font-sans text-sm leading-snug">
              基于 PDF 文档的问答。
            </p>
            <div className="rule-hair mt-4" />
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="text-ink-muted font-sans text-[10px] font-semibold tracking-[0.22em] uppercase">
              上传
            </h2>
            <UploadPanel />
          </section>

          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <h2 className="text-ink-muted font-sans text-[10px] font-semibold tracking-[0.22em] uppercase">
              文档
            </h2>
            <DocumentList />
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <ChatPanel />
        </section>
      </MobileShell>
    </HydrateClient>
  );
}
