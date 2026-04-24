const READY_PLACEHOLDER = "输入你的问题…";
const NOT_READY_PLACEHOLDER = "请先上传 PDF";

export interface ChatInputStateInput {
  hasMounted: boolean;
  hasReadyDocuments: boolean;
  input: string;
  isStreaming: boolean;
}

export interface ChatInputState {
  canChat: boolean;
  placeholder: string;
  submitDisabled: boolean;
  textareaDisabled: boolean;
}

export function getChatInputState({
  hasMounted,
  hasReadyDocuments,
  input,
  isStreaming,
}: ChatInputStateInput): ChatInputState {
  const canChat = hasMounted && hasReadyDocuments;

  return {
    canChat,
    placeholder: canChat ? READY_PLACEHOLDER : NOT_READY_PLACEHOLDER,
    submitDisabled: !input.trim() || isStreaming || !canChat,
    textareaDisabled: isStreaming || !canChat,
  };
}
