import { ai_cached_embedding, PrismaLike } from "./type";
import { DEFAULT_SQL_TAGS } from "./constants";
import { enquote, formatSqlString, joinArrayItems } from "../sql";

export const getCachedEmbedding = async <EmbeddingFeatureType extends string>({
  text,
  prisma,
  aiCachedEmbeddingTableName = DEFAULT_SQL_TAGS.tablename,
  aiCachedEmbeddingFeatureTypeEnumName = DEFAULT_SQL_TAGS.featureTypeEnumName,
  featureTypes,
}: {
  text: string;
  aiCachedEmbeddingTableName?: string;
  prisma: PrismaLike;
  aiCachedEmbeddingFeatureTypeEnumName?: string;
  featureTypes: EmbeddingFeatureType[];
}) => {
  const sql =
    formatSqlString(`SELECT id, text, created_at, updated_at, feature_type, embedding::text FROM ${
      aiCachedEmbeddingTableName
    } 
    WHERE text = ${enquote(text)}
    ${
      featureTypes && featureTypes.length > 0
        ? ` AND feature_type && ARRAY[${joinArrayItems(featureTypes)}]::${aiCachedEmbeddingFeatureTypeEnumName}[]`
        : ""
    }
    LIMIT 1`);

  const embeddings = await prisma.$queryRawUnsafe<ai_cached_embedding[]>(sql);

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
