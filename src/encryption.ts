/*****************************************************************************
 * @file        : encryption.ts
 * @description : Note Lock plugin's encryption/decryption logic.
 *****************************************************************************/

import * as crypto from 'crypto';

export interface CipherOptions {
    /** AES key size in bits. Allowed values: 128, 192, 256. Default: 256 */
    AeskeySize?: 128 | 192 | 256;
    /** AES AesMode. Allowed values: 'cbc', 'ctr', 'gcm'. Default: 'gcm' */
    AesMode?: "cbc" | "ctr" | "gcm";
}

/**
 * Encrypts a plaintext string using AES with a password-derived key.
 * Supports flexible key sizes (128, 192, 256) and AesModes (cbc, ctr, gcm).
 *
 * Format of output: Base64(salt + iv + tag + ciphertext)
 * - salt: 16 bytes
 * - iv: 12 bytes for GCM, 16 bytes for CBC/CTR
 * - tag: 16 bytes for GCM, empty for CBC/CTR
 * - ciphertext: variable length
 *
 * @param body - Plaintext string to encrypt
 * @param passwd - Password used to derive encryption key via PBKDF2
 * @param options - Optional encryption settings (keySize and AesMode)
 * @returns Base64-encoded encrypted string
 */
export function encryptData(
    body: string,
    passwd: string,
    options: CipherOptions = {}
): string {
    const keySize = options.AeskeySize || 256;
    const AesMode = options.AesMode || "gcm";
    const algorithm = `aes-${keySize}-${AesMode}`;

    // Generate random 16-byte salt for key derivation
    const salt = crypto.randomBytes(16);

    // Derive key from password + salt using PBKDF2 with SHA-256
    const key = crypto.pbkdf2Sync(passwd, salt, 100_000, keySize / 8, "sha256");

    // Determine IV length: 12 bytes for GCM, 16 for CBC/CTR
    const ivLength = AesMode === "gcm" ? 12 : 16;
    const iv = crypto.randomBytes(ivLength);

    // AEAD AesMode options (authTagLength) only for GCM
    const cipherOptions: crypto.CipherGCMOptions = {};
    if (AesMode === "gcm") cipherOptions.authTagLength = 16;

    const cipher = crypto.createCipheriv(algorithm, key, iv, cipherOptions);

    // Encrypt plaintext
    const encrypted = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);

    // Authentication tag for GCM; empty for CBC/CTR
    const tag = AesMode === "gcm" ? (cipher as crypto.CipherGCM).getAuthTag() : Buffer.alloc(0);

    // Concatenate salt + iv + tag + ciphertext and encode as Base64
    return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts a Base64-encoded string produced by encryptData.
 *
 * Automatically extracts salt, IV, and tag (if GCM AesMode) to reconstruct the key.
 *
 * @param encryptedBase64 - Base64 string produced by encryptData
 * @param passwd - Password used to derive decryption key (must match encryption)
 * @param options - Optional decryption settings (keySize and AesMode; must match encryption)
 * @returns Decrypted plaintext string
 */
export function decryptData(
    encryptedBase64: string,
    passwd: string,
    options: CipherOptions = {}
): string {
    const keySize = options.AeskeySize || 256;
    const AesMode = options.AesMode || "gcm";
    const algorithm = `aes-${keySize}-${AesMode}`;

    const encryptedBuffer = Buffer.from(encryptedBase64, "base64");

    // Extract salt and IV
    const salt = encryptedBuffer.subarray(0, 16); // use subarray instead of slice
    const ivLength = AesMode === "gcm" ? 12 : 16;
    const iv = encryptedBuffer.subarray(16, 16 + ivLength);

    // Extract tag and ciphertext
    let tag: Buffer;
    let ciphertext: Buffer;
    if (AesMode === "gcm") {
        tag = encryptedBuffer.subarray(16 + ivLength, 16 + ivLength + 16);
        ciphertext = encryptedBuffer.subarray(16 + ivLength + 16);
    } else {
        tag = Buffer.alloc(0);
        ciphertext = encryptedBuffer.subarray(16 + ivLength);
    }

    // Derive key from password + salt using PBKDF2 with SHA-256
    const key = crypto.pbkdf2Sync(passwd, salt, 100_000, keySize / 8, "sha256");

    // Options for GCM
    const decipherOptions: crypto.CipherGCMOptions = {};
    if (AesMode === "gcm") decipherOptions.authTagLength = 16;

    const decipher = crypto.createDecipheriv(algorithm, key, iv, decipherOptions);

    // Set GCM authentication tag if needed
    if (AesMode === "gcm") (decipher as crypto.DecipherGCM).setAuthTag(tag);

    // Decrypt ciphertext
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString("utf8");
}

