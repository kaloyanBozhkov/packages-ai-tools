# How to use embeddings helpers
Your prisma schema needs at leas these tables:

enum embedding_feature_type {
    // e.g  FACT
    // e.g. SEARCH_QUERY
}

model ai_cached_embedding {
    id         String   @id @default(cuid())
    created_at DateTime @default(now())
    updated_at DateTime @default(now()) @updatedAt

    embedding    Unsupported("vector(512)")
    text         String                     @unique
    feature_type embedding_feature_type[]   @default([]) // use this to filter by feature first

    // optional relationships e.g. ai_embedding_search_diagnostics ai_embedding_search_diagnostic[]

    @@index([feature_type])
}

# Enviornment reqs
- PGVector on postgres
- prisma

