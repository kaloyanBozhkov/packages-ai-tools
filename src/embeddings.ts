import { getOpenAISFWInstance } from "./openai";
import { AI_EMBEDDINGS_DIMENSIONS, OpenAIEmbeddingsModel } from "./constants";
import { getCachedEmbedding } from "./queries/embeddings/getCachedEmbedding";
import { createCachedEmbedding } from "./queries/embeddings/createCachedEmbedding";
import { getManyCachedEmbeddings } from "./queries/embeddings/getManyCachedEmbeddings";
import { vectorize } from "./queries/sql";
import { PrismaLike } from "./queries/embeddings/type";

export const generateVectorEmbeddings = async (
  text: string,
  {
    model = OpenAIEmbeddingsModel.TEXT_EMBEDDING_3_SMALL,
  }: { model?: OpenAIEmbeddingsModel } = {}
) => {
  const result = await getOpenAISFWInstance().embeddings.create({
    model,
    input: text,
    dimensions: AI_EMBEDDINGS_DIMENSIONS,
  });

  return result;
};

export type TextEmbedding = {
  text: string;
  embedding: number[];
  isFresh: boolean; // was it pulled from cache or freshly generated?
  cachedEmbeddingId: string;
};

export async function getEmbeddings<EmbeddingFeatureType extends string>({
  text,
  prisma,
  featureType = "FACT" as EmbeddingFeatureType,
}: {
  text: string;
  featureType?: EmbeddingFeatureType;
  prisma: PrismaLike;
}): Promise<TextEmbedding> {
  const existingEmbedding = await getCachedEmbedding({ text, prisma }); // TODO figure out if it matters what type the embedding is for use cases using existing embeddings
  if (existingEmbedding) {
    return formatEmbeddings([existingEmbedding], false)[0];
  }

  const result = await generateVectorEmbeddings(text);
  const embedding = result.data[0].embedding;
  const cachedEmbedding = await createCachedEmbedding<EmbeddingFeatureType>({
    text,
    embedding,
    featureTypes: [featureType],
    prisma,
  });
  return formatEmbeddings([cachedEmbedding], true)[0];
}

export async function getManyEmbeddings<EmbeddingFeatureType extends string>({
  texts,
  featureType,
  prisma,
}: {
  texts: string[];
  featureType: EmbeddingFeatureType;
  prisma: PrismaLike;
}) {
  const existingEmbeddings = await getManyCachedEmbeddings({ texts, prisma });
  const textsToEmbed = texts.filter((text) => {
    const existingEmbedding = existingEmbeddings.find(
      (embedding) => embedding.text === text
    );
    return !existingEmbedding;
  });

  const newEmbeddings: Awaited<ReturnType<typeof getManyCachedEmbeddings>> = [];
  for (const text of textsToEmbed) {
    const result = await generateVectorEmbeddings(text);
    const embedding = result.data[0].embedding;
    const cachedEmbedding = await createCachedEmbedding<EmbeddingFeatureType>({
      text,
      embedding,
      featureTypes: [featureType],
      prisma,
    });
    newEmbeddings.push(cachedEmbedding);
  }

  return sortEmbeddings(
    [
      ...formatEmbeddings(newEmbeddings, true),
      ...formatEmbeddings(existingEmbeddings, false),
    ],
    texts
  );
}

// ensure the embeddings are sorted by the order of the texts, assists when these are used for e.g. search results
const sortEmbeddings = (embeddings: TextEmbedding[], texts: string[]) =>
  embeddings.sort((a, b) => texts.indexOf(a.text) - texts.indexOf(b.text));

const formatEmbeddings = (
  rawEmbeddings: Array<{
    id: string;
    embedding: number[];
    text: string;
  }>,
  isFresh = false
): TextEmbedding[] =>
  rawEmbeddings.map((e) => ({
    embedding: e.embedding,
    text: e.text,
    isFresh,
    cachedEmbeddingId: e.id,
  }));

const isVectorBoolean = (vector: number[]) => {
  return !vector.some((value) => value !== 0 && value !== 1);
};

export const assertMinSimilarityRange = (minSimilarity: number) => {
  if (
    !Number.isFinite(minSimilarity) ||
    minSimilarity < 0 ||
    minSimilarity > 1
  ) {
    throw new RangeError(
      `assertMinSimilarityRange must be between 0 and 1, got ${minSimilarity}`
    );
  }
};

export enum VectorSimilarityType {
  COSINE = "cosine",
  L1 = "l1",
  L2 = "l2",
  DOT_PRODUCT = "dot_product",
  JACCARD = "jaccard",
  HAMMING = "hamming",
}

/**
 * Cosine similarity → Best for text embeddings, where vector direction matters (e.g., similarity search for facts).
 * L1 (Manhattan) Distance → Useful for cases where magnitude of differences matters (e.g., recommendation systems).
 * Euclidean distance (L2) → Best for measuring actual distance/magnitude (e.g., image comparison).
 * Dot product → Best for normalized vectors, useful in ranking tasks (e.g., document relevance).
 *
 * Below two are good but require float vectors to be converted to binary vectors first
 * Jaccard → Best for set-based similarity (e.g., content tags in search).
 * Hamming → Best for bit-based similarity (e.g., binary vectors).

 * Returns just the similarity expression part (without SELECT) for use in larger queries
 */
export const getSimilarityExpression = ({
  type,
  embedding,
  embeddingColumn,
}: {
  type: VectorSimilarityType;
  embedding: number[];
  embeddingColumn: string;
}): string => {
  const embeddingArray = vectorize(embedding, false);

  switch (type) {
    case VectorSimilarityType.COSINE:
      return `(1 - (${embeddingColumn} <=> ${embeddingArray}))`;
    case VectorSimilarityType.L1:
      return `l1_distance(${embeddingColumn}, ${embeddingArray})`;
    case VectorSimilarityType.L2:
      return `l2_distance(${embeddingColumn}, ${embeddingArray})`;
    case VectorSimilarityType.DOT_PRODUCT:
      return `inner_product(${embeddingColumn}, ${embeddingArray})`;
    case VectorSimilarityType.JACCARD: {
      if (!isVectorBoolean(embedding)) {
        throw new Error("Jaccard distance requires a boolean vector");
      }
      return `jaccard_distance(${embeddingColumn}, ${embeddingArray}::boolean[])`;
    }
    case VectorSimilarityType.HAMMING: {
      if (!isVectorBoolean(embedding)) {
        throw new Error("Hamming distance requires a boolean vector");
      }
      return `hamming_distance(${embeddingColumn}, ${embeddingArray}::boolean[])`;
    }
    default:
      throw new Error(`Unsupported similarity type: ${type}`);
  }
};
