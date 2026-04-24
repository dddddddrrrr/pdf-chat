import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatModel: vi.fn(() => "mock-chat-model"),
  convertToModelMessages: vi.fn(async (messages: unknown) => messages),
  retrieve: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...(actual as object),
    convertToModelMessages: mocks.convertToModelMessages,
    streamText: mocks.streamText,
  };
});

vi.mock("~/server/rag/openai", () => ({
  chatModel: mocks.chatModel,
}));

vi.mock("~/server/rag/retrieve", () => ({
  retrieve: mocks.retrieve,
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function userMessage(text: string) {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text }],
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    mocks.retrieve.mockResolvedValue([]);
    mocks.streamText.mockReturnValue({
      text: Promise.resolve("默认回答"),
      toUIMessageStreamResponse: () => new Response("unused"),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects chat requests without scoped document ids", async () => {
    const { POST } = await import("./route");

    const res = await POST(
      jsonRequest({
        messages: [userMessage("腾讯 2025 年收入是多少？")],
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("documentIds");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("passes scoped document ids into retrieval", async () => {
    const { POST } = await import("./route");

    await POST(
      jsonRequest({
        messages: [userMessage("腾讯 2025 年收入是多少？")],
        documentIds: ["doc-a", "doc-b"],
      }),
    );

    expect(mocks.retrieve).toHaveBeenCalledWith("腾讯 2025 年收入是多少？", {
      documentIds: ["doc-a", "doc-b"],
    });
  });

  it("adds deterministic citation output when the model omits page citations", async () => {
    mocks.retrieve.mockResolvedValue([
      {
        documentId: "doc-a",
        documentName: "腾讯2025年度报告.pdf",
        pageNumber: 10,
        chunkIndex: 0,
        text: "腾讯 2025 年收入为人民币 123 元。",
        score: 0.92,
      },
      {
        documentId: "doc-a",
        documentName: "腾讯2025年度报告.pdf",
        pageNumber: 12,
        chunkIndex: 1,
        text: "收入相关补充说明。",
        score: 0.8,
      },
    ]);
    mocks.streamText.mockReturnValue({
      text: Promise.resolve("腾讯 2025 年收入为人民币 123 元。"),
      toUIMessageStreamResponse: () => new Response("uncited model output"),
    });
    const { POST } = await import("./route");

    const res = await POST(
      jsonRequest({
        messages: [userMessage("腾讯 2025 年收入是多少？")],
        documentIds: ["doc-a"],
      }),
    );

    const body = await res.text();
    expect(body).toContain("[p.10][p.12]");
    expect(body).toContain("data-citations");
  });
});
