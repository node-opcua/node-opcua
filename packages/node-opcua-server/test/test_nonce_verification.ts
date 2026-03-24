import "should";
import { randomBytes } from "node:crypto";

import {
    extractPasswordFromDecryptedBlob
} from "../dist/extract_password_from_blob";

/**
 * Build a valid password blob as OPC UA clients produce it:
 *
 *   ┌─────────────────┬──────────────┬──────────────┐
 *   │ UInt32 length   │ password     │ serverNonce  │
 *   │ (LE, 4 bytes)   │ (variable)   │ (32 bytes)   │
 *   └─────────────────┴──────────────┴──────────────┘
 */
function buildPasswordBlob(
    password: string,
    serverNonce: Buffer
): Buffer {
    const passwordBuf = Buffer.from(password, "utf-8");
    const length = passwordBuf.length + serverNonce.length;
    const header = Buffer.alloc(4);
    header.writeUInt32LE(length, 0);
    return Buffer.concat([header, passwordBuf, serverNonce]);
}

describe("extractPasswordFromDecryptedBlob", () => {
    const serverNonce = randomBytes(32);

    it("should extract password from a valid blob", () => {
        const blob = buildPasswordBlob("s3cret!", serverNonce);
        const result = extractPasswordFromDecryptedBlob(blob, serverNonce);
        result.valid.should.eql(true);
        result.password.should.eql("s3cret!");
    });

    it("should handle empty password with valid nonce", () => {
        const blob = buildPasswordBlob("", serverNonce);
        const result = extractPasswordFromDecryptedBlob(blob, serverNonce);
        result.valid.should.eql(true);
        result.password.should.eql("");
    });

    it("should handle UTF-8 password with valid nonce", () => {
        const blob = buildPasswordBlob("pässwörd€", serverNonce);
        const result = extractPasswordFromDecryptedBlob(blob, serverNonce);
        result.valid.should.eql(true);
        result.password.should.eql("pässwörd€");
    });

    it("should reject a blob with no data", () => {
        const result = extractPasswordFromDecryptedBlob(
            Buffer.alloc(0),
            serverNonce
        );
        result.valid.should.eql(false);
    });

    it("should reject a blob that is too short", () => {
        const result = extractPasswordFromDecryptedBlob(
            Buffer.alloc(3),
            serverNonce
        );
        result.valid.should.eql(false);
    });

    // ---------------------------------------------------------------
    // Nonce verification: ensures the token is bound to the session.
    // ---------------------------------------------------------------
    it("should reject a blob with a mismatched nonce", () => {
        // Build a blob with a different nonce than the session's
        const differentNonce = randomBytes(32);
        const blob = buildPasswordBlob("admin", differentNonce);
        const result = extractPasswordFromDecryptedBlob(blob, serverNonce);

        // This should be rejected because the trailing nonce
        // does not match the session's serverNonce.
        result.valid.should.eql(false,
            "blob with mismatched nonce should be rejected");
    });

    it("should reject a truncated blob (length = nonceLen, no trailing nonce)", () => {
        // Blob with length field = serverNonce.length (32)
        // but no actual trailing nonce bytes
        const header = Buffer.alloc(4);
        header.writeUInt32LE(serverNonce.length, 0);
        const blob = Buffer.concat([header, Buffer.alloc(0)]);

        const result = extractPasswordFromDecryptedBlob(blob, serverNonce);

        // This should be rejected — missing trailing nonce bytes.
        result.valid.should.eql(false,
            "truncated blob should be rejected");
    });
});
