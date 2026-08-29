/**
 * Certificate/key provider for an OPAQUE private key: one held by an
 * {@link IKeyOperations} implementation (HSM, KMS, TPM, OS keystore) and
 * deliberately not obtainable as material.
 *
 * The certificate chain is read lazily from disk with re-read on
 * `invalidate()` (same behavior as {@link ResolvedCertificateKeyPairProvider},
 * so certificate rotation keeps working), while `getPrivateKey()` throws
 * `PrivateKeyUnavailableError` — code that needs the key goes through
 * {@link getKeyOperations} instead.
 *
 * The provider also carries the key facts that synchronous code paths need
 * before any operation — {@link keyMetadata}, and the SPKI public key when
 * the ops object can produce it — prefetched once, asynchronously, by
 * whoever constructs the provider (see `resolvePrivateKeyProviderIfNeeded`).
 *
 * @module node-opcua-common
 */
import fs from "node:fs";
// PrivateKeyUnavailableError is a runtime class consumers instanceof-check:
// import it from the same entry point the rest of node-opcua uses, so there
// is only ever one class identity in play.
import { PrivateKeyUnavailableError, readCertificateChain } from "node-opcua-crypto";
import type { Certificate, IKeyOperations, KeyMetadata, PrivateKey } from "node-opcua-crypto/web";

import type { ICertificateChainProvider } from "./certificate_chain_provider.js";
import type { ICertificateKeyPairProvider2, ICertificateKeyPairProviderWithLocation } from "./opcua_secure_object.js";

export interface OpaqueCertificateKeyPairProviderOptions {
    certificateFile: string;
    keyOperations: IKeyOperations;
    /** Prefetched once at construction time so synchronous callers never need to await it. */
    keyMetadata: KeyMetadata;
    /** The key's public half, SPKI DER — present when the ops object implements `getPublicKey`. */
    publicKey?: ArrayBuffer;
}

export class OpaqueCertificateKeyPairProvider
    implements ICertificateChainProvider, ICertificateKeyPairProviderWithLocation, ICertificateKeyPairProvider2
{
    #certificateChain: Certificate[] | null = null;
    readonly #certificateFile: string;
    readonly #keyOperations: IKeyOperations;
    readonly #keyMetadata: KeyMetadata;
    readonly #publicKey?: ArrayBuffer;

    constructor(options: OpaqueCertificateKeyPairProviderOptions) {
        this.#certificateFile = options.certificateFile;
        this.#keyOperations = options.keyOperations;
        this.#keyMetadata = options.keyMetadata;
        this.#publicKey = options.publicKey;
    }

    public get certificateFile(): string {
        return this.#certificateFile;
    }

    /** There is no key file: the key lives inside the ops provider. */
    public get privateKeyFile(): string {
        return "<opaque>";
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
        throw new PrivateKeyUnavailableError(
            "this application's private key is opaque (HSM/KMS-held): use getKeyOperations() instead of getPrivateKey()"
        );
    }

    public getKeyOperations(): IKeyOperations {
        return this.#keyOperations;
    }

    /** The key facts, prefetched at construction — synchronous by design. */
    public getKeyMetadata(): KeyMetadata {
        return this.#keyMetadata;
    }

    /** The key's public half (SPKI DER), when the ops object could produce it. */
    public getPublicKeySpki(): ArrayBuffer | undefined {
        return this.#publicKey;
    }

    /** Re-reads the certificate chain from disk on next access; the ops object and metadata are untouched. */
    public invalidate(): void {
        this.#certificateChain = null;
    }

    // Prevent anything key-related from leaking through JSON serialization
    public toJSON(): Record<string, string> {
        return {
            provider: "OpaqueCertificateKeyPairProvider",
            certificateFile: this.#certificateFile,
            privateKeyFile: this.privateKeyFile
        };
    }

    // Prevent anything key-related from leaking through console.log / util.inspect
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return `OpaqueCertificateKeyPairProvider { certificateFile: "${this.#certificateFile}" }`;
    }
}
