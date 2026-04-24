import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

import { env } from "~/env";

export const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
});

export const chatModel = () => openai(env.RAG_CHAT_MODEL);
export const embeddingModel = () => openai.embedding(env.RAG_EMBEDDING_MODEL);
