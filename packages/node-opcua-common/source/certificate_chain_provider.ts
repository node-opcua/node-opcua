/**
 * Pluggable certificate chain provider for OPC UA endpoints.
 *
 * Abstracts how an endpoint obtains its certificate chain and private key,
 * allowing both static (in-memory) and dynamic (disk-based) strategies
 * without monkey-patching.
 *
 * @module node-opcua-common
 */
import type { Certificate, PrivateKey } from "node-opcua-crypto/web";

import type { ICertificateKeyPairProvider, ICertificateKeyPairProviderWithLocation } from "./opcua_secure_object";

/**
 * Provides a certificate chain and private key to an OPC UA endpoint.
 *
 * Implementations may read from memory, disk, or any other source.
 * See also {@link DiskCertificateKeyPairProvider} which implements this
 * interface for disk-based access with lazy caching.
 */
export interface ICertificateChainProvider extends ICertificateKeyPairProvider {
    /**
     * Invalidate any cached values so the next access re-reads
     * from the underlying source. No-op for static providers.
     */
    invalidate(): void;
}

/**
 * Holds a certificate chain and private key in memory.
 *
 * Used as the default provider when push certificate management
 * is NOT installed. The chain can be replaced in-place via `update()`.
 */
export class StaticCertificateChainProvider implements ICertificateChainProvider, ICertificateKeyPairProviderWithLocation {
    #chain: Certificate[];
    #key: PrivateKey;

    constructor(chain: Certificate[], key: PrivateKey) {
        this.#chain = chain;
        this.#key = key;
    }

    public get certificateFile(): string {
        return "<in-memory>";
    }

    public get privateKeyFile(): string {
        return "<in-memory>";
    }

    public getCertificate(): Certificate {
        return this.#chain[0];
    }

    public getCertificateChain(): Certificate[] {
        return this.#chain;
    }

    public getPrivateKey(): PrivateKey {
        return this.#key;
    }

    /**
     * No-op for static provider — the chain is already in memory.
     * Use `update()` to replace the chain explicitly.
     */
    public invalidate(): void {
        // nothing to invalidate for a static provider
    }

    /**
     * Replace the certificate chain and optionally the private key.
     *
     * This immediately affects all consumers that call
     * `getCertificateChain()` on this provider (including
     * endpoint descriptions with dynamic `serverCertificate` getters).
     */
    public update(chain: Certificate[], key?: PrivateKey): void {
        if (chain.length === 0) {
            throw new Error("StaticCertificateChainProvider.update: chain must not be empty");
        }
        this.#chain = chain;
        if (key !== undefined) {
            this.#key = key;
        }
    }

    // Prevent secrets from leaking through JSON serialization
    public toJSON(): Record<string, string> {
        return { provider: "StaticCertificateChainProvider" };
    }

    // Prevent secrets from leaking through console.log / util.inspect
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return "StaticCertificateChainProvider { <in-memory> }";
    }
}
