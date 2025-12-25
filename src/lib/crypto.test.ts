import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setSessionPassphrase,
  clearSessionPassphrase,
  hasSessionPassphrase,
  initializePassphrase,
  isPassphraseSetUp,
  resetPassphrase,
  encryptApiKey,
  decryptApiKey,
  isCryptoAvailable,
  validatePassphraseComplexity,
  getSecurityAuditLog,
} from './crypto';

// Test passphrases that meet complexity requirements (8+ chars, 2+ character types)
const VALID_PASSPHRASE = 'TestPass123';
const VALID_PASSPHRASE_ALT = 'Different1!';

describe('crypto', () => {
  beforeEach(() => {
    // Clear session state
    clearSessionPassphrase();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    clearSessionPassphrase();
    localStorage.clear();
  });

  describe('isCryptoAvailable', () => {
    it('returns true when Web Crypto is available', () => {
      expect(isCryptoAvailable()).toBe(true);
    });
  });

  describe('validatePassphraseComplexity', () => {
    it('rejects passphrases shorter than 8 characters', () => {
      const result = validatePassphraseComplexity('short');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8 characters');
    });

    it('rejects passphrases with only lowercase letters', () => {
      const result = validatePassphraseComplexity('alllowercase');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('2 of');
    });

    it('accepts passphrases with lowercase and numbers', () => {
      const result = validatePassphraseComplexity('lowercase123');
      expect(result.valid).toBe(true);
    });

    it('accepts passphrases with lowercase and uppercase', () => {
      const result = validatePassphraseComplexity('LowerUpper');
      expect(result.valid).toBe(true);
    });

    it('accepts passphrases with lowercase and special chars', () => {
      const result = validatePassphraseComplexity('lower!!!');
      expect(result.valid).toBe(true);
    });

    it('trims whitespace before validation', () => {
      const result = validatePassphraseComplexity('  TestPass123  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('session passphrase management', () => {
    it('initially has no session passphrase', () => {
      expect(hasSessionPassphrase()).toBe(false);
    });

    it('sets and checks session passphrase', () => {
      setSessionPassphrase(VALID_PASSPHRASE);
      expect(hasSessionPassphrase()).toBe(true);
    });

    it('clears session passphrase', () => {
      setSessionPassphrase(VALID_PASSPHRASE);
      clearSessionPassphrase();
      expect(hasSessionPassphrase()).toBe(false);
    });

    it('rejects passphrases shorter than 8 characters', () => {
      expect(() => setSessionPassphrase('short')).toThrow('8 characters');
    });

    it('rejects passphrases without enough character variety', () => {
      expect(() => setSessionPassphrase('alllowercase')).toThrow('2 of');
    });

    it('accepts valid passphrases', () => {
      expect(() => setSessionPassphrase(VALID_PASSPHRASE)).not.toThrow();
    });

    it('trims whitespace from passphrases', () => {
      setSessionPassphrase('  TestPass123  ');
      expect(hasSessionPassphrase()).toBe(true);
    });
  });

  describe('passphrase initialization', () => {
    it('creates verification token on first setup', async () => {
      expect(isPassphraseSetUp()).toBe(false);

      const result = await initializePassphrase(VALID_PASSPHRASE);
      expect(result).toBe(true);
      expect(isPassphraseSetUp()).toBe(true);
      expect(hasSessionPassphrase()).toBe(true);
    });

    it('verifies correct passphrase on subsequent unlocks', async () => {
      await initializePassphrase(VALID_PASSPHRASE);
      clearSessionPassphrase();

      const result = await initializePassphrase(VALID_PASSPHRASE);
      expect(result).toBe(true);
      expect(hasSessionPassphrase()).toBe(true);
    });

    it('rejects incorrect passphrase', async () => {
      await initializePassphrase(VALID_PASSPHRASE);
      clearSessionPassphrase();

      const result = await initializePassphrase(VALID_PASSPHRASE_ALT);
      expect(result).toBe(false);
      expect(hasSessionPassphrase()).toBe(false);
    });

    it('rejects passphrase shorter than 8 characters', async () => {
      await expect(initializePassphrase('short')).rejects.toThrow(
        '8 characters'
      );
    });

    it('rejects passphrase without complexity', async () => {
      await expect(initializePassphrase('alllowercase')).rejects.toThrow(
        '2 of'
      );
    });
  });

  describe('resetPassphrase', () => {
    it('clears verification token and session', async () => {
      await initializePassphrase(VALID_PASSPHRASE);
      expect(isPassphraseSetUp()).toBe(true);

      resetPassphrase();

      expect(isPassphraseSetUp()).toBe(false);
      expect(hasSessionPassphrase()).toBe(false);
    });
  });

  describe('security audit logging', () => {
    it('logs security events', async () => {
      await initializePassphrase(VALID_PASSPHRASE);
      const log = getSecurityAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.some(entry => entry.event === 'VAULT_CREATED')).toBe(true);
    });
  });

  describe('encryption and decryption', () => {
    beforeEach(async () => {
      await initializePassphrase(VALID_PASSPHRASE);
    });

    it('encrypts and decrypts an API key correctly', async () => {
      const apiKey = 'sk-test-1234567890abcdef';
      const encrypted = await encryptApiKey(apiKey);

      expect(encrypted).not.toBe(apiKey);
      expect(encrypted.length).toBeGreaterThan(apiKey.length);

      const decrypted = await decryptApiKey(encrypted);
      expect(decrypted).toBe(apiKey);
    });

    it('produces different ciphertext each time (due to random IV)', async () => {
      const apiKey = 'sk-test-1234567890abcdef';
      const encrypted1 = await encryptApiKey(apiKey);
      const encrypted2 = await encryptApiKey(apiKey);

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(await decryptApiKey(encrypted1)).toBe(apiKey);
      expect(await decryptApiKey(encrypted2)).toBe(apiKey);
    });

    it('throws when trying to encrypt without passphrase', async () => {
      clearSessionPassphrase();
      await expect(encryptApiKey('test')).rejects.toThrow('passphrase');
    });

    it('throws when trying to decrypt without passphrase', async () => {
      const encrypted = await encryptApiKey('test');
      clearSessionPassphrase();
      await expect(decryptApiKey(encrypted)).rejects.toThrow('passphrase');
    });

    it('fails to decrypt with wrong passphrase', async () => {
      const encrypted = await encryptApiKey('test');

      // Reset and set up with different passphrase
      resetPassphrase();
      await initializePassphrase(VALID_PASSPHRASE_ALT);

      await expect(decryptApiKey(encrypted)).rejects.toThrow();
    });

    it('handles special characters in API keys', async () => {
      const apiKey = 'sk-test_with-special=chars/and+more!@#$%';
      const encrypted = await encryptApiKey(apiKey);
      const decrypted = await decryptApiKey(encrypted);
      expect(decrypted).toBe(apiKey);
    });

    it('handles empty string', async () => {
      const encrypted = await encryptApiKey('');
      const decrypted = await decryptApiKey(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles unicode characters', async () => {
      const apiKey = 'テスト-api-key-🔑';
      const encrypted = await encryptApiKey(apiKey);
      const decrypted = await decryptApiKey(encrypted);
      expect(decrypted).toBe(apiKey);
    });
  });
});
