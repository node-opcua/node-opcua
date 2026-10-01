import type { StatusCode } from "node-opcua-status-code";

/**
 * @module node-opcua-server-configuration
 */
export interface ITrustList {
    /**
     * The CloseAndUpdate Method closes the file and applies the changes to the Trust List. It can
     * only be called if the file was opened for writing. If the Close Method is called any cached data
     * is discarded and the Trust List is not changed.
     *
     * The Server shall verify that every Certificate in the new Trust List is valid according to the
     * mandatory rules defined in Part 4. If an invalid Certificate is found the Server shall return an
     * error and shall not update the Trust List. If only part of the Trust List is being updated the
     * Server creates a temporary Trust List that includes the existing Trust List plus any updates
     * and validates the temporary Trust List.
     *
     * If the file cannot be processed this Method still closes the file and discards the data before
     * returning an error. This Method is required if the Server supports updates to the Trust List.
     * The structure uploaded includes a mask (see 7.5.8) which specifies which fields are updated.
     * If a bit is not set then the associated field is not changed.
     *
     * @param fileHandle UInt32 - The handle of the previously opened file
     * @return applyChangesRequired - A flag indicating whether the ApplyChanges Method (see 7.7.5) shall be called
     *                                before the new Trust List will be used by the Server.
     * **Result Code**
     * - BadUserAccessDenied         The current user does not have the rights required.
     * - BadCertificateInvalid       The Server could not validate all Certificates in the Trust List.
     *                              The DiagnosticInfo shall specify which Certificate(s) are invalid and the specific
     *                              error.
     */
    closeAndUpdate(
        // fileHandle: UInt32,
        applyChangesRequired: boolean
    ): Promise<boolean>;

    /**
     * The AddCertificate Method allows a Client to add a single Certificate to the Trust List.
     *
     * The Server shall verify that the Certificate is valid according to the rules defined in Part 4.
     *
     * If an invalid Certificate is found the Server shall return an error and shall not update the Trust List.
     *
     * The Method returns a validation error if the Certificate is issued by a CA and the
     * Certificate for the issuer is not in the Trust List. Issuer Certificates cannot be added
     * with this Method: they are written, with their CRLs, through Open/Write/CloseAndUpdate.
     *
     * This method cannot be called if the file object is open (OPC 10000-12 §7.8.2.6).
     * @param  certificate - The DER encoded Certificate to add as a ByteString
     * @param  isTrustedCertificate - If TRUE the Certificate is added to the Trusted Certificates List. If FALSE BadCertificateInvalid is returned.
     *
     * **Result Code**
     * - BadUserAccessDenied:     The current user does not have the rights required.
     * - BadCertificateInvalid:   The certificate to add is invalid.
     * - BadInvalidState:         The object is open for write and CloseAndUpdate has not been called.
     * - BadNotWritable:          The object is open for read only.
     *
     */
    addCertificate(certificate: Buffer, isTrustedCertificate: boolean): Promise<StatusCode>;

    /**
     * The RemoveCertificate Method allows a Client to remove a single Certificate from the Trust List.
     *
     * It returns BadInvalidArgument if the thumbprint does not match a Certificate in the Trust List.
     *
     * If the Certificate is a CA Certificate with associated CRLs then all CRLs are removed as well.
     *
     * This method cannot be called if the file object is open (OPC 10000-12 §7.8.2.7).
     *
     * @param thumbprint - The SHA1 hash of the Certificate to remove
     * @param  isTrustedCertificate - If TRUE the Certificate is removed from the Trusted Certificates List.
     *                                If FALSE the Certificate is removed from the Issuer Certificates List.
     *
     * **Result Code**
     * -BadUserAccessDenied:            The current user does not have the rights required.
     * -BadInvalidArgument:             The certificate to remove was not found.
     * -BadCertificateChainIncomplete:  The Certificate is needed to validate another Certificate in the Trust List.
     * -BadInvalidState:                The object is open for write and CloseAndUpdate has not been called.
     * -BadNotWritable:                 The object is open for read only.
     *
     *
     */
    removeCertificate(thumbprint: string, isTrustedCertificate: boolean): Promise<StatusCode>;
}
