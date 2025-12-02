import { raw, sqltag } from "@prisma/client/runtime/library";
import { ai_cached_embedding, PrismaLike } from "./type";
import { DEFAULT_SQL_TAGS } from "./constants";

export const getCachedEmbedding = async ({
  text,
  prisma,
  aiCachedEmbeddingTableName = DEFAULT_SQL_TAGS.tablename,
  aiCachedEmbeddingFeatureTypeEnumName = DEFAULT_SQL_TAGS.featureTypeEnumName,
}: {
  text: string;
  aiCachedEmbeddingTableName?: string;
  prisma: PrismaLike;
  aiCachedEmbeddingFeatureTypeEnumName?: string;
}) => {
  const embeddings = await prisma.$queryRaw<ai_cached_embedding[]>(
    sqltag`
    SELECT id, text, created_at, updated_at, feature_type, embedding::text FROM ${raw(
      aiCachedEmbeddingTableName
    )} 
    WHERE text = ${text}
    ${
      aiCachedEmbeddingFeatureTypeEnumName
        ? ` AND feature_type = ${aiCachedEmbeddingFeatureTypeEnumName} `
        : ""
    }
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
