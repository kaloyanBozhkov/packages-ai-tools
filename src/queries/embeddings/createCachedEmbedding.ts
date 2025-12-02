import { createId } from "@paralleldrive/cuid2";
import { vectorize, enquote } from "../sql";
import { raw, sqltag } from "@prisma/client/runtime/library";
import { ai_cached_embedding, PrismaLike } from "./type";
import { DEFAULT_SQL_TAGS } from "./constants";

export const createCachedEmbedding = async <
  EmbeddingFeatureType extends string
>({
  prisma,
  text,
  embedding,
  featureTypes,
  aiCachedEmbeddingTableName = DEFAULT_SQL_TAGS.tablename,
  aiCachedEmbeddingFeatureTypeEnumName = DEFAULT_SQL_TAGS.featureTypeEnumName,
}: {
  prisma: PrismaLike;
  text: string;
  embedding: number[];
  featureTypes: EmbeddingFeatureType[];
  aiCachedEmbeddingTableName?: string;
  aiCachedEmbeddingFeatureTypeEnumName?: string;
}) => {
  const createdEmbedding = await prisma.$queryRaw<ai_cached_embedding[]>(sqltag`
    INSERT INTO ${raw(
      aiCachedEmbeddingTableName
    )} (id, text, embedding, feature_type)
    VALUES (${enquote(createId())}, ${enquote(text)}, ${vectorize(
    embedding
  )}, ARRAY[${featureTypes.join(
    ", "
  )}]::${aiCachedEmbeddingFeatureTypeEnumName}[])
    RETURNING id, text, created_at, updated_at
  `);

  return {
    ...createdEmbedding[0],
    embedding,
  };
};
