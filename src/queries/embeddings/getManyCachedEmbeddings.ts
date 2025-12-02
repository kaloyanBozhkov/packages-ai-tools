import { join, raw, sqltag } from "@prisma/client/runtime/library";
import { ai_cached_embedding, PrismaLike } from "./type";

export const getManyCachedEmbeddings = async ({
  texts,
  prisma,
  aiCachedEmbeddingTableName = "ai_cached_embedding",
}: {
  texts: string[];
  aiCachedEmbeddingTableName?: string;
  prisma: PrismaLike;
}) => {
  const embeddings = await prisma.$queryRaw<ai_cached_embedding[]>(
    sqltag`
      SELECT id, text, created_at, updated_at, feature_type, embedding::text FROM ${raw(
        aiCachedEmbeddingTableName
      )} 
      WHERE text IN (${join(texts)})
    `
  );

  return embeddings.map((embedding) => ({
    ...embedding,
    embedding: JSON.parse(embedding.embedding as unknown as string) as number[],
  }));
};
