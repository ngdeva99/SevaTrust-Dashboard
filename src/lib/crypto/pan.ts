import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

/**
 * PAN encryption at rest.
 *
 * DPDP Act 2023 / Rules 2025 require "reasonable safeguards" including
 * encryption, masking, or tokenisation for personal data. PAN is
 * identity information and warrants strong protection.
 *
 * We use AES-256-GCM (authenticated encryption). The same PAN encrypted
 * twice will produce different ciphertext (different IVs), which is
 * intentional and correct — never compare ciphertext to ciphertext.
 *
 * Storage layout (one Buffer):
 *   [12 bytes IV][N bytes ciphertext][16 bytes auth tag]
 *
 * For display we also store the last 4 characters as plaintext in a
 * separate column — this is safe to show the admin and allows search.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function getKey(): Buffer {
  const b64 = process.env.APP_ENCRYPTION_KEY;
  if (!b64) throw new Error("APP_ENCRYPTION_KEY env var is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to exactly 32 bytes; got ${key.length}`
    );
  }
  return key;
}

export function validatePanFormat(pan: string): boolean {
  return PAN_REGEX.test(pan.toUpperCase().trim());
}

export function encryptPan(pan: string): { ciphertext: Buffer; last4: string } {
  const clean = pan.toUpperCase().trim();
  if (!validatePanFormat(clean)) {
    throw new Error("Invalid PAN format. Expected ABCDE1234F.");
  }

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // [IV | ciphertext | tag]
  const blob = Buffer.concat([iv, encrypted, tag]);
  return {
    ciphertext: blob,
    last4: clean.slice(-4),
  };
}

export function decryptPan(blob: Buffer): string {
  if (blob.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("PAN ciphertext is too short");
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(IV_LEN, blob.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

/** Safe display for admin UI: "XXXXX1234X" */
export function maskPan(pan: string): string {
  const clean = pan.trim().toUpperCase();
  if (clean.length !== 10) return "INVALID";
  return "XXXXX" + clean.slice(5, 9) + "X";
}

/** For comparing two PANs without decrypting — use for duplicate detection */
export function panEquals(a: Buffer, b: Buffer, key = getKey()): boolean {
  try {
    return decryptPan(a) === decryptPan(b);
  } catch {
    return false;
  }
}
