import { ai_cached_embedding, PrismaLike } from "./type";
import { DEFAULT_SQL_TAGS } from "./constants";
import { formatSqlString, joinArrayItems } from "../sql";

export const getManyCachedEmbeddings = async <
  EmbeddingFeatureType extends string,
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
  const sql =
    formatSqlString(`SELECT id, text, created_at, updated_at, feature_type, embedding::text FROM ${aiCachedEmbeddingTableName} 
  WHERE text IN (${joinArrayItems(texts)})
  ${
    featureTypes && featureTypes.length > 0
      ? ` AND feature_type && ARRAY[${joinArrayItems(featureTypes)}]::${aiCachedEmbeddingFeatureTypeEnumName}[]`
      : ""
  }`);

  const embeddings = await prisma.$queryRawUnsafe<ai_cached_embedding[]>(sql);

  return embeddings.map((embedding) => ({
    ...embedding,
    embedding: JSON.parse(embedding.embedding as unknown as string) as number[],
  }));
};
