/**
 * Abstract certificate trust store.
 *
 * Disk-based implementation: OPCUACertificateManager
 * In-memory implementation: InMemoryCertificateStore
 *
 * Lives in node-opcua-common — zero fs dependency.
 *
 * @module node-opcua-common
 */
import type { Certificate } from "node-opcua-crypto/web";
import type { StatusCode } from "node-opcua-status-code";

export interface ICertificateStore {
    /**
     * Shared ownership counter.
     *
     * Multiple clients/servers may share the same store.
     * `dispose()` only releases resources when the counter
     * reaches zero — preventing premature cleanup.
     */
    referenceCounter: number;

    /** Initialize the store (create dirs, load state). */
    initialize(): Promise<void>;

    /**
     * Dispose of the store, releasing resources (watchers,
     * handles). Only actually releases when
     * `referenceCounter` reaches zero.
     */
    dispose(): Promise<void>;

    /**
     * Check a peer certificate against the trust store.
     *
     * Returns `StatusCodes.Good` if trusted,
     * `StatusCodes.BadCertificateUntrusted` if unknown/rejected,
     * or another `StatusCode` for validation failures.
     */
    checkCertificate(
        certificate: Certificate | Certificate[]
    ): Promise<StatusCode>;

    /**
     * Verify a certificate against the store.
     *
     * Returns a string status: `"Good"`, `"BadCertificateUntrusted"`,
     * `"BadCertificateTimeInvalid"`, etc.
     */
    verifyCertificate(
        certificate: Certificate | Certificate[],
        options?: { acceptOutdatedCertificate?: boolean }
    ): Promise<string>;

    /**
     * Move a certificate to the trusted store.
     * If previously rejected, it will be removed from the
     * rejected set.
     */
    trustCertificate(
        certificate: Certificate | Certificate[]
    ): Promise<void>;

    /**
     * Move a certificate to the rejected store.
     * If previously trusted, it will be removed from the
     * trusted set.
     */
    rejectCertificate(
        certificate: Certificate | Certificate[]
    ): Promise<void>;

    /**
     * Check whether a certificate is currently trusted.
     */
    getTrustStatus(
        certificate: Certificate
    ): Promise<StatusCode>;

    /**
     * Register an issuer (CA) certificate so that certificates
     * signed by this CA can be validated.
     *
     * @param certificate - the issuer certificate (DER)
     * @param validate    - whether to validate the issuer cert
     *                      itself (default: true)
     * @param addInTrustList - also add to the trusted list
     */
    addIssuer(
        certificate: Certificate,
        validate?: boolean,
        addInTrustList?: boolean
    ): Promise<unknown>;

    /**
     * Register a Certificate Revocation List so that revoked
     * certificates can be detected during validation.
     *
     * @param crl    - the CRL (DER-encoded)
     * @param target - which folder/set to store the CRL in
     */
    addRevocationList(
        crl: Certificate,
        target?: "issuers" | "trusted"
    ): Promise<unknown>;
}
