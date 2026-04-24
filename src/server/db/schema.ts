import { sql } from "drizzle-orm";
import { index, sqliteTableCreator } from "drizzle-orm/sqlite-core";

export const createTable = sqliteTableCreator((name) => `pdf-chat_${name}`);

export const documents = createTable("document", (d) => ({
  id: d.text().primaryKey(),
  name: d.text({ length: 256 }).notNull(),
  totalPages: d.integer().notNull().default(0),
  byteSize: d.integer().notNull().default(0),
  status: d.text().notNull().default("processing"),
  errorMessage: d.text(),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}));

export const chunks = createTable(
  "chunk",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    documentId: d
      .text()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: d.integer().notNull(),
    chunkIndex: d.integer().notNull(),
    text: d.text().notNull(),
    embedding: d.blob({ mode: "buffer" }).notNull(),
  }),
  (t) => [index("chunks_doc_idx").on(t.documentId)],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
