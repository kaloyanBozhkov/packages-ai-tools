import { createId } from "@paralleldrive/cuid2";
import { vectorize, enquote, formatSqlString, joinArrayItems } from "../sql";
import { ai_cached_embedding, PrismaLike } from "./type";
import { DEFAULT_SQL_TAGS } from "./constants";

export const createCachedEmbedding = async <
  EmbeddingFeatureType extends string,
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
  const sql = formatSqlString(`INSERT INTO ${
    aiCachedEmbeddingTableName
  } (id, text, embedding, feature_type)
    VALUES (${enquote(createId())}, ${enquote(text)}, ${vectorize(
      embedding
    )}, ARRAY[${joinArrayItems(featureTypes)}]::${aiCachedEmbeddingFeatureTypeEnumName}[])
    RETURNING id, text, created_at, updated_at`);

  const createdEmbedding =
    await prisma.$queryRawUnsafe<ai_cached_embedding[]>(sql);

  return {
    ...createdEmbedding[0],
    embedding,
  };
};
