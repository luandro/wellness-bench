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
const VERIFICATION_TOKEN = 'wellness-bench-v1';

/** Session storage for the passphrase (cleared when browser tab closes) */
let sessionPassphrase: string | null = null;

/**
 * Set the encryption passphrase for the current session.
 * The passphrase is stored in memory only (not persisted).
 */
export function setSessionPassphrase(passphrase: string): void {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }
  sessionPassphrase = passphrase;
}

/**
 * Clear the session passphrase (e.g., on logout or lock)
 */
export function clearSessionPassphrase(): void {
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
  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(c => c.charCodeAt(0))
  );

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
 * Initialize the passphrase by verifying it against a stored verification token.
 * On first use, creates the verification token.
 * Returns true if passphrase is valid, false otherwise.
 */
export async function initializePassphrase(passphrase: string): Promise<boolean> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available in this browser');
  }

  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }

  const storedVerification = localStorage.getItem(PASSPHRASE_VERIFICATION_KEY);

  if (storedVerification) {
    // Verify existing passphrase
    try {
      const decrypted = await decryptWithPassphrase(storedVerification, passphrase);
      if (decrypted === VERIFICATION_TOKEN) {
        setSessionPassphrase(passphrase);
        return true;
      }
      return false;
    } catch {
      // Decryption failed - wrong passphrase
      return false;
    }
  } else {
    // First time setup - create verification token
    const encryptedToken = await encryptWithPassphrase(VERIFICATION_TOKEN, passphrase);
    localStorage.setItem(PASSPHRASE_VERIFICATION_KEY, encryptedToken);
    setSessionPassphrase(passphrase);
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
    return await encryptWithPassphrase(apiKey, passphrase);
  } catch (error) {
    if (error instanceof Error && error.message.includes('passphrase')) {
      throw error;
    }
    console.error('Encryption failed:', error);
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
    return await decryptWithPassphrase(encryptedKey, passphrase);
  } catch (error) {
    if (error instanceof Error && error.message.includes('passphrase')) {
      throw error;
    }
    console.error('Decryption failed:', error);
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
