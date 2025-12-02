import { sqltag } from "@prisma/client/runtime/library";

// must have prisma table implementing these
export type ai_cached_embedding = {
  id: string;
  text: string;
  created_at: Date;
  updated_at: Date;
  embedding: number[];
  feature_type: string[];
};

export type PrismaLike = {
  $queryRaw<T>(
    query: TemplateStringsArray | ReturnType<typeof sqltag>,
    ...values: unknown[]
  ): Promise<T>;
};
