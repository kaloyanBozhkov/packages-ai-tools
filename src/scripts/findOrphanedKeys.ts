#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Patterns that extract translation keys from source code
const T_CALL_PATTERNS = [
  // t("key") or t('key') — with optional chaining or namespace prefix
  /\bt\(\s*["'`]([a-zA-Z0-9_.\-\/]+)["'`]/g,
  // i18n.t("key")
  /i18n\.t\(\s*["'`]([a-zA-Z0-9_.\-\/]+)["'`]/g,
];

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const IGNORED_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage',
  'locales', '__tests__', '__mocks__',
]);

// ---------------------------------------------------------------------------
// Locales discovery (mirrors translateKeys.ts)
// ---------------------------------------------------------------------------

const findLocalesDirectories = (projectRoot: string, keyword: string | null = null): string[] => {
  const localesDirs: string[] = [];

  const walk = (dir: string): void => {
    try {
      for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item);
        if (!fs.statSync(fullPath).isDirectory()) continue;

        if (item === 'locales') {
          if (keyword) {
            if (path.relative(projectRoot, fullPath).includes(keyword)) localesDirs.push(fullPath);
          } else {
            localesDirs.push(fullPath);
          }
        } else if (!IGNORED_DIRS.has(item) && !item.startsWith('.')) {
          walk(fullPath);
        }
      }
    } catch (_) { /* skip unreadable dirs */ }
  };

  walk(projectRoot);
  return localesDirs;
};

const isNestedLocalesStructure = (localesDir: string): boolean => {
  try {
    for (const item of fs.readdirSync(localesDir)) {
      const full = path.join(localesDir, item);
      if (fs.statSync(full).isDirectory() && fs.readdirSync(full).some(f => f.endsWith('.json'))) {
        return true;
      }
    }
  } catch (_) { /* */ }
  return false;
};

const SOURCE_LANGUAGE = process.env.TRANSLATE_SOURCE_LANGUAGE || 'en';

const readSourceTranslation = (localesDir: string): Record<string, any> => {
  const isNested = isNestedLocalesStructure(localesDir);
  const sourcePath = isNested
    ? path.join(localesDir, SOURCE_LANGUAGE, 'common.json')
    : path.join(localesDir, `${SOURCE_LANGUAGE}.json`);

  if (!fs.existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
};

// ---------------------------------------------------------------------------
// Flatten nested JSON keys with dot notation
// ---------------------------------------------------------------------------

const flattenKeys = (obj: Record<string, any>, prefix = ''): Set<string> => {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const k of flattenKeys(value, full)) keys.add(k);
    } else {
      keys.add(full);
    }
  }
  return keys;
};

// ---------------------------------------------------------------------------
// Scan source files for translation keys
// ---------------------------------------------------------------------------

const findSrcRoot = (localesDir: string): string => {
  // Walk up from localesDir to find the nearest src/ directory
  let dir = path.dirname(localesDir);
  while (dir !== path.dirname(dir)) {
    const srcDir = path.join(dir, 'src');
    if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) return srcDir;
    dir = path.dirname(dir);
  }
  throw new Error(`Could not find src/ directory above ${localesDir}`);
};

const collectCodeFiles = (dir: string): string[] => {
  const files: string[] = [];

  const walk = (d: string): void => {
    try {
      for (const item of fs.readdirSync(d)) {
        if (IGNORED_DIRS.has(item) || item.startsWith('.')) continue;
        const full = path.join(d, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (CODE_EXTENSIONS.has(path.extname(item))) {
          files.push(full);
        }
      }
    } catch (_) { /* skip */ }
  };

  walk(dir);
  return files;
};

const extractKeysFromFile = (filePath: string): Set<string> => {
  const keys = new Set<string>();
  const content = fs.readFileSync(filePath, 'utf8');

  for (const pattern of T_CALL_PATTERNS) {
    // Reset lastIndex since we reuse the regex
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }

  return keys;
};

// ---------------------------------------------------------------------------
// Exported: scan a single locales directory and return orphaned keys
// ---------------------------------------------------------------------------

export interface OrphanedKey {
  key: string;
  files: string[];
}

export const findOrphanedKeysForLocalesDir = (
  localesDir: string,
  projectRoot: string,
): OrphanedKey[] => {
  // Read en.json keys
  let sourceKeys: Set<string>;
  try {
    const sourceContent = readSourceTranslation(localesDir);
    sourceKeys = flattenKeys(sourceContent);
  } catch {
    return [];
  }

  // Find src root and scan code
  let srcRoot: string;
  try {
    srcRoot = findSrcRoot(localesDir);
  } catch {
    return [];
  }

  const codeFiles = collectCodeFiles(srcRoot);

  // Collect all keys used in code
  const usedKeys = new Map<string, string[]>();
  for (const file of codeFiles) {
    const keys = extractKeysFromFile(file);
    for (const key of keys) {
      const existing = usedKeys.get(key) || [];
      existing.push(path.relative(projectRoot, file));
      usedKeys.set(key, existing);
    }
  }

  // Find orphaned keys: in code but NOT in en.json
  const orphaned: OrphanedKey[] = [];
  for (const [key, files] of usedKeys) {
    if (sourceKeys.has(key)) continue;

    let isPrefix = false;
    for (const sk of sourceKeys) {
      if (sk.startsWith(key + '.')) { isPrefix = true; break; }
    }
    if (isPrefix) continue;

    orphaned.push({ key, files });
  }

  orphaned.sort((a, b) => a.key.localeCompare(b.key));
  return orphaned;
};

// ---------------------------------------------------------------------------
// CLI main
// ---------------------------------------------------------------------------

const main = (): void => {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Find Orphaned Translation Keys

Scans source code for translation keys (t("...")) and reports keys that
are used in code but missing from the ${SOURCE_LANGUAGE}.json source file.

Usage: find-orphaned-keys [keyword]

Arguments:
  keyword          Optional: Only process locales directories within folders containing this keyword

Options:
  --help, -h       Show this help message
`);
    process.exit(0);
  }

  const keyword = args.find(a => !a.startsWith('-')) || null;
  const projectRoot = process.cwd();

  console.log('🔍 Scanning for orphaned translation keys...');
  if (keyword) console.log(`🎯 Filtering by keyword: "${keyword}"`);

  const localesDirs = findLocalesDirectories(projectRoot, keyword);

  if (localesDirs.length === 0) {
    console.log('❌ No locales directories found');
    process.exit(1);
  }

  let totalOrphaned = 0;

  for (const localesDir of localesDirs) {
    const relLocales = path.relative(projectRoot, localesDir);
    console.log(`\n📁 Locales: ${relLocales}`);

    const orphaned = findOrphanedKeysForLocalesDir(localesDir, projectRoot);

    if (orphaned.length === 0) {
      console.log(`  ✅ No orphaned keys found`);
    } else {
      console.log(`  ❌ ${orphaned.length} orphaned key(s) — used in code but missing from ${SOURCE_LANGUAGE}.json:\n`);
      for (const { key, files } of orphaned) {
        console.log(`    • "${key}"`);
        for (const f of [...new Set(files)]) {
          console.log(`      └─ ${f}`);
        }
      }
      totalOrphaned += orphaned.length;
    }
  }

  console.log('');
  if (totalOrphaned > 0) {
    console.log(`⚠️  Total orphaned keys: ${totalOrphaned}`);
    process.exit(1);
  } else {
    console.log('✅ All translation keys in code are present in source files.');
  }
};

// Only run CLI when executed directly (not imported)
const isDirectRun = require.main === module;
if (isDirectRun) {
  main();
}
