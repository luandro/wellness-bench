# Implementation Plan: Code Issues Resolution

## Overview

This plan addresses 15 identified issues across 4 phases, organized by priority and dependency.

---

## Phase 1: Critical Fixes (Immediate)

These issues block core functionality or pose security risks.

### 1.1 Add Missing Routes to App.tsx
**Priority:** P0 | **Effort:** Low | **Risk:** None

**Current State:**
```typescript
// src/App.tsx - Only 2 routes defined
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

**Implementation Steps:**
1. Add imports for all 7 missing page components
2. Add route definitions for each page
3. Verify sidebar navigation works

**Files to Modify:**
- `src/App.tsx`

**Verification:**
- Click each sidebar link and confirm correct page loads
- Verify 404 only shows for truly invalid routes

---

### 1.2 Fix Insecure API Key Storage
**Priority:** P0 | **Effort:** Medium | **Risk:** Medium (breaking change for existing stored keys)

**Current State:**
```typescript
// src/contexts/AppContext.tsx:141
encrypted_key: btoa(key), // Base64 - NOT encryption
```

**Implementation Steps:**
1. Create a new `src/lib/crypto.ts` utility using Web Crypto API
2. Implement `encryptKey(key: string)` and `decryptKey(encrypted: string)`
3. Update `setApiKey` and `getApiKey` in AppContext
4. Add migration for existing stored keys (or clear them with warning)
5. Update UI messaging to accurately describe security model

**Files to Modify:**
- `src/lib/crypto.ts` (new file)
- `src/contexts/AppContext.tsx`
- `src/pages/ApiKeysPage.tsx` (update messaging)

**Verification:**
- Verify keys are stored encrypted in localStorage
- Verify keys can be retrieved and used
- Verify old base64 keys are handled gracefully

---

### 1.3 Enable TypeScript Strict Mode
**Priority:** P1 | **Effort:** High | **Risk:** Low (may reveal many errors)

**Current State:**
```json
// tsconfig.json
{
  "noImplicitAny": false,
  "strictNullChecks": false
}
```

**Implementation Steps:**
1. Enable `strict: true` in tsconfig.json
2. Run `npm run build` to identify all errors
3. Fix errors systematically (Phase 1.4)

**Files to Modify:**
- `tsconfig.json`

---

### 1.4 Fix TypeScript Errors
**Priority:** P1 | **Effort:** High | **Risk:** Low

**Expected Error Categories:**
1. Null checks on optional chaining
2. Implicit any parameters
3. Possibly undefined values

**Implementation Steps:**
1. Run build, capture all errors
2. Fix null checks with optional chaining or guards
3. Add explicit types where implicit any exists
4. Add type guards for possibly undefined values

**Files Likely Affected:**
- Most component files
- Context files
- Hook files

---

## Phase 2: High-Severity Fixes

### 2.1 Add Zod Schema Validation for Imports
**Priority:** P1 | **Effort:** Medium | **Risk:** Low

**Current State:**
```typescript
// src/pages/ImportExportPage.tsx
const data = JSON.parse(text);
if (data.questions) setQuestions(data.questions); // No validation
```

**Implementation Steps:**
1. Create Zod schemas in `src/lib/schemas.ts`
2. Create schemas for: QuestionsConfig, EvalPromptsConfig, ProvidersConfig, ResultsBundle
3. Update ImportExportPage to use schemas
4. Add helpful error messages for validation failures

**Files to Modify:**
- `src/lib/schemas.ts` (new file)
- `src/pages/ImportExportPage.tsx`

**Verification:**
- Import valid JSON - should succeed
- Import malformed JSON - should show specific error

---

### 2.2 Fix Run State Update Bug
**Priority:** P2 | **Effort:** Low | **Risk:** Low

**Current State:**
```typescript
// src/pages/RunPage.tsx:129-141
for (let i = 0; i < items.length; i++) {
  const updatedItems = [...run.items]; // 'run' is stale
  // ...
}
```

**Implementation Steps:**
1. Use a ref to track current run state
2. Or restructure to use functional state updates
3. Ensure each item update reflects in UI immediately

**Files to Modify:**
- `src/pages/RunPage.tsx`

---

### 2.3 Replace Hardcoded Questions with Context Data
**Priority:** P2 | **Effort:** Low | **Risk:** Low

**Current State:**
```typescript
// src/components/sections/QuestionsSection.tsx
const questions = [
  { number: '01', title: 'Diagnosis', ... }, // Hardcoded
];
```

**Implementation Steps:**
1. Import useApp or useBenchmark hook
2. Get questions from context
3. Map context data to display format
4. Handle empty state

**Files to Modify:**
- `src/components/sections/QuestionsSection.tsx`

---

### 2.4 Fix Memory Leak in Toast Hook
**Priority:** P2 | **Effort:** Low | **Risk:** Low

**Current State:**
```typescript
// src/hooks/use-toast.ts
const TOAST_REMOVE_DELAY = 1000000; // 16+ minutes!
React.useEffect(() => {
  // ...
}, [state]); // Incorrect dependency
```

**Implementation Steps:**
1. Change TOAST_REMOVE_DELAY to 5000 (5 seconds)
2. Remove `state` from useEffect dependency array
3. Add proper cleanup

**Files to Modify:**
- `src/hooks/use-toast.ts`

---

### 2.5 Add Proper Return Type to createMockResult
**Priority:** P2 | **Effort:** Low | **Risk:** None

**Current State:**
```typescript
// src/pages/RunPage.tsx:379
function createMockResult(item: RunItem): any {
```

**Implementation Steps:**
1. Import EvaluationResult type
2. Change return type from `any` to `EvaluationResult`
3. Ensure mock data conforms to type

**Files to Modify:**
- `src/pages/RunPage.tsx`

---

## Phase 3: Moderate Fixes

### 3.1 Remove Unused Imports
**Priority:** P3 | **Effort:** Low | **Risk:** None

**Locations:**
- `src/components/questions/QuestionEditor.tsx:2` - Remove `X`
- `src/pages/ResultsPage.tsx:13` - Remove `hasResults`

---

### 3.2 Optimize Repeated Filter Operations
**Priority:** P3 | **Effort:** Low | **Risk:** None

**Current State:**
```typescript
// src/components/results/ResultsOverview.tsx
.filter(item => item.status === 'succeeded').slice(0, 5)
// Called again later for count
```

**Implementation Steps:**
1. Extract filtered items to a variable
2. Use the variable for both display and count

---

### 3.3 Add Confirmation Dialogs
**Priority:** P3 | **Effort:** Low | **Risk:** None

**Locations:**
- Delete question in BenchmarkPage
- Remove API key in ApiKeysPage

**Implementation Steps:**
1. Use AlertDialog component from shadcn/ui
2. Wrap destructive actions in confirmation dialog
3. Add clear messaging about action consequences

---

### 3.4 Add React Error Boundaries
**Priority:** P3 | **Effort:** Medium | **Risk:** None

**Implementation Steps:**
1. Create `src/components/ErrorBoundary.tsx`
2. Wrap major sections (pages, sidebar)
3. Add fallback UI for errors
4. Consider adding error reporting

---

### 3.5 Add Loading States
**Priority:** P3 | **Effort:** Medium | **Risk:** None

**Locations:**
- Run execution
- Import/Export operations
- Any async operations

**Implementation Steps:**
1. Add loading state to relevant components
2. Show spinner or skeleton during loading
3. Disable interactive elements while loading

---

## Phase 4: Verification

### 4.1 Build Verification
1. Run `npm run build` - should complete without errors
2. Run `npm run lint` - should pass
3. Run dev server and manually test all features

### 4.2 Functional Testing
- [ ] All sidebar links navigate correctly
- [ ] API keys can be stored and retrieved
- [ ] Import/Export works with valid files
- [ ] Import rejects malformed files with clear error
- [ ] Run execution shows proper progress
- [ ] Delete operations show confirmation
- [ ] Errors are caught by error boundaries

---

## Execution Order

```
Phase 1 (Critical):
  1.1 Add Routes → 1.3 Enable Strict → 1.4 Fix TS Errors → 1.2 Fix API Keys

Phase 2 (High):
  2.1 Zod Validation → 2.2 Run State Bug → 2.3 Context Questions →
  2.4 Toast Hook → 2.5 Mock Result Type

Phase 3 (Moderate):
  3.1 Unused Imports → 3.2 Filter Optimization → 3.3 Confirmation Dialogs →
  3.4 Error Boundaries → 3.5 Loading States

Phase 4 (Verification):
  4.1 Build → 4.2 Manual Testing
```

---

## Estimated Total Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 4 tasks | 2-3 hours |
| Phase 2 | 5 tasks | 1-2 hours |
| Phase 3 | 5 tasks | 1-2 hours |
| Phase 4 | 2 tasks | 30 min |
| **Total** | **16 tasks** | **5-8 hours** |

---

## Dependencies

```
None ──┬── 1.1 Routes
       ├── 1.3 Strict Mode ── 1.4 Fix TS Errors
       ├── 2.1 Zod Schemas
       ├── 2.2 Run State Bug
       ├── 2.3 Context Questions
       ├── 2.4 Toast Hook
       ├── 2.5 Mock Result Type
       ├── 3.1 Unused Imports
       ├── 3.2 Filter Optimization
       └── 3.3 Confirmation Dialogs

1.4 Fix TS Errors ── 1.2 API Key Security (may need type fixes)

All Tasks ── 4.1 Build Verification ── 4.2 Functional Testing
```

---

## Rollback Plan

If issues arise:
1. Each fix is isolated and can be reverted independently
2. Git commits should be atomic per-task
3. Original behavior documented in CODE_ANALYSIS.md for reference
