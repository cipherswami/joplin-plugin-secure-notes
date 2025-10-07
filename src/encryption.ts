/*****************************************************************************
 * @file        : encryption.ts
 * @description : AES encryption with Webcrypto.
 *****************************************************************************/

/**
 * Cipher options for the encryption
 * @interface
 */
export interface AesOptions {
    /** 
     * AES key size in bits. Allowed values: 128, 256. 
     * NOTE: 192-bit is not supported by mobile compatible WebCrypto.
     * @default 256
     */
    KeySize?: 128 | 256;

    /** 
     * AES Mode. Allowed values: 'AES-CBC', 'AES-CTR', 'AES-GCM'. 
     * @default 'AES-GCM'
     */
    AesMode?: "AES-CBC" | "AES-CTR" | "AES-GCM";
}

/**
 * Derives a CryptoKey from a password using PBKDF2.
 * 
 * @param password - The user-provided password.
 * @param salt - A unique salt (Uint8Array) used in key derivation.
 * @param keySize - AES key size in bits (128 or 256).
 * @param aesMode - AES algorithm mode ('AES-CBC', 'AES-CTR', 'AES-GCM').
 * @returns A Promise that resolves to a CryptoKey for AES encryption/decryption.
 * @throws DOMException if key derivation fails or invalid parameters are provided.
 */
export async function pbdkf2(
    password: string,
    salt: Uint8Array,
    keySize: number,
    aesMode: string
): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt.buffer as ArrayBuffer,
            iterations: 100_000,
            hash: "SHA-256"
        },
        keyMaterial,
        keySize
    );

    return crypto.subtle.importKey(
        "raw",
        derivedBits,
        { name: aesMode },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Derives an HMAC key from a password for message authentication.
 * Used for CBC and CTR modes.
 * 
 * @param password - The user-provided password.
 * @param salt - A unique salt (Uint8Array) used in key derivation.
 * @returns A Promise that resolves to a CryptoKey for HMAC signing and verification.
 * @throws DOMException if key derivation fails or invalid parameters are provided.
 */
export async function deriveHmacKey(
    password: string,
    salt: Uint8Array
): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt.buffer as ArrayBuffer,
            iterations: 100_000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    return crypto.subtle.importKey(
        "raw",
        derivedBits,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

/**
 * Converts a Uint8Array to a Base64 string.
 * 
 * @param buffer - Input Uint8Array.
 * @returns Base64-encoded string.
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
}

/**
 * Converts a Base64 string to a Uint8Array.
 * 
 * @param base64 - Base64-encoded string.
 * @returns Decoded Uint8Array.
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encrypts plaintext using AES with a password-derived key.
 * Supports AES-GCM, AES-CBC, and AES-CTR.
 * 
 * @param body - The plaintext string to encrypt.
 * @param passwd - Password used to derive the encryption key.
 * @param options - AES options including KeySize and AesMode.
 * @returns Base64 string containing salt + IV + tag + ciphertext.
 * @throws DOMException if encryption fails.
 */
export async function encryptData(
    body: string,
    passwd: string,
    options: AesOptions = {}
): Promise<string> {
    const keySize = options.KeySize || 256;
    const aesMode = options.AesMode || "AES-GCM";

    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const key = await pbdkf2(passwd, salt, keySize, aesMode);

    const ivLength = aesMode === "AES-GCM" ? 12 : 16;
    const iv = new Uint8Array(ivLength);
    crypto.getRandomValues(iv);

    const encoder = new TextEncoder();
    const plaintext = encoder.encode(body);

    let encryptedData: Uint8Array;
    let tag: Uint8Array;

    if (aesMode === "AES-GCM") {
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 },
            key,
            plaintext
        );
        const encryptedArray = new Uint8Array(encrypted);

        tag = encryptedArray.slice(-16);
        encryptedData = encryptedArray.slice(0, -16);
    } else {
        let encrypted: ArrayBuffer;

        if (aesMode === "AES-CTR") {
            encrypted = await crypto.subtle.encrypt(
                { name: "AES-CTR", counter: iv.buffer as ArrayBuffer, length: 64 },
                key,
                plaintext
            );
        } else {
            encrypted = await crypto.subtle.encrypt(
                { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
                key,
                plaintext
            );
        }

        encryptedData = new Uint8Array(encrypted);

        const hmacKey = await deriveHmacKey(passwd, salt);

        const dataToAuth = new Uint8Array(salt.length + iv.length + encryptedData.length);
        dataToAuth.set(salt, 0);
        dataToAuth.set(iv, salt.length);
        dataToAuth.set(encryptedData, salt.length + iv.length);

        const hmacSignature = await crypto.subtle.sign(
            "HMAC",
            hmacKey,
            dataToAuth.buffer as ArrayBuffer
        );

        tag = new Uint8Array(hmacSignature);
    }

    const result = new Uint8Array(salt.length + iv.length + tag.length + encryptedData.length);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(tag, salt.length + iv.length);
    result.set(encryptedData, salt.length + iv.length + tag.length);

    return arrayBufferToBase64(result);
}

/**
 * Decrypts Base64 string produced by encryptData.
 * Supports AES-GCM, AES-CBC, and AES-CTR.
 * 
 * @param encryptedBase64 - Base64 string containing salt + IV + tag + ciphertext.
 * @param passwd - Password used to derive the encryption key.
 * @param options - AES options including KeySize and AesMode.
 * @returns Decrypted plaintext string.
 * @throws Error if password is incorrect or HMAC verification fails.
 * @throws DOMException if decryption fails.
 */
export async function decryptData(
    encryptedBase64: string,
    passwd: string,
    options: AesOptions = {}
): Promise<string> {
    const keySize = options.KeySize || 256;
    const aesMode = options.AesMode || "AES-GCM";

    const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);

    const salt = new Uint8Array(encryptedBuffer.slice(0, 16));
    const ivLength = aesMode === "AES-GCM" ? 12 : 16;
    const iv = new Uint8Array(encryptedBuffer.slice(16, 16 + ivLength));

    const tagLength = aesMode === "AES-GCM" ? 16 : 32;
    const tag = new Uint8Array(encryptedBuffer.slice(16 + ivLength, 16 + ivLength + tagLength));
    const ciphertext = new Uint8Array(encryptedBuffer.slice(16 + ivLength + tagLength));

    const key = await pbdkf2(passwd, salt, keySize, aesMode);

    let decrypted: ArrayBuffer;

    if (aesMode === "AES-GCM") {
        const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
        ciphertextWithTag.set(ciphertext, 0);
        ciphertextWithTag.set(tag, ciphertext.length);

        decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 },
            key,
            ciphertextWithTag.buffer as ArrayBuffer
        );
    } else {
        const hmacKey = await deriveHmacKey(passwd, salt);

        const dataToVerify = new Uint8Array(salt.length + iv.length + ciphertext.length);
        dataToVerify.set(salt, 0);
        dataToVerify.set(iv, salt.length);
        dataToVerify.set(ciphertext, salt.length + iv.length);

        const isValid = await crypto.subtle.verify(
            "HMAC",
            hmacKey,
            tag.buffer as ArrayBuffer,
            dataToVerify.buffer as ArrayBuffer
        );

        if (!isValid) {
            throw new Error("Invalid password, HMAC verification failed");
        }

        if (aesMode === "AES-CTR") {
            decrypted = await crypto.subtle.decrypt(
                { name: "AES-CTR", counter: iv.buffer as ArrayBuffer, length: 64 },
                key,
                ciphertext.buffer as ArrayBuffer
            );
        } else {
            decrypted = await crypto.subtle.decrypt(
                { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
                key,
                ciphertext.buffer as ArrayBuffer
            );
        }
    }

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}
