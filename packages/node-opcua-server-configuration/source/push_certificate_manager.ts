/**
 * @module node-opcua-server-configuration
 */
import { ByteString, UAString } from "node-opcua-basic-types";
import { NodeId } from "node-opcua-nodeid";
import { StatusCode } from "node-opcua-status-code";

export interface CreateSigningRequestResult {
    statusCode: StatusCode;
    certificateSigningRequest?: Buffer;
}

export interface GetRejectedListResult {
    statusCode: StatusCode;
    certificates?: Buffer[];
}

export interface UpdateCertificateResult {
    statusCode: StatusCode;
    applyChangesRequired?: boolean;
}

export interface PushCertificateManager {

    /**
     * The SupportedPrivateKeyFormats specifies the PrivateKey formats supported by the Server.
     * Possible values include “PEM” (see RFC 5958) or “PFX” (see PKCS #12). The array is empty
     * if the Server does not allow external Clients to update the PrivateKey
     */
    getSupportedPrivateKeyFormats(): Promise<string[]>;

    /**
     * UpdateCertificate is used to update a Certificate for a Server.
     * There are the following three use cases for this Method:
     * • The new Certificate was created based on a signing request created with the Method
     *   CreateSigningRequest defined in 7.7.6. In this case there is no privateKey provided.
     * • A new privateKey and Certificate was created outside the Server and both are updated
     *   with this Method.
     * • A new Certificate was created and signed with the information from the old Certificate.
     *   In this case there is no privateKey provided.
     * The Server shall do all normal integrity checks on the Certificate and all of the issuer
     * Certificates. If errors occur the Bad_SecurityChecksFailed error is returned.
     * The Server shall report an error if the public key does not match the existing Certificate and
     * the privateKey was not provided.
     *
     * @param certificateGroupId    - The NodeId of the Certificate Group Object which is affected by the update.
     *                                If null the DefaultApplicationGroup is used.
     * @param certificateTypeId     - The type of Certificate being updated. The set of permitted types is specified by
     *                                the CertificateTypes Property belonging to the Certificate Group.
     * @param certificate           - The DER encoded Certificate which replaces the existing Certificate
     * @param issuerCertificates    - The issuer Certificates needed to verify the signature on the new Certificate
     * @param privateKeyFormat      - The format of the Private Key (PEM or PFX). If the privateKey is not specified
     *                                the privateKeyFormat is null or empty
     * @param privateKey            - the Private Key encoded in the privateKeyFormat.
     * @return applyChangesRequired - Indicates that the ApplyChanges Method shall be called before the new
     *                                Certificate will be used.
     *
     *
     * Result Code                  Description
     * BadInvalidArgument           The certificateTypeId or certificateGroupId is not valid.
     * BadCertificateInvalid        The Certificate is invalid or the format is not supported.
     * BadNotSupported              The PrivateKey is invalid or the format is not supported.
     * BadUserAccessDenied          The current user does not have the rights required.
     * BadSecurityChecksFailed      Some failure occurred verifying the integrity of the Certificate.
     *
     */
    updateCertificate(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      certificate: ByteString,
      issuerCertificates: ByteString[],
      privateKeyFormat: UAString,
      privateKey: ByteString
    ): Promise<UpdateCertificateResult>;

    /**
     * The ApplyChanges Method is used to apply any security related changes if the Server sets
     * the applyChangesRequired flag when another Method is called. Servers should minimize the
     * impact of applying the new configuration, however, it could require that all existing Sessions
     * be closed and re-opened by the Clients.
     *
     *
     * ApplyChanges is used to tell the Server to apply any security changes.
     * This Method should only be called if a previous call to a Method that changed the
     * configuration returns applyChangesRequired=true (see 7.7.4).
     * If the Server Certificate has changed, Secure Channels using the old Certificate will
     * eventually be interrupted. The only leeway the Server has is with the timing. In the best case,
     * the Server can close the TransportConnections for the affected Endpoints and leave any
     * Subscriptions intact. This should appear no different than a network interruption from the
     * perspective of the Client. The Client should be prepared to deal with Certificate changes
     * during its reconnect logic. In the worst case, a full shutdown which affects all connected
     * Clients will be necessary. In the latter case, the Server shall advertise its intent to interrupt
     * connections by setting the SecondsTillShutdown and ShutdownReason Properties in the
     * ServerStatus Variable.
     *
     * If the Secure Channel being used to call this Method will be affected by the Certificate change
     * then the Server shall introduce a delay long enough to allow the caller to receive a reply.
     * This Method requires an encrypted channel and that the Client provide credentials with
     * administrative rights on the Server.
     *
     *
     * Result Code               Description
     * Bad_UserAccessDenied      The current user does not have the rights required.
     */
    applyChanges(): Promise<StatusCode>;

    /**
     * The CreateSigningRequest Method asks the Server to create a PKCS #10 encoded Certificate
     * Request that is signed with the Server’s private key.
     *
     * CreateSigningRequest Method asks the Server to create a PKCS #10 DER encoded
     * Certificate Request that is signed with the Server’s private key. This request can be then used
     * to request a Certificate from a CA that expects requests in this format.
     * This Method requires an encrypted channel and that the Client provide credentials with
     * administrative rights on the Server.
     *
     * @param certificateGroupId   - The NodeId of the Certificate Group Object which is affected by the request.
     *                               If null the DefaultApplicationGroup is used.
     * @param certificateTypeId    - The type of Certificate being requested. The set of permitted types is specified by
     *                               the CertificateTypes Property belonging to the Certificate Group.
     * @param subjectName          - The subject name to use in the Certificate Request.
     *                               If not specified the SubjectName from the current Certificate is used.
     *                               The format of the subjectName is defined in 7.6.4
     * @param regeneratePrivateKey - If TRUE the Server shall create a new Private Key which it stores until the
     *                               matching signed Certificate is uploaded with the UpdateCertificate Method.
     *                               Previously created Private Keys may be discarded if UpdateCertificate was not
     *                               called before calling this method again. If FALSE the Server uses its existing
     *                               Private Key.
     * @param nonce                - Additional entropy which the caller shall provide if regeneratePrivateKey is TRUE.
     *                               It shall be at least 32 bytes long
     * @return certificateRequest   - The PKCS #10 DER encoded Certificate Request.
     *
     *
     * Result Code                   Description
     * Bad_InvalidArgument           The certificateTypeId, certificateGroupId or subjectName is not valid.
     * Bad_UserAccessDenied          The current user does not have the rights required.
     */
    createSigningRequest(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      subjectName: string | null,
      regeneratePrivateKey?: boolean,
      nonce?: ByteString
    ): Promise<CreateSigningRequestResult>;

    /**
     * GetRejectedList Method returns the list of Certificates that have been rejected by the Server.
     * No rules are defined for how the Server updates this list or how long a Certificate is kept in
     * the list. It is recommended that every valid but untrusted Certificate be added to the rejected
     * list as long as storage is available. Servers should omit older entries from the list returned if
     * the maximum message size is not large enough to allow the entire list to be returned.
     * This Method requires an encrypted channel and that the Client provides credentials with
     * administrative rights on the Server.
     *
     * Argument       Description
     * certificates   out - The DER encoded form of the Certificates rejected by the Server.
     *
     *  Result Code           Description
     *  Bad_UserAccessDenied  The current user does not have the rights required
     */

    getRejectedList(): Promise</*certificates*/GetRejectedListResult>;

}
