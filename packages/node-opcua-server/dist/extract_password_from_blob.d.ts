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
export declare function extractPasswordFromDecryptedBlob(decryptedBuffer: Buffer, serverNonce: Nonce): ExtractPasswordResult;
//# sourceMappingURL=extract_password_from_blob.d.ts.map