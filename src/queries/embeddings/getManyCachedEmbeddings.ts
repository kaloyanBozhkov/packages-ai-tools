import { join, raw, sqltag } from "@prisma/client/runtime/library";
import { ai_cached_embedding, PrismaLike } from "./type";
import { DEFAULT_SQL_TAGS } from "./constants";

export const getManyCachedEmbeddings = async <
  EmbeddingFeatureType extends string
>({
  texts,
  prisma,
  aiCachedEmbeddingTableName = DEFAULT_SQL_TAGS.tablename,
  aiCachedEmbeddingFeatureTypeEnumName = DEFAULT_SQL_TAGS.featureTypeEnumName,
  featureTypes,
}: {
  texts: string[];
  featureTypes?: EmbeddingFeatureType[];
  prisma: PrismaLike;
  aiCachedEmbeddingTableName?: string;
  aiCachedEmbeddingFeatureTypeEnumName?: string;
}) => {
  const embeddings = await prisma.$queryRaw<ai_cached_embedding[]>(
    sqltag`
      SELECT id, text, created_at, updated_at, feature_type, embedding::text FROM ${raw(
        aiCachedEmbeddingTableName
      )} 
      WHERE text IN (${join(texts)})
      ${
        featureTypes
          ? ` AND feature_type = ARRAY[${featureTypes.join(
              ", "
            )}]::${aiCachedEmbeddingFeatureTypeEnumName}[]`
          : ""
      }
    `
  );

  return embeddings.map((embedding) => ({
    ...embedding,
    embedding: JSON.parse(embedding.embedding as unknown as string) as number[],
  }));
};
