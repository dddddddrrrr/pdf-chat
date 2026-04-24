import { describe, expect, test } from "vitest";

import { getChatInputState } from "./chat-panel-state";

describe("getChatInputState", () => {
  test("keeps server and first client render stable before mount", () => {
    const state = getChatInputState({
      hasMounted: false,
      hasReadyDocuments: true,
      input: "",
      isStreaming: false,
    });

    expect(state.placeholder).toBe("请先上传 PDF");
    expect(state.textareaDisabled).toBe(true);
    expect(state.submitDisabled).toBe(true);
    expect(state.canChat).toBe(false);
  });

  test("enables chat after mount when a ready document exists", () => {
    const state = getChatInputState({
      hasMounted: true,
      hasReadyDocuments: true,
      input: "hello",
      isStreaming: false,
    });

    expect(state.placeholder).toContain("输入你的问题");
    expect(state.textareaDisabled).toBe(false);
    expect(state.submitDisabled).toBe(false);
    expect(state.canChat).toBe(true);
  });
});
