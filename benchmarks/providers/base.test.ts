import { describe, it, expect } from 'vitest';
import { parseJsonResponse, isRetryableError } from './base.js';

describe('parseJsonResponse', () => {
  it('parses valid JSON', () => {
    const input = '{"key": "value"}';
    expect(parseJsonResponse(input)).toEqual({ key: 'value' });
  });

  it('extracts JSON from markdown code blocks', () => {
    const input = 'Here is the result:\n```json\n{"key": "value"}\n```';
    expect(parseJsonResponse(input)).toEqual({ key: 'value' });
  });

  it('extracts JSON from markdown code blocks without language tag', () => {
    const input = 'Here is the result:\n```\n{"key": "value"}\n```';
    expect(parseJsonResponse(input)).toEqual({ key: 'value' });
  });

  it('extracts JSON embedded in text without code blocks', () => {
    const input = 'Sure, here is the JSON object: {"key": "value"} hope that helps.';
    expect(parseJsonResponse(input)).toEqual({ key: 'value' });
  });

  it('handles nested objects correctly', () => {
    const input = '{"a": {"b": 1}, "c": [1, 2]}';
    expect(parseJsonResponse(input)).toEqual({ a: { b: 1 }, c: [1, 2] });
  });

  it('throws error for invalid JSON', () => {
    const input = 'This is not JSON';
    expect(() => parseJsonResponse(input)).toThrow();
  });
});

describe('isRetryableError', () => {
  it('identifies rate limit errors', () => {
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('identifies temporary server errors', () => {
    expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('identifies network errors', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('Network error'))).toBe(true);
  });

  it('returns false for permanent errors', () => {
    expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
    expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
  });
});
