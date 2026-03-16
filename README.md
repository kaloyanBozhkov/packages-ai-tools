# @koko420/ai-tools

AI utilities for LLM responses, embeddings, audio transcription, query expansion, and locale translation.

## Installation

```bash
pnpm add @koko420/ai-tools
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPEN_AI_API_KEY` | Optional (warns if missing) | OpenAI API key |
| `OPENROUTER_API_KEY` | Optional (warns if missing) | OpenRouter API key |

## Exported Modules

### `getLLMResponse`

Call OpenAI (default `gpt-4o`) with a system/user message and Zod schema for structured output.

```ts
import { getLLMResponse } from '@koko420/ai-tools';

const result = await getLLMResponse({
  userMessage: 'Summarize this text...',
  systemMessage: 'You are a helpful assistant.',
  schema: MyZodSchema,
});
```

### `getOpenRouterLLMResponse`

Call OpenRouter with system/user messages and Zod schema validation.

```ts
import { getOpenRouterLLMResponse, getOpenRouterModels } from '@koko420/ai-tools';

const models = await getOpenRouterModels();
const result = await getOpenRouterLLMResponse({
  userMessage: '...',
  systemMessage: '...',
  schema: MyZodSchema,
});
```

### `getAudioTranscription`

Transcribe audio from a URL using OpenAI (`gpt-4o-transcribe`).

```ts
import { getAudioTranscription } from '@koko420/ai-tools';

const text = await getAudioTranscription(audioUrl);
```

### `expandQuery`

Expand a search query with synonyms and rephrasings using AI.

```ts
import { expandQuery } from '@koko420/ai-tools';

const expanded = await expandQuery(query);
```

### Embeddings

Generate and cache vector embeddings with similarity search support.

```ts
import {
  getEmbeddings,
  getManyEmbeddings,
  generateVectorEmbeddings,
  assertMinSimilarityRange,
  getSimilarityExpression,
  VectorSimilarityType,
  AI_EMBEDDINGS_DIMENSIONS,
} from '@koko420/ai-tools';

const embedding = await getEmbeddings({ text: 'hello', prisma, featureTypes: ['search'] });
const many = await getManyEmbeddings({ texts: ['a', 'b'], prisma });
```

Supported similarity types: `COSINE`, `L1`, `L2`, `DOT_PRODUCT`, `JACCARD`, `HAMMING`.

### SQL Query Builder

Composable SQL query builder with pgvector support.

```ts
import {
  createQueryBuilder,
  addSelectField,
  addFrom,
  addJoin,
  addWhereCondition,
  addOrderBy,
  setLimit,
  buildQuery,
  createParameterizedCondition,
  createInCondition,
  enquote,
  vectorize,
  formatSqlString,
} from '@koko420/ai-tools';

const builder = createQueryBuilder();
addSelectField(builder, '*');
addFrom(builder, 'my_table');
addWhereCondition(builder, 'id = $1', [someId]);
const { query, parameters } = buildQuery(builder);
```

### Embedding Cache Queries

Prisma-compatible queries for the `ai_cached_embedding` table.

```ts
import {
  getCachedEmbedding,
  createCachedEmbedding,
  getManyCachedEmbeddings,
} from '@koko420/ai-tools';

const cached = await getCachedEmbedding({ prisma, text: 'hello' });
await createCachedEmbedding({ prisma, text: 'hello', embedding: [...], featureTypes: ['search'] });
```

### Client Instances

Singleton factories for OpenAI and OpenRouter clients.

```ts
import { getOpenAISFWInstance } from '@koko420/ai-tools';
import { getOpenRouterInstance } from '@koko420/ai-tools';

const openai = getOpenAISFWInstance();
const openrouter = getOpenRouterInstance();
```

### Constants

```ts
import { OpenRouterTextGenerationModel, OpenAIEmbeddingsModel, AI_EMBEDDINGS_DIMENSIONS } from '@koko420/ai-tools';
```

- `OpenRouterTextGenerationModel` — enum of available OpenRouter models (GPT-4o, Grok 3, Gemma 3, DeepSeek v3)
- `OpenAIEmbeddingsModel` — enum of OpenAI embedding models
- `AI_EMBEDDINGS_DIMENSIONS` — default embedding dimensions (512)

## CLI: `translateKeys`

Auto-discover `locales/` directories and translate missing keys using AI.

```bash
translateKeys [keyword] [options]
```

### Options

| Flag | Description |
|---|---|
| `--force` | Overwrite existing translation files completely |
| `--partial` | Only translate missing keys (default) |
| `--all` | Create translations for all supported languages |
| `--help`, `-h` | Show help |

### Examples

```bash
translateKeys                        # Translate missing keys in existing locale files
translateKeys --all                  # Create all language translations
translateKeys --force                # Re-translate everything from scratch
translateKeys linkbase               # Only process locales dirs matching "linkbase"
translateKeys --all --force          # All languages, overwrite existing
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TRANSLATE_SOURCE_LANGUAGE` | `en` | Source language code |
| `TRANSLATE_LANGUAGE_NAMES` | (built-in list) | JSON string of `{ [code]: { name, nativeName } }` to merge with defaults |

```bash
TRANSLATE_SOURCE_LANGUAGE=de translateKeys
TRANSLATE_LANGUAGE_NAMES='{"ja":{"name":"Japanese","nativeName":"日本語"}}' translateKeys --all
```

### Supported Languages (defaults)

English, French, German, Spanish, Italian, Portuguese, Dutch, Swedish, Danish, Norwegian, Finnish, Polish, Czech, Slovak, Hungarian, Romanian, Bulgarian, Greek, Ukrainian, Russian, Chinese (Simplified & Traditional).
