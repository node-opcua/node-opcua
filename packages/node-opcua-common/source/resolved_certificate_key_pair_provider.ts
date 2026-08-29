/**
 * Certificate/key provider for a private key that has already been
 * resolved asynchronously (e.g. decrypted from an encrypted PKCS#8 file
 * via `OPCUACertificateManager.getPrivateKey()`).
 *
 * The certificate chain is still read lazily from disk (same behavior as
 * {@link DiskCertificateKeyPairProvider}, including re-read on
 * `invalidate()`) so that certificate rotation keeps working. The private
 * key, however, is held in memory as-provided: it is never re-read from
 * disk by this provider, since doing so would require an async decrypt
 * that the synchronous `getPrivateKey()` contract cannot perform. Callers
 * that rotate the private key must construct a new instance (with the
 * newly resolved key) and install it via `setProvider()` /
 * `setCertificateProvider()`.
 *
 * @module node-opcua-common
 */
import fs from "node:fs";
import { readCertificateChain } from "node-opcua-crypto";
import type { Certificate, IKeyOperations, PrivateKey } from "node-opcua-crypto/web";

import type { ICertificateChainProvider } from "./certificate_chain_provider.js";
import { localKeyOperationsOfProvider } from "./local_key_operations_provider.js";
import type { ICertificateKeyPairProvider2, ICertificateKeyPairProviderWithLocation } from "./opcua_secure_object.js";

export class ResolvedCertificateKeyPairProvider
    implements ICertificateChainProvider, ICertificateKeyPairProviderWithLocation, ICertificateKeyPairProvider2
{
    #certificateChain: Certificate[] | null = null;
    readonly #certificateFile: string;
    readonly #privateKeyFile: string;
    readonly #privateKey: PrivateKey;

    constructor(certificateFile: string, privateKeyFile: string, privateKey: PrivateKey) {
        this.#certificateFile = certificateFile;
        this.#privateKeyFile = privateKeyFile;
        this.#privateKey = privateKey;
    }

    public get certificateFile(): string {
        return this.#certificateFile;
    }

    /** Real path of the private key file (needed by push-management, even though the key itself is held in memory). */
    public get privateKeyFile(): string {
        return this.#privateKeyFile;
    }

    public getCertificate(): Certificate {
        return this.getCertificateChain()[0];
    }

    public getCertificateChain(): Certificate[] {
        if (!this.#certificateChain) {
            if (!fs.existsSync(this.#certificateFile)) {
                throw new Error(`Certificate file not found: ${this.#certificateFile}`);
            }
            const chain = readCertificateChain(this.#certificateFile);
            if (!chain || chain.length === 0) {
                throw new Error(`Invalid certificate chain (length=0) ${this.#certificateFile}`);
            }
            this.#certificateChain = chain;
        }
        return this.#certificateChain;
    }

    public getPrivateKey(): PrivateKey {
        return this.#privateKey;
    }

    /** The key as an opaque sign/decrypt object — see {@link localKeyOperationsOfProvider}. */
    public getKeyOperations(): IKeyOperations {
        return localKeyOperationsOfProvider(this);
    }

    /**
     * Re-reads the certificate chain from disk on next access. The
     * in-memory private key is untouched — construct a new provider to
     * rotate the key (see class doc).
     */
    public invalidate(): void {
        this.#certificateChain = null;
    }

    // Prevent secrets from leaking through JSON serialization
    public toJSON(): Record<string, string> {
        return {
            provider: "ResolvedCertificateKeyPairProvider",
            certificateFile: this.#certificateFile,
            privateKeyFile: this.#privateKeyFile
        };
    }

    // Prevent secrets from leaking through console.log / util.inspect
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return `ResolvedCertificateKeyPairProvider { certificateFile: "${this.#certificateFile}", privateKeyFile: "${this.#privateKeyFile}" }`;
    }
}
