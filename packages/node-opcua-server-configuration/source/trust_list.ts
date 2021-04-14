import { StatusCode, UInt32 } from "node-opcua-basic-types";

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
     * If the Certificate is issued by a CA then the Client shall provide the entire chain in the
     * certificate argument (see Part 6). 
     * 
     * After validating the Certificate, the Server shall add the CA Certificates to the Issuers list in the Trust List. 
     * 
     * The leaf Certificate is added to the list specified by the isTrustedCertificate argument.
     * 
     * This method cannot be called if the file object is open
     * @param  certificate - The DER encoded Certificate to add as a ByteStrng
     * @param  isTrustedCertificate - If TRUE the Certificate is added to the Trusted Certificates List. If FALSE the Certificate is added to the Issuer Certificates List.
     *
     * **Result Code**            
     * - BadUserAccessDenied:     The current user does not have the rights required.
     * - BadCertificateInvalid:   The certificate to add is invalid.
     * - BadInvalidState:         The object is opened.
     *     
     */
    addCertificate(
      certificate: Buffer,
      isTrustedCertificate: boolean
    ): Promise<StatusCode>;

    /**
     * The RemoveCertificate Method allows a Client to remove a single Certificate from the Trust List. 
     * 
     * It returns BadInvalidArgument if the thumbprint does not match a Certificate in the Trust List.
     * 
     * If the Certificate is a CA Certificate with associated CRLs then all CRLs are removed as well.
     * 
     * This method cannot be called if the file object is open.
     *
     * @param thumbprint - The SHA1 hash of the Certificate to remove
     * @param  isTrustedCertificate - If TRUE the Certificate is removed from the Trusted Certificates List.
     *                                If FALSE the Certificate is removed from the Issuer Certificates List.
     *
     * **Result Code**
     * -BadUserAccessDenied:   The current user does not have the rights required.
     * -BadInvalidArgument:    The certificate to remove was not found.
     * -BadInvalidState:       The object is opened.
     * 
     * 
     */
    removeCertificate(
      thumbprint: string,
      isTrustedCertificate: boolean
    ): Promise<StatusCode>;
}
