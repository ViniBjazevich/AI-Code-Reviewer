import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypts a sensitive string (e.g. a GitHub access token) with AES-256-GCM.
 * Returns `iv:authTag:ciphertext`, all hex-encoded, suitable for storing in a text column.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Decrypts a string produced by `encryptSecret`. */
export function decryptSecret(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted secret");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
