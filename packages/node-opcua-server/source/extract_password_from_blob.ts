/**
 * @module node-opcua-server
 */
import type { Nonce } from "node-opcua-crypto/web";

export interface ExtractPasswordResult {
    valid: boolean;
    password: string;
}

/**
 * Extract the password from a decrypted UserNameIdentityToken
 * password blob.
 *
 * The plaintext layout (OPC UA Part 4 §7.36.3) is:
 *
 *   ┌─────────────────┬──────────────┬──────────────┐
 *   │ UInt32 length    │ password     │ serverNonce  │
 *   │ (LE, 4 bytes)    │ (variable)   │ (32 bytes)   │
 *   └─────────────────┴──────────────┴──────────────┘
 *
 *  `length` = password.length + serverNonce.length
 *
 * After extracting the password, the trailing bytes **must**
 * equal the session's `serverNonce` to confirm nonce binding.
 *
 * @param decryptedBuffer - the RSA-decrypted blob
 * @param serverNonce     - the nonce that was sent during
 *                          CreateSession / last ActivateSession
 */
export function extractPasswordFromDecryptedBlob(decryptedBuffer: Buffer, serverNonce: Nonce): ExtractPasswordResult {
    const invalidResult: ExtractPasswordResult = {
        valid: false,
        password: ""
    };

    // need at least 4 bytes for the length field
    if (!decryptedBuffer || decryptedBuffer.length < 4) {
        return invalidResult;
    }

    const totalLength = decryptedBuffer.readUInt32LE(0);
    const passwordLength = totalLength - serverNonce.length;

    // bounds check: password length must be non-negative
    // and the buffer must be large enough
    if (passwordLength < 0) {
        return invalidResult;
    }

    const expectedBufferSize = 4 + passwordLength + serverNonce.length;
    if (decryptedBuffer.length < expectedBufferSize) {
        return invalidResult;
    }

    const password = decryptedBuffer.subarray(4, 4 + passwordLength).toString("utf-8");

    // verify that the trailing bytes match the server nonce
    // (nonce binding — ensures session integrity)
    const trailingNonce = decryptedBuffer.subarray(4 + passwordLength, 4 + passwordLength + serverNonce.length);
    if (!trailingNonce.equals(serverNonce)) {
        return invalidResult;
    }

    return { valid: true, password };
}
