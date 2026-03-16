#!/usr/bin/env node

import { getLLMResponse } from '../getLLMResponse';
import fs from 'fs';
import path from 'path';
import z from 'zod';

// Configuration — overridable via env vars
// TRANSLATE_SOURCE_LANGUAGE: source language code (default: "en")
// TRANSLATE_LANGUAGE_NAMES: JSON string of { [code]: { name, nativeName } } to merge/override defaults
const DEFAULT_LANGUAGE_NAMES: Record<string, { name: string; nativeName: string }> = {
  'en': { name: 'English', nativeName: 'English' },
  'fr': { name: 'French', nativeName: 'Français' },
  'de': { name: 'German', nativeName: 'Deutsch' },
  'es': { name: 'Spanish', nativeName: 'Español' },
  'it': { name: 'Italian', nativeName: 'Italiano' },
  'pt': { name: 'Portuguese', nativeName: 'Português' },
  'nl': { name: 'Dutch', nativeName: 'Nederlands' },
  'sv': { name: 'Swedish', nativeName: 'Svenska' },
  'da': { name: 'Danish', nativeName: 'Dansk' },
  'no': { name: 'Norwegian', nativeName: 'Norsk' },
  'fi': { name: 'Finnish', nativeName: 'Suomi' },
  'pl': { name: 'Polish', nativeName: 'Polski' },
  'cs': { name: 'Czech', nativeName: 'Čeština' },
  'sk': { name: 'Slovak', nativeName: 'Slovenčina' },
  'hu': { name: 'Hungarian', nativeName: 'Magyar' },
  'ro': { name: 'Romanian', nativeName: 'Română' },
  'bg': { name: 'Bulgarian', nativeName: 'Български' },
  'el': { name: 'Greek', nativeName: 'Ελληνικά' },
  'uk': { name: 'Ukrainian', nativeName: 'Українська' },
  'ru': { name: 'Russian', nativeName: 'Русский' },
  'zh': { name: 'Chinese', nativeName: '中文' },
  'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文' },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文' },
};

const SOURCE_LANGUAGE = process.env.TRANSLATE_SOURCE_LANGUAGE || 'en';

const LANGUAGE_NAMES: Record<string, { name: string; nativeName: string }> = (() => {
  const envOverride = process.env.TRANSLATE_LANGUAGE_NAMES;
  if (!envOverride) return DEFAULT_LANGUAGE_NAMES;
  try {
    const parsed = JSON.parse(envOverride) as Record<string, { name: string; nativeName: string }>;
    return { ...DEFAULT_LANGUAGE_NAMES, ...parsed };
  } catch (e) {
    console.warn('⚠️  Failed to parse TRANSLATE_LANGUAGE_NAMES env var, using defaults');
    return DEFAULT_LANGUAGE_NAMES;
  }
})();

// Schema for translation response
const TranslationResponseSchema = z.record(z.string(), z.any());

// Find all locales directories in the repository
const findLocalesDirectories = (keyword: string | null = null): string[] => {
  const projectRoot = process.cwd();
  const localesDirs: string[] = [];

  const findDirectories = (dir: string): void => {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (item === 'locales') {
            // If keyword is provided, check if the locales directory is within a folder containing that keyword
            if (keyword) {
              const relativePath = path.relative(projectRoot, fullPath);
              if (relativePath.includes(keyword)) {
                localesDirs.push(fullPath);
              }
            } else {
              localesDirs.push(fullPath);
            }
          } else if (item !== 'node_modules' && !item.startsWith('.')) {
            findDirectories(fullPath);
          }
        }
      }
    } catch (_) {
      // Skip directories we can't read
    }
  };

  findDirectories(projectRoot);
  return localesDirs;
};

// Check if locales uses nested folder structure (locales/en/common.json) or flat (locales/en.json)
const isNestedLocalesStructure = (localesDir: string): boolean => {
  try {
    const items = fs.readdirSync(localesDir);
    for (const item of items) {
      const fullPath = path.join(localesDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        // Check if directory contains json files
        const subItems = fs.readdirSync(fullPath);
        if (subItems.some(f => f.endsWith('.json'))) {
          return true;
        }
      }
    }
    return false;
  } catch (_) {
    return false;
  }
};

// Get existing translation files in a locales directory
const getExistingTranslations = (localesDir: string): string[] => {
  try {
    const isNested = isNestedLocalesStructure(localesDir);
    const items = fs.readdirSync(localesDir);

    if (isNested) {
      // Nested structure: locales/en/common.json
      return items.filter(item => {
        const fullPath = path.join(localesDir, item);
        return fs.statSync(fullPath).isDirectory();
      });
    } else {
      // Flat structure: locales/en.json
      return items
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    }
  } catch (_) {
    return [];
  }
};

// Read the source translation file
const readSourceFile = (localesDir: string): Record<string, any> => {
  const isNested = isNestedLocalesStructure(localesDir);
  const sourcePath = isNested
    ? path.join(localesDir, SOURCE_LANGUAGE, 'common.json')
    : path.join(localesDir, `${SOURCE_LANGUAGE}.json`);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  const content = fs.readFileSync(sourcePath, 'utf8');
  return JSON.parse(content);
};

// Read existing translation file
const readExistingTranslation = (localesDir: string, languageCode: string): Record<string, any> | null => {
  const isNested = isNestedLocalesStructure(localesDir);
  const filePath = isNested
    ? path.join(localesDir, languageCode, 'common.json')
    : path.join(localesDir, `${languageCode}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);

    // Return the parsed content even if it's empty - let the missing keys detection handle it
    return parsed;
  } catch (error) {
    console.log(`⚠️  Error reading existing ${languageCode}.json:`, error);
    return null;
  }
};

// Find missing keys by comparing source with existing translation
const findMissingKeys = (sourceContent: Record<string, any>, existingContent: Record<string, any>): Record<string, any> => {
  const missingKeys: Record<string, any> = {};

  const findMissingInObject = (source: Record<string, any>, existing: Record<string, any>, path: string[] = []): void => {
    for (const [key, value] of Object.entries(source)) {
      const currentPath = [...path, key];
      const pathString = currentPath.join('.');

      if (!(key in existing)) {
        // Key doesn't exist in translation
        missingKeys[pathString] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively check nested objects
        if (typeof existing[key] === 'object' && existing[key] !== null && !Array.isArray(existing[key])) {
          findMissingInObject(value, existing[key], currentPath);
        } else {
          // Existing value is not an object, so the entire subtree is missing
          missingKeys[pathString] = value;
        }
      } else if (existing[key] === '' || existing[key] === null || existing[key] === undefined) {
        // Key exists but is empty/null/undefined
        missingKeys[pathString] = value;
      }
    }
  };

  // If existing content is empty (like {}), treat it as having no keys
  if (!existingContent || Object.keys(existingContent).length === 0) {
    // Return the entire source content as missing
    return sourceContent;
  }

  findMissingInObject(sourceContent, existingContent);
  return missingKeys;
};

// Merge translated content with existing content
const mergeTranslations = (existingContent: Record<string, any>, newTranslations: Record<string, any>): Record<string, any> => {
  const merged = { ...existingContent };

  for (const [keyPath, value] of Object.entries(newTranslations)) {
    const keys = keyPath.split('.');
    let current = merged;

    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null || Array.isArray(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }

    // Set the value
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  return merged;
};

// Get language info for a language code
const getLanguageInfo = (languageCode: string): { name: string; nativeName: string } => {
  const info = LANGUAGE_NAMES[languageCode];
  if (!info) {
    // For unknown language codes, create a basic info object
    return {
      name: languageCode.toUpperCase(),
      nativeName: languageCode.toUpperCase()
    };
  }
  return info;
};

// Create the GPT prompt for translation
const createTranslationPrompt = (sourceContent: Record<string, any>, targetLanguage: string, isPartial: boolean = false): string => {
  const languageInfo = getLanguageInfo(targetLanguage);
  const contentType = isPartial ? 'missing translation keys' : 'JSON translation file';

  return `You are a professional translator specializing in mobile app localization.

Please translate the following ${contentType} from English to ${languageInfo.name} (${languageInfo.nativeName}).

IMPORTANT GUIDELINES:
1. Maintain the exact JSON structure and keys - only translate the values
2. Keep emojis and special characters (like {{name}}) exactly as they are
3. Use appropriate regional terminology for ${languageInfo.name}
4. Ensure translations are natural and contextually appropriate for a mobile app
5. Maintain consistent terminology throughout the translation
6. For technical terms, use the most commonly accepted translation in ${languageInfo.name}
7. Keep the translation concise but clear
8. Preserve any formatting or placeholders like {{name}}
9. Ensure all strings are properly closed and the JSON is valid

${isPartial ? 'MISSING KEYS TO TRANSLATE:' : 'SOURCE JSON:'}
${JSON.stringify(sourceContent, null, 2)}

Please respond with ONLY the translated JSON object, no additional text or explanations. Make sure the JSON is complete and properly formatted.`;
};

// Split large translation object into chunks
const splitTranslationChunks = (content: Record<string, any>, maxKeysPerChunk: number = 50): Record<string, any>[] => {
  const chunks: Record<string, any>[] = [];
  const entries = Object.entries(content);

  for (let i = 0; i < entries.length; i += maxKeysPerChunk) {
    const chunk = Object.fromEntries(entries.slice(i, i + maxKeysPerChunk));
    chunks.push(chunk);
  }

  return chunks;
};

// Translate content using GPT with chunking for large files
const translateKeys = async (content: Record<string, any>, targetLanguage: string, isPartial: boolean = false): Promise<Record<string, any> | null> => {
  try {
    const languageInfo = getLanguageInfo(targetLanguage);
    console.log(`🔄 Translating to ${languageInfo.name}...`);

    // Check if content is large (more than 50 keys)
    const keyCount = Object.keys(content).length;
    if (keyCount > 50) {
      console.log(`📦 Large translation detected (${keyCount} keys), splitting into chunks...`);
      return await translateLargeContent(content, targetLanguage, isPartial);
    }

    const prompt = createTranslationPrompt(content, targetLanguage, isPartial);

    const translatedJson = await getLLMResponse({
      userMessage: prompt,
      systemMessage: 'You are a professional translator. Respond only with the translated JSON object.',
      schema: TranslationResponseSchema,
    });

    console.log(`✅ Successfully translated to ${languageInfo.name}`);
    return translatedJson;
  } catch (error) {
    const languageInfo = getLanguageInfo(targetLanguage);
    console.error(`❌ Translation failed for ${languageInfo.name}:`, error);
    return null;
  }
};

// Translate large content by splitting into chunks
const translateLargeContent = async (content: Record<string, any>, targetLanguage: string, isPartial: boolean = false): Promise<Record<string, any> | null> => {
  const languageInfo = getLanguageInfo(targetLanguage);
  const chunks = splitTranslationChunks(content, 30); // Smaller chunks for better reliability
  const translatedChunks: Record<string, any>[] = [];

  console.log(`📦 Translating ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`📦 Translating chunk ${i + 1}/${chunks.length} (${Object.keys(chunk).length} keys)...`);

    try {
      const prompt = createTranslationPrompt(chunk, targetLanguage, isPartial);

      const translatedChunk = await getLLMResponse({
        userMessage: prompt,
        systemMessage: 'You are a professional translator. Respond only with the translated JSON object.',
        schema: TranslationResponseSchema,
      });

      translatedChunks.push(translatedChunk);

      // Add delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to translate chunk ${i + 1}:`, error);
      return null;
    }
  }

  // Merge all chunks back together
  const mergedResult = Object.assign({}, ...translatedChunks);
  console.log(`✅ Successfully translated all chunks to ${languageInfo.name}`);
  return mergedResult;
};

// Save translated content to file
const saveTranslation = (content: Record<string, any>, localesDir: string, languageCode: string): void => {
  const isNested = isNestedLocalesStructure(localesDir);

  let filePath: string;
  if (isNested) {
    // Create language directory if it doesn't exist
    const langDir = path.join(localesDir, languageCode);
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }
    filePath = path.join(langDir, 'common.json');
  } else {
    filePath = path.join(localesDir, `${languageCode}.json`);
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  console.log(`💾 Saved translation to ${path.relative(process.cwd(), filePath)}`);
};

// Determine target languages based on existing files and common patterns
const determineTargetLanguages = (existingTranslations: string[], includeAll: boolean = false): string[] => {
  if (includeAll) {
    // Return ALL languages from LANGUAGE_NAMES (except source language)
    return Object.keys(LANGUAGE_NAMES).filter(lang => lang !== SOURCE_LANGUAGE);
  }
  // Return ALL existing non-English translations that need to be processed
  // This ensures we process all language files, not just predefined common ones
  return existingTranslations.filter(lang => lang !== SOURCE_LANGUAGE);
};

// Process a single locales directory
const processLocalesDirectory = async (localesDir: string): Promise<void> => {
  console.log(`\n📁 Processing locales directory: ${path.relative(process.cwd(), localesDir)}`);

  // Get existing translations
  const existingTranslations = getExistingTranslations(localesDir);
  console.log(`📄 Existing translations: ${existingTranslations.join(', ')}`);

  // Check if source file exists
  if (!existingTranslations.includes(SOURCE_LANGUAGE)) {
    console.log(`⚠️  Skipping - no ${SOURCE_LANGUAGE}.json found`);
    return;
  }

  // Read source content
  const sourceContent = readSourceFile(localesDir);
  console.log(`📖 Loaded source file with ${Object.keys(sourceContent).length} sections`);

  // Check for flags
  const isForceMode = process.argv.includes('--force');
  const isAllMode = process.argv.includes('--all');

  // Get all non-English languages that exist (or all from LANGUAGE_NAMES if --all flag)
  const targetLanguages = determineTargetLanguages(existingTranslations, isAllMode);

  if (targetLanguages.length === 0) {
    console.log(`✅ No target languages to process`);
    return;
  }

  if (isAllMode) {
    console.log(`🌍 All mode: Creating translations for ALL ${targetLanguages.length} languages`);
  }
  console.log(`🎯 Languages to process: ${targetLanguages.join(', ')}`);

  for (const targetLanguage of targetLanguages) {
    console.log(`\n🌐 Processing ${targetLanguage}...`);

    if (isForceMode) {
      // Force mode: ignore existing translations and translate all keys from English source
      console.log(`🔄 Force mode: Resetting and retranslating all keys for ${targetLanguage}`);
      const translatedContent = await translateKeys(sourceContent, targetLanguage);

      if (translatedContent) {
        saveTranslation(translatedContent, localesDir, targetLanguage);
      } else {
        console.log(`⚠️  Skipping ${targetLanguage} due to translation failure`);
      }
    } else {
      // Normal mode: read existing content and only translate missing keys
      const existingContent = readExistingTranslation(localesDir, targetLanguage);

      if (existingContent !== null) {
        // Check for missing keys
        const missingKeys = findMissingKeys(sourceContent, existingContent);

        if (Object.keys(missingKeys).length === 0) {
          console.log(`✅ ${targetLanguage}.json is complete - no missing keys`);
          continue;
        }

        // Check if this is an empty file (like {})
        const isEmptyFile = Object.keys(existingContent).length === 0;
        if (isEmptyFile) {
          console.log(`📝 ${targetLanguage}.json is empty - translating all keys`);
        } else {
          console.log(`🔍 Found ${Object.keys(missingKeys).length} missing keys in ${targetLanguage}`);
        }

        // Translate only missing keys
        const translatedMissingKeys = await translateKeys(missingKeys, targetLanguage, true);

        if (translatedMissingKeys) {
          // Merge with existing content
          const mergedContent = mergeTranslations(existingContent, translatedMissingKeys);
          saveTranslation(mergedContent, localesDir, targetLanguage);
        } else {
          console.log(`⚠️  Failed to translate missing keys for ${targetLanguage}`);
        }
      } else {
        // No existing file - translate everything
        console.log(`📝 Creating new translation file for ${targetLanguage}`);
        const translatedContent = await translateKeys(sourceContent, targetLanguage);

        if (translatedContent) {
          saveTranslation(translatedContent, localesDir, targetLanguage);
        } else {
          console.log(`⚠️  Skipping ${targetLanguage} due to translation failure`);
        }
      }
    }

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};

// Main translation function
const translateAllKeys = async (keyword: string | null = null): Promise<void> => {
  console.log('🚀 Starting translation process...');
  console.log(`📖 Source language: ${SOURCE_LANGUAGE}`);
  if (keyword) {
    console.log(`🎯 Targeting apps containing: "${keyword}"`);
  }
  console.log('');

  // Find all locales directories
  const localesDirs = findLocalesDirectories(keyword);

  if (localesDirs.length === 0) {
    console.log('❌ No locales directories found in the repository');
    if (keyword) {
      console.log(`   (filtered by keyword: "${keyword}")`);
    }
    process.exit(1);
  }

  console.log(`📁 Found ${localesDirs.length} locales directory(ies):`);
  localesDirs.forEach(dir => {
    console.log(`   - ${path.relative(process.cwd(), dir)}`);
  });
  console.log('');

  // Process each locales directory
  for (const localesDir of localesDirs) {
    try {
      await processLocalesDirectory(localesDir);
    } catch (error) {
      console.error(`❌ Error processing ${path.relative(process.cwd(), localesDir)}:`, error);
    }
  }

  console.log('\n🎉 Translation process completed!');
  console.log('\nNext steps:');
  console.log('1. Review the generated translation files');
  console.log('2. Test the translations in your app');
  console.log('3. Make any necessary adjustments for cultural context');
};

// Handle command line arguments
const handleArguments = (): { keyword: string | null } => {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Translation Script for Multi-App Repository

Usage: translate-keys [keyword] [options]

This script automatically discovers all locales directories in the repository
and translates missing language files based on the English source files.

The script intelligently determines which languages to translate based on:
- Existing translation files in each locales directory
- Common language patterns and priorities

The script supports partial translations - it will only translate missing keys
in existing translation files, preserving already translated content.

Arguments:
  keyword          Optional: Only process locales directories within folders containing this keyword
                   (e.g., "linkbase" will only process locales in linkbase-related folders)

Options:
  --force          Overwrite existing translation files completely
  --partial        Only translate missing keys (default behavior)
  --all            Create translations for ALL languages in LANGUAGE_NAMES (creates missing locale folders)
  --help, -h       Show this help message

Examples:
  translate-keys                    # Process existing locales (partial translation)
  translate-keys --all              # Create ALL language translations
  translate-keys --force            # Overwrite all existing translations
  translate-keys --all --force      # Create ALL languages, overwrite existing
  translate-keys linkbase --partial # Explicitly use partial translation mode
    `);
    process.exit(0);
  }

  // Extract keyword from arguments (first non-option argument)
  const keyword = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-')) || null;

  return { keyword };
};

// Run the script
const main = async (): Promise<void> => {
  try {
    const { keyword } = handleArguments();
    await translateAllKeys(keyword);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

main();
