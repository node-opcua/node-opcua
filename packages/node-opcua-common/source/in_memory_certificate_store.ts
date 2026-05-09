/**
 * In-memory certificate trust store.
 *
 * Manages trust/rejection using `Set<thumbprint>` — no disk,
 * no file watchers, no PKI folder structure.
 *
 * @module node-opcua-common
 */
import { type Certificate, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";

import type { ICertificateStore } from "./i_certificate_store";

export interface InMemoryCertificateStoreOptions {
    /**
     * When `true`, unknown certificates are automatically
     * trusted on first encounter (like the disk-based
     * `automaticallyAcceptUnknownCertificate` flag).
     *
     * @defaultValue true
     */
    autoAcceptUnknown?: boolean;
}

function thumbprint(certificate: Certificate | Certificate[]): string {
    const cert = Array.isArray(certificate) ? certificate[0] : certificate;
    return makeSHA1Thumbprint(cert).toString("hex");
}

export class InMemoryCertificateStore implements ICertificateStore {
    #trusted = new Set<string>();
    #rejected = new Set<string>();
    #issuers = new Set<string>();
    #crls = new Set<string>();
    #autoAccept: boolean;

    public referenceCounter = 0;

    constructor(options?: InMemoryCertificateStoreOptions) {
        this.#autoAccept = options?.autoAcceptUnknown ?? true;
    }

    public async initialize(): Promise<void> {
        /* no-op */
    }

    public async dispose(): Promise<void> {
        if (this.referenceCounter > 0) {
            this.referenceCounter--;
            if (this.referenceCounter > 0) {
                return;
            }
        }
        this.#trusted.clear();
        this.#rejected.clear();
        this.#issuers.clear();
        this.#crls.clear();
    }

    public async checkCertificate(
        certificate: Certificate | Certificate[]
    ): Promise<StatusCode> {
        const tp = thumbprint(certificate);

        if (this.#trusted.has(tp)) {
            return StatusCodes.Good;
        }
        if (this.#rejected.has(tp)) {
            return StatusCodes.BadCertificateUntrusted;
        }
        // Unknown certificate
        if (this.#autoAccept) {
            this.#trusted.add(tp);
            return StatusCodes.Good;
        }
        this.#rejected.add(tp);
        return StatusCodes.BadCertificateUntrusted;
    }

    public async verifyCertificate(
        certificate: Certificate | Certificate[],
        _options?: { acceptOutdatedCertificate?: boolean }
    ): Promise<string> {
        const tp = thumbprint(certificate);
        if (this.#trusted.has(tp)) {
            return "Good";
        }
        if (this.#rejected.has(tp)) {
            return "BadCertificateUntrusted";
        }
        // Unknown certificate
        if (this.#autoAccept) {
            this.#trusted.add(tp);
            return "Good";
        }
        return "BadCertificateUntrusted";
    }

    public async trustCertificate(
        certificate: Certificate | Certificate[]
    ): Promise<void> {
        const tp = thumbprint(certificate);
        this.#rejected.delete(tp);
        this.#trusted.add(tp);
    }

    public async rejectCertificate(
        certificate: Certificate | Certificate[]
    ): Promise<void> {
        const tp = thumbprint(certificate);
        this.#trusted.delete(tp);
        this.#rejected.add(tp);
    }

    public async getTrustStatus(
        certificate: Certificate
    ): Promise<StatusCode> {
        const tp = thumbprint(certificate);
        return this.#trusted.has(tp)
            ? StatusCodes.Good
            : StatusCodes.BadCertificateUntrusted;
    }

    public async addIssuer(
        certificate: Certificate,
        _validate?: boolean,
        _addInTrustList?: boolean
    ): Promise<void> {
        this.#issuers.add(thumbprint(certificate));
    }

    public async addRevocationList(
        crl: Certificate,
        _target?: "issuers" | "trusted"
    ): Promise<void> {
        this.#crls.add(thumbprint(crl));
    }
}
