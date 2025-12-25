# Security & Code Quality Fixes Specification

## Overview
This specification addresses all remaining security and code quality issues from PR #4 review comments.

## Issues to Fix

### 1. 🔴 Sensitive Error Logging (HIGH PRIORITY)
**Location:** `benchmarks/providers/base.ts:189-192`

**Problem:**
```typescript
if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
  console.debug(`[API Error ${status}] Full response:`, rawError.slice(0, 500));
}
```
- Logs raw API error responses in dev/debug mode
- May expose sensitive data (API keys, tokens, user data) in console
- Violates secure logging practices

**Solution:**
- Remove the debug logging of raw error responses entirely
- Add sanitized debug logging that shows only safe metadata
- Implement redaction for any debug logging if truly needed

**Implementation:**
```typescript
// Remove or replace with:
if (process.env.NODE_ENV === 'development') {
  console.debug(`[API Error ${status}] Error type: ${typeof rawError}, length: ${rawError.length}`);
}
```

---

### 2. ⚪ Passphrase in Memory (MEDIUM PRIORITY)
**Location:** `src/lib/crypto.ts:74`

**Problem:**
```typescript
let sessionPassphrase: string | null = null;
```
- Stored in global variable accessible to any code in context
- Could be read by malicious scripts or extensions
- Remains in memory after lock until GC

**Current Status:**
- Already documented in threat model (lines 13-48)
- clearSessionPassphrase() does best-effort cleanup
- Trade-off: needed for encrypt/decrypt operations

**Solution:**
- Document this is a known limitation with current mitigation
- Consider using WeakRef if browser support allows
- Add additional warnings in UI about browser security
- **DECISION:** Keep as-is with improved documentation (already well-documented)

**No code changes needed** - threat model is comprehensive and realistic.

---

### 3. ⚪ Unsafe base64 Decoding (MEDIUM PRIORITY)
**Location:** `src/lib/crypto.ts:244-248`

**Problem:**
```typescript
async function decryptWithPassphrase(encryptedData: string, passphrase: string): Promise<string> {
  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(c => c.charCodeAt(0))
  );
```
- `atob()` throws on invalid input without try-catch
- No validation of base64 format
- Could leak error info through exception

**Solution:**
- Add try-catch around atob() with sanitized error
- Validate base64 format before decoding
- Return generic error on failure

**Implementation:**
```typescript
async function decryptWithPassphrase(encryptedData: string, passphrase: string): Promise<string> {
  // Validate and decode from base64
  let combined: Uint8Array;
  try {
    // Basic validation
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data format');
    }

    const decoded = atob(encryptedData);
    combined = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));

    // Validate minimum length (salt + iv + at least some ciphertext)
    if (combined.length < SALT_LENGTH + IV_LENGTH + 1) {
      throw new Error('Invalid encrypted data format');
    }
  } catch (error) {
    // Don't leak details about what failed
    throw new Error('Failed to decode encrypted data. The data may be corrupted.');
  }

  // ... rest of function
}
```

---

### 4. ⚪ concurrentTranslations Validation (LOW PRIORITY)
**Location:** `benchmarks/scripts/pipeline.ts:489-496`

**Problem:**
```typescript
concurrentTranslations: number = 3
): Promise<{
  // ...
  const translationLimit = pLimit(concurrentTranslations);
```
- No validation of parameter value
- Could be 0, negative, or excessively large
- May cause `pLimit()` to throw or behave unexpectedly

**Solution:**
- Add parameter validation with sensible bounds
- Default to safe value on invalid input
- Log warning on invalid input

**Implementation:**
```typescript
export async function translateResults(
  items: PipelineItem[],
  syntheses: SynthesisResult[],
  adapter: ProviderAdapter,
  modelId: string,
  translationTemplate: string,
  targetLanguages: string[],
  sourceLanguage: string = 'en',
  temperature: number = 0.1,
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
  concurrentTranslations: number = 3
): Promise<{
  translatedSyntheses: SynthesisResult[];
}> {
  // Validate concurrentTranslations parameter
  const validatedConcurrency = Math.max(1, Math.min(concurrentTranslations, 10));
  if (validatedConcurrency !== concurrentTranslations) {
    console.warn(
      `concurrentTranslations adjusted from ${concurrentTranslations} to ${validatedConcurrency} (valid range: 1-10)`
    );
  }

  const translatedSyntheses: SynthesisResult[] = [...syntheses];

  // Rate limiter to prevent overwhelming the API
  const translationLimit = pLimit(validatedConcurrency);

  // ... rest of function
}
```

---

### 5. ⚪ Update PR Title and Description (LOW PRIORITY)

**Current Title:** (from PR)
**Suggested Title:** "Security overhaul: Replace device fingerprinting with passphrase-based vault system"

**Current Description:** (verbose but accurate)
**Suggested Description:** (from ai-coding-guardrails feedback)

**Solution:**
Update via GitHub CLI after all fixes are implemented.

---

## Implementation Order

1. **Fix sanitizeApiError logging** (HIGH) - Remove sensitive data exposure
2. **Add base64 decoding validation** (MEDIUM) - Prevent error leakage
3. **Add concurrentTranslations validation** (LOW) - Prevent runtime errors
4. **Update PR title/description** (LOW) - Improve clarity

## Testing Plan

### Unit Tests
- **crypto.ts:** Test decryptWithPassphrase with invalid base64 inputs
- **pipeline.ts:** Test translateResults with invalid concurrency values
- **base.ts:** Verify no sensitive data in error messages

### Manual Testing
- Verify no raw errors appear in console during API failures
- Test with corrupted encrypted data
- Test with invalid concurrency values (0, negative, very large)

## Security Review Checklist

- [ ] No sensitive data logged to console
- [ ] All error messages are generic and safe
- [ ] Input validation on all public parameters
- [ ] Graceful error handling with sanitized messages
- [ ] Documentation updated where code behavior changes
- [ ] All tests pass

## Files to Modify

1. `benchmarks/providers/base.ts` - Remove/sanitize debug logging
2. `src/lib/crypto.ts` - Add base64 decoding validation
3. `benchmarks/scripts/pipeline.ts` - Add concurrentTranslations validation
4. PR metadata (title/description via GitHub)
