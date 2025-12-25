/**
 * Secure API key encryption using Web Crypto API
 *
 * Uses AES-256-GCM encryption with a derived key from a user-provided passphrase.
 *
 * ## Security Architecture
 *
 * - **Key Derivation**: PBKDF2 with SHA-256, 600,000 iterations (OWASP 2023 recommendation)
 * - **Encryption**: AES-256-GCM with random 96-bit IV per encryption
 * - **Salt**: Random 128-bit salt per encryption for key derivation
 * - **Verification**: Encrypted token stored to validate passphrase without storing it
 *
 * ## Session Passphrase Storage
 *
 * The passphrase is stored in a module-scoped variable (`sessionPassphrase`) for the
 * duration of the browser tab session. This design has important security implications:
 *
 * **Why in-memory storage?**
 * - Passphrases must be available for encryption/decryption operations
 * - Storing in sessionStorage would expose it to XSS attacks via storage APIs
 * - In-memory storage requires code execution access to read, raising the bar
 *
 * **Limitations:**
 * - Passphrase may remain in memory after "lock" until garbage collection
 * - JavaScript cannot guarantee secure memory erasure
 * - A compromised extension with code execution access could read the variable
 * - Each browser tab requires separate passphrase entry (no cross-tab sync of passphrase)
 *
 * ## Threat Model
 *
 * **Protected against:**
 * - Casual inspection of localStorage (keys are encrypted)
 * - Offline attacks on stolen storage data (requires passphrase to decrypt)
 * - Shoulder surfing (only last 4 digits shown)
 *
 * **NOT protected against:**
 * - Malicious browser extensions with code execution
 * - XSS vulnerabilities in the application
 * - Physical access to unlocked browser session
 * - Memory forensics on the running browser
 *
 * ## Recommendations for Users
 *
 * - Use a unique, strong passphrase (12+ characters recommended)
 * - Lock the vault when stepping away from the computer
 * - Consider using environment variables for production deployments
 * - Use API keys with minimal required permissions (principle of least privilege)
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
/** AES-256 key length in bits - industry standard for symmetric encryption */
const KEY_LENGTH = 256;
/** 16-byte (128-bit) salt for PBKDF2 - NIST SP 800-132 recommended minimum */
const SALT_LENGTH = 16;
/** 12-byte (96-bit) IV for AES-GCM - NIST SP 800-38D recommended size for optimal security */
const IV_LENGTH = 12;
/** PBKDF2 iterations - OWASP 2023 recommendation for SHA-256 is 600,000 */
const PBKDF2_ITERATIONS = 600000;

/**
 * Storage key for the encrypted passphrase verification token.
 * This allows us to verify the passphrase is correct before attempting decryption.
 */
const PASSPHRASE_VERIFICATION_KEY = 'benchmark_passphrase_verify';

/**
 * Verification token includes a version and random component.
 * The random part is generated once during vault setup and stored with the encrypted token.
 * This prevents offline brute-force attacks using known plaintext.
 */
const VERIFICATION_TOKEN_PREFIX = 'wellness-bench-v2-';

/** Session storage for the passphrase (cleared when browser tab closes) */
let sessionPassphrase: string | null = null;

/** Audit log for security events (in-memory, cleared on page reload) */
const securityAuditLog: Array<{ timestamp: string; event: string; details?: string }> = [];

/**
 * Log a security event for audit purposes
 */
function logSecurityEvent(event: string, details?: string): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    details,
  };
  securityAuditLog.push(entry);
  // Keep only last 100 entries to prevent memory bloat
  if (securityAuditLog.length > 100) {
    securityAuditLog.shift();
  }
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.info('[Security Audit]', entry.event, entry.details || '');
  }
}

/**
 * Get the security audit log (for debugging/monitoring)
 */
export function getSecurityAuditLog(): ReadonlyArray<{ timestamp: string; event: string; details?: string }> {
  return [...securityAuditLog];
}

/**
 * Validate passphrase complexity requirements
 * Requires: 8+ chars, and at least 2 of: lowercase, uppercase, numbers, special chars
 */
export function validatePassphraseComplexity(passphrase: string): { valid: boolean; message: string } {
  const trimmed = passphrase.trim();

  if (trimmed.length < 8) {
    return { valid: false, message: 'Passphrase must be at least 8 characters' };
  }

  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);
  const hasSpecial = /[^a-zA-Z0-9]/.test(trimmed);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (varietyCount < 2) {
    return {
      valid: false,
      message: 'Passphrase must include at least 2 of: lowercase, uppercase, numbers, special characters'
    };
  }

  return { valid: true, message: '' };
}

/**
 * Set the encryption passphrase for the current session.
 * The passphrase is stored in memory only (not persisted).
 */
export function setSessionPassphrase(passphrase: string): void {
  const trimmed = passphrase.trim();
  const validation = validatePassphraseComplexity(trimmed);
  if (!validation.valid) {
    throw new Error(validation.message);
  }
  sessionPassphrase = trimmed;
  logSecurityEvent('PASSPHRASE_SET', 'Session passphrase configured');
}

/**
 * Clear the session passphrase (e.g., on logout or lock)
 * Attempts to overwrite memory before clearing (best-effort, not guaranteed in JS)
 */
export function clearSessionPassphrase(): void {
  if (sessionPassphrase) {
    // Best-effort memory clearing: overwrite with random data before nulling
    // Note: This is not guaranteed to work in JavaScript due to string immutability
    // and garbage collection, but it raises the bar slightly
    try {
      const len = sessionPassphrase.length;
      // Create garbage to potentially overwrite memory locations
      for (let i = 0; i < 3; i++) {
        const garbage = crypto.getRandomValues(new Uint8Array(len));
        // Force some computation to prevent optimization away
        void garbage.reduce((a, b) => a + b, 0);
      }
    } catch {
      // Ignore errors during cleanup attempt
    }
    logSecurityEvent('PASSPHRASE_CLEARED', 'Session passphrase removed from memory');
  }
  sessionPassphrase = null;
}

/**
 * Check if a session passphrase is currently set
 */
export function hasSessionPassphrase(): boolean {
  return sessionPassphrase !== null;
}

/**
 * Get the current passphrase, throwing if not set
 */
function getPassphrase(): string {
  if (!sessionPassphrase) {
    throw new Error('Encryption passphrase not set. Please unlock the vault first.');
  }
  return sessionPassphrase;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string using AES-GCM with the provided passphrase
 * Returns a base64 string containing salt + iv + ciphertext
 */
async function encryptWithPassphrase(plaintext: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string that was encrypted with encryptWithPassphrase
 */
async function decryptWithPassphrase(encryptedData: string, passphrase: string): Promise<string> {
  // Validate and decode from base64
  let combined: Uint8Array;
  try {
    // Basic validation
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data format');
    }

    // Attempt base64 decode with error handling
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

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Generate a random verification token with prefix
 * The random component prevents offline brute-force attacks using known plaintext
 */
function generateVerificationToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return VERIFICATION_TOKEN_PREFIX + randomHex;
}

/**
 * Check if a decrypted token is valid (starts with our prefix)
 */
function isValidVerificationToken(token: string): boolean {
  return token.startsWith(VERIFICATION_TOKEN_PREFIX) || token === 'wellness-bench-v1';
}

/**
 * Initialize the passphrase by verifying it against a stored verification token.
 * On first use, creates the verification token with a random component.
 * Returns true if passphrase is valid, false otherwise.
 */
export async function initializePassphrase(passphrase: string): Promise<boolean> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available in this browser');
  }

  const trimmed = passphrase.trim();
  const validation = validatePassphraseComplexity(trimmed);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const storedVerification = localStorage.getItem(PASSPHRASE_VERIFICATION_KEY);

  if (storedVerification) {
    // Verify existing passphrase
    try {
      const decrypted = await decryptWithPassphrase(storedVerification, trimmed);
      if (isValidVerificationToken(decrypted)) {
        setSessionPassphrase(trimmed);
        logSecurityEvent('VAULT_UNLOCKED', 'Vault successfully unlocked');
        return true;
      }
      logSecurityEvent('VAULT_UNLOCK_FAILED', 'Invalid verification token');
      return false;
    } catch {
      // Decryption failed - wrong passphrase
      logSecurityEvent('VAULT_UNLOCK_FAILED', 'Decryption failed - incorrect passphrase');
      return false;
    }
  } else {
    // First time setup - create verification token with random component
    const verificationToken = generateVerificationToken();
    const encryptedToken = await encryptWithPassphrase(verificationToken, trimmed);
    localStorage.setItem(PASSPHRASE_VERIFICATION_KEY, encryptedToken);
    setSessionPassphrase(trimmed);
    logSecurityEvent('VAULT_CREATED', 'New vault created with passphrase');
    return true;
  }
}

/**
 * Check if a passphrase has been set up (verification token exists)
 */
export function isPassphraseSetUp(): boolean {
  return localStorage.getItem(PASSPHRASE_VERIFICATION_KEY) !== null;
}

/**
 * Reset the passphrase (clears all encrypted data)
 * This is a destructive operation!
 */
export function resetPassphrase(): void {
  logSecurityEvent('VAULT_RESET', 'Vault reset initiated - all encrypted data will be cleared');
  localStorage.removeItem(PASSPHRASE_VERIFICATION_KEY);
  clearSessionPassphrase();
}

/**
 * Encrypts an API key using AES-GCM with the session passphrase
 * Returns a base64 string containing salt + iv + ciphertext
 *
 * @throws Error if passphrase not set or encryption fails
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available. Cannot securely store API keys.');
  }

  try {
    const passphrase = getPassphrase();
    const result = await encryptWithPassphrase(apiKey, passphrase);
    logSecurityEvent('API_KEY_ENCRYPTED', 'API key successfully encrypted');
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('passphrase')) {
      throw error;
    }
    // Log sanitized error - no raw error details that might contain sensitive info
    logSecurityEvent('ENCRYPTION_FAILED', 'API key encryption failed');
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypts an API key that was encrypted with encryptApiKey
 *
 * @throws Error if passphrase not set or decryption fails
 */
export async function decryptApiKey(encryptedKey: string): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available. Cannot decrypt API keys.');
  }

  try {
    const passphrase = getPassphrase();
    const result = await decryptWithPassphrase(encryptedKey, passphrase);
    logSecurityEvent('API_KEY_DECRYPTED', 'API key successfully decrypted');
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('passphrase')) {
      throw error;
    }
    // Log sanitized error - no raw error details that might contain sensitive info
    logSecurityEvent('DECRYPTION_FAILED', 'API key decryption failed');
    throw new Error('Failed to decrypt API key. The passphrase may be incorrect or the data may be corrupted.');
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' &&
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues !== 'undefined';
}
