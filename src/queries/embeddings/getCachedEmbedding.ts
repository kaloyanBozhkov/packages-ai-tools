import { raw, sqltag } from "@prisma/client/runtime/library";
import { ai_cached_embedding, PrismaLike } from "./type";

export const getCachedEmbedding = async ({
  text,
  prisma,
  aiCachedEmbeddingTableName = "ai_cached_embedding",
}: {
  text: string;
  aiCachedEmbeddingTableName?: string;
  prisma: PrismaLike;
}) => {
  const embeddings = await prisma.$queryRaw<ai_cached_embedding[]>(
    sqltag`
    SELECT id, text, created_at, updated_at, feature_type, embedding::text FROM ${raw(
      aiCachedEmbeddingTableName
    )} 
    WHERE text = ${text} 
    LIMIT 1
  `
  );

  if (!embeddings || embeddings.length === 0) {
    return null;
  }

  return {
    ...embeddings[0],
    embedding: JSON.parse(
      embeddings[0].embedding as unknown as string
    ) as number[],
  };
};
