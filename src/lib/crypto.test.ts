import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
} from './crypto';

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

  describe('session passphrase management', () => {
    it('initially has no session passphrase', () => {
      expect(hasSessionPassphrase()).toBe(false);
    });

    it('sets and checks session passphrase', () => {
      setSessionPassphrase('testpassphrase');
      expect(hasSessionPassphrase()).toBe(true);
    });

    it('clears session passphrase', () => {
      setSessionPassphrase('testpassphrase');
      clearSessionPassphrase();
      expect(hasSessionPassphrase()).toBe(false);
    });

    it('rejects passphrases shorter than 8 characters', () => {
      expect(() => setSessionPassphrase('short')).toThrow('Passphrase must be at least 8 characters');
    });

    it('accepts passphrases with exactly 8 characters', () => {
      expect(() => setSessionPassphrase('12345678')).not.toThrow();
    });
  });

  describe('passphrase initialization', () => {
    it('creates verification token on first setup', async () => {
      expect(isPassphraseSetUp()).toBe(false);

      const result = await initializePassphrase('testpassphrase');
      expect(result).toBe(true);
      expect(isPassphraseSetUp()).toBe(true);
      expect(hasSessionPassphrase()).toBe(true);
    });

    it('verifies correct passphrase on subsequent unlocks', async () => {
      await initializePassphrase('testpassphrase');
      clearSessionPassphrase();

      const result = await initializePassphrase('testpassphrase');
      expect(result).toBe(true);
      expect(hasSessionPassphrase()).toBe(true);
    });

    it('rejects incorrect passphrase', async () => {
      await initializePassphrase('testpassphrase');
      clearSessionPassphrase();

      const result = await initializePassphrase('wrongpassphrase');
      expect(result).toBe(false);
      expect(hasSessionPassphrase()).toBe(false);
    });

    it('rejects passphrase shorter than 8 characters', async () => {
      await expect(initializePassphrase('short')).rejects.toThrow(
        'Passphrase must be at least 8 characters'
      );
    });
  });

  describe('resetPassphrase', () => {
    it('clears verification token and session', async () => {
      await initializePassphrase('testpassphrase');
      expect(isPassphraseSetUp()).toBe(true);

      resetPassphrase();

      expect(isPassphraseSetUp()).toBe(false);
      expect(hasSessionPassphrase()).toBe(false);
    });
  });

  describe('encryption and decryption', () => {
    beforeEach(async () => {
      await initializePassphrase('testpassphrase');
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
      await initializePassphrase('differentpass');

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
