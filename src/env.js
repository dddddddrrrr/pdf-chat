import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_BASE_URL: z.string().url().optional(),
    RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
    RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
    RAG_CHAT_MODEL: z.string().default("gpt-4o-mini"),
    RAG_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    UPLOAD_DIR: z.string().default("./data/uploads"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    RAG_TOP_K: process.env.RAG_TOP_K,
    RAG_SIMILARITY_THRESHOLD: process.env.RAG_SIMILARITY_THRESHOLD,
    RAG_CHAT_MODEL: process.env.RAG_CHAT_MODEL,
    RAG_EMBEDDING_MODEL: process.env.RAG_EMBEDDING_MODEL,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
