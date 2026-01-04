/**
 * Simple content-addressed cache utilities for benchmark pipeline.
 */

import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';

type CacheBucket = 'answers' | 'evaluations';

interface CacheEntry<T> {
  key: string;
  created_at: string;
  data: T;
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet();

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }

    if (seen.has(input as object)) {
      throw new Error('Cannot stable stringify circular structure.');
    }
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      output[key] = normalize((input as Record<string, unknown>)[key]);
    }
    return output;
  };

  return JSON.stringify(normalize(value));
}

export function hashObject(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getCachePath(baseDir: string, bucket: CacheBucket, key: string): string {
  return resolve(baseDir, bucket, `${key}.json`);
}

async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

export async function readCache<T>(
  baseDir: string,
  bucket: CacheBucket,
  key: string
): Promise<T | null> {
  const filePath = getCachePath(baseDir, bucket, key);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(content) as CacheEntry<T> | T;

  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return (parsed as CacheEntry<T>).data;
  }

  return parsed as T;
}

export async function writeCache<T>(
  baseDir: string,
  bucket: CacheBucket,
  key: string,
  data: T
): Promise<void> {
  const filePath = getCachePath(baseDir, bucket, key);
  await ensureDir(dirname(filePath));

  const payload: CacheEntry<T> = {
    key,
    created_at: new Date().toISOString(),
    data,
  };

  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}
