/**
 * Disk-backed certificate/key provider.
 *
 * Reads certificate chains and private keys lazily from the filesystem
 * and caches them in `#`-private fields so they never appear in
 * `JSON.stringify`, `console.log`, `util.inspect`, or debugger panels.
 *
 * @module node-opcua-common
 */
import fs from "node:fs";
import { readCertificateChain, readPrivateKey } from "node-opcua-crypto";
import type { Certificate, PrivateKey } from "node-opcua-crypto/web";

import type { ICertificateChainProvider } from "./certificate_chain_provider";
import type { ICertificateKeyPairProviderWithLocation } from "./opcua_secure_object";

export class DiskCertificateKeyPairProvider implements ICertificateChainProvider, ICertificateKeyPairProviderWithLocation {
    #certificateChain: Certificate[] | null = null;
    #privateKey: PrivateKey | null = null;
    readonly #certificateFile: string;
    readonly #privateKeyFile: string;

    constructor(certificateFile: string, privateKeyFile: string) {
        this.#certificateFile = certificateFile;
        this.#privateKeyFile = privateKeyFile;
    }

    public get certificateFile(): string {
        return this.#certificateFile;
    }

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
        if (!this.#privateKey) {
            if (!fs.existsSync(this.#privateKeyFile)) {
                throw new Error(`Private key file not found: ${this.#privateKeyFile}`);
            }
            const key = readPrivateKey(this.#privateKeyFile);
            if (key instanceof Buffer) {
                throw new Error(`Invalid private key ${this.#privateKeyFile}. Should not be a buffer`);
            }
            this.#privateKey = key;
        }
        return this.#privateKey;
    }

    /**
     * Clears cached secrets so the GC can reclaim sensitive material.
     * After calling dispose the holder will re-read from disk on next access.
     */
    public dispose(): void {
        this.#certificateChain = null;
        this.#privateKey = null;
    }

    /**
     * Alias for {@link dispose}.
     * Implements `ICertificateChainProvider.invalidate()`.
     */
    public invalidate(): void {
        this.dispose();
    }

    // Prevent secrets from leaking through JSON serialization
    public toJSON(): Record<string, string> {
        return {
            provider: "DiskCertificateKeyPairProvider",
            certificateFile: this.#certificateFile,
            privateKeyFile: this.#privateKeyFile
        };
    }

    // Prevent secrets from leaking through console.log / util.inspect
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return `DiskCertificateKeyPairProvider { certificateFile: "${this.#certificateFile}", privateKeyFile: "${this.#privateKeyFile}" }`;
    }
}
