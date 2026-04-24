import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { documents } from "~/server/db/schema";
import { deletePdf } from "~/server/storage";

export const documentsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: documents.id,
        name: documents.name,
        totalPages: documents.totalPages,
        byteSize: documents.byteSize,
        status: documents.status,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .orderBy(desc(documents.createdAt));
  }),

  getStatus: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: documents.id,
          status: documents.status,
          totalPages: documents.totalPages,
          errorMessage: documents.errorMessage,
        })
        .from(documents)
        .where(eq(documents.id, input.id));
      return rows[0] ?? null;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // chunks cascade via FK ON DELETE CASCADE
      await ctx.db.delete(documents).where(eq(documents.id, input.id));
      await deletePdf(input.id);
      return { ok: true as const };
    }),
});
