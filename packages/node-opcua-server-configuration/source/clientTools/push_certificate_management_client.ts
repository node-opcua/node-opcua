/**
 * @module node-opcua-server-configuration.client
 */
import { ByteString, UInt32 } from "node-opcua-basic-types";
import { makeNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
import { CallMethodRequestLike, IBasicSession } from "node-opcua-pseudo-session";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, VariantArrayType, VariantLike } from "node-opcua-variant";
import { ClientFile, OpenFileMode } from "node-opcua-file-transfer";
import { AttributeIds, QualifiedName, QualifiedNameLike, coerceQualifiedName } from "node-opcua-data-model";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { Certificate } from "node-opcua-crypto";
import { TrustListDataType } from "node-opcua-types";
import { BinaryStream } from "node-opcua-binary-stream";

import {
    CreateSigningRequestResult,
    GetRejectedListResult,
    PushCertificateManager,
    UpdateCertificateResult
} from "../push_certificate_manager";

import { ITrustList } from "../trust_list";
import { TrustListMasks } from "../server/trust_list_server";


const serverConfigurationNodeId = resolveNodeId("ServerConfiguration");
const createSigningRequestMethod = resolveNodeId("ServerConfiguration_CreateSigningRequest");
const getRejectedListMethod = resolveNodeId("ServerConfiguration_GetRejectedList");
const updateCertificateMethod = resolveNodeId("ServerConfiguration_UpdateCertificate");
const certificateGroups = resolveNodeId("ServerConfiguration_CertificateGroups");
const applyChangesMethod = resolveNodeId("ServerConfiguration_ApplyChanges");
const supportedPrivateKeyFormatsNodeId = resolveNodeId("ServerConfiguration_SupportedPrivateKeyFormats");

const defaultApplicationGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultApplicationGroup");
const defaultHttpsGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultHttpsGroup");
const defaultUserTokenGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultUserTokenGroup");

function findCertificateGroupName(certificateGroupNodeId: NodeId): string {
    return "todo";
}

function findCertificateGroupNodeId(certificateGroup: NodeId | string): NodeId {

    if (certificateGroup instanceof NodeId) {
        return certificateGroup;
    }
    switch (certificateGroup) {
        case "DefaultApplicationGroup":
            return defaultApplicationGroup;
        case "DefaultHttpsGroup":
            return defaultHttpsGroup;
        case "DefaultUserTokenGroup":
            return defaultUserTokenGroup;
        default:
            return resolveNodeId(certificateGroup);
    }
}

function findCertificateTypeIdNodeId(certificateTypeId: NodeId | string): NodeId {
    if (certificateTypeId instanceof NodeId) {
        return certificateTypeId;
    }
    return resolveNodeId(certificateTypeId);
}



export class TrustListClient extends ClientFile implements ITrustList {

    private closeAndUpdateNodeId?: NodeId;
    private addCertificateNodeId?: NodeId;
    private removeCertificateNodeId?: NodeId;
    private openWithMasksNodeId?: NodeId;

    constructor(session: IBasicSession, public nodeId: NodeId) {
        super(session, nodeId);
    }
    /**
     * @private
     */
    async _extractMethodIds(): Promise<void> {

        const browseResults = await this.session.translateBrowsePath([
            makeBrowsePath(this.nodeId, "/CloseAndUpdate"),    // Optional
            makeBrowsePath(this.nodeId, "/AddCertificate"),    // Optional
            makeBrowsePath(this.nodeId, "/RemoveCertificate"), // Optional
            makeBrowsePath(this.nodeId, "/OpenWithMasks")      // OpenWithMasks Mandatory
        ]);

        this.closeAndUpdateNodeId = browseResults[0].targets![0].targetId;
        this.addCertificateNodeId = browseResults[1].targets![0].targetId;
        this.removeCertificateNodeId = browseResults[2].targets![0].targetId;
        this.openWithMasksNodeId = browseResults[3].targets![0].targetId;

        // istanbul ignore next
        if (!this.openWithMasksNodeId || this.openWithMasksNodeId.isEmpty()) {
            throw new Error("Cannot find mandatory method OpenWithMask on object");
        }
    }

    protected async extractMethodsIds() {
        await super.extractMethodsIds();
        await this._extractMethodIds();
    }

    async openWithMasks(trustListMask: TrustListMasks): Promise<number> {
        // istanbul ignore next
        if (this.fileHandle) {
            throw new Error("File has already be opened");
        }
        await this.ensureInitialized();
        // istanbul ignore next
        if (!this.openWithMasksNodeId) {
            throw new Error("OpenWithMasks doesn't exist");
        }
        const inputArguments = [
            { dataType: DataType.UInt32, value: trustListMask },
        ];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: this.openWithMasksNodeId,
            objectId: this.nodeId
        };
        const callMethodResult = await this.session.call(methodToCall);
        if (callMethodResult.statusCode !== StatusCodes.Good) {
            throw new Error(callMethodResult.statusCode.name);
        }
        this.fileHandle = callMethodResult.outputArguments![0].value as number;
        return this.fileHandle;
    }

    async closeAndUpdate(applyChangesRequired: boolean): Promise<boolean> {
        if (!this.fileHandle) {
            throw new Error("File has node been opened yet");
        }
        await this.ensureInitialized();
        if (!this.closeAndUpdateNodeId) {
            throw new Error("CloseAndUpdateMethod doesn't exist");
        }
        const inputArguments = [
            { dataType: DataType.UInt32, value: this.fileHandle },
            { dataType: DataType.Boolean, value: !!applyChangesRequired },
        ];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: this.closeAndUpdateNodeId,
            objectId: this.nodeId
        };
        const callMethodResult = await this.session.call(methodToCall);
        if (callMethodResult.statusCode !== StatusCodes.Good) {
            throw new Error(callMethodResult.statusCode.name);
        }
        return callMethodResult.outputArguments![0].value as boolean;
    }

    async addCertificate(certificate: Certificate, isTrustedCertificate: boolean): Promise<StatusCode> {
        await this.ensureInitialized();

        const inputArguments: VariantLike[] = [
            { dataType: DataType.ByteString, value: certificate },
            { dataType: DataType.Boolean, value: !!isTrustedCertificate },
        ];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: this.addCertificateNodeId,
            objectId: this.nodeId
        };
        const callMethodResult = await this.session.call(methodToCall);
        return callMethodResult.statusCode;
    }

    async removeCertificate(thumbprint: string, isTrustedCertificate: boolean): Promise<StatusCode> {
        await this.ensureInitialized();

        const inputArguments: VariantLike[] = [
            { dataType: DataType.String, value: thumbprint },
            { dataType: DataType.Boolean, value: !!isTrustedCertificate },
        ];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: this.removeCertificateNodeId,
            objectId: this.nodeId
        };
        const callMethodResult = await this.session.call(methodToCall);
        return callMethodResult.statusCode;
    }

    /**
     * helper function to retrieve the list of certificates ...
     * @returns 
     */
    async readTrustedCertificateList(): Promise<TrustListDataType> {
        // const size = await this.size();
        const fileHandle = await this.open(OpenFileMode.Read);
        const buff = await this.read(65525);
        await this.close();
        const stream = new BinaryStream(buff);
        const trustList: TrustListDataType = new TrustListDataType();
        trustList.decode(stream);
        return trustList;
    }
    async readTrustedCertificateListWithMasks(trustListMask: TrustListMasks): Promise<TrustListDataType> {
        // const size = await this.size();
        const fileHandle = await this.openWithMasks(trustListMask);
        const buff = await this.read(65525);
        await this.close();
        const stream = new BinaryStream(buff);
        const trustList: TrustListDataType = new TrustListDataType();
        trustList.decode(stream);
        return trustList;
    }

    async writeTrustedCertificateList(trustedList: TrustListDataType): Promise<boolean> {
        await this.open(OpenFileMode.Write);
        const s = trustedList.binaryStoreSize();
        const stream = new BinaryStream(s);
        trustedList.encode(stream);
        return await this.closeAndUpdate(true);
    }

}
export class CertificateGroup {

    constructor(public session: IBasicSession, public nodeId: NodeId) {

    }
    async getCertificateTypes(): Promise<NodeId[]> {
        const browsePathResult = await this.session.translateBrowsePath(makeBrowsePath(this.nodeId, "/CertifiateTypes"));
        if (browsePathResult.statusCode !== StatusCodes.Good) {
            throw new Error(browsePathResult.statusCode.name);
        }
        const certificateTypesNodeId = browsePathResult.targets![0].targetId;
        const dataValue = await this.session.read({ nodeId: certificateTypesNodeId, attributeId: AttributeIds.Value });
        if (dataValue.statusCode !== StatusCodes.Good) {
            throw new Error(browsePathResult.statusCode.name);
        }
        return dataValue.value.value as NodeId[];
    }
    async getTrustList(): Promise<TrustListClient> {
        const browsePathResult = await this.session.translateBrowsePath(makeBrowsePath(this.nodeId, "/TrustList"));
        if (browsePathResult.statusCode !== StatusCodes.Good) {
            throw new Error(browsePathResult.statusCode.name);
        }
        const trustListNodeId = browsePathResult.targets![0].targetId;
        return new TrustListClient(this.session, trustListNodeId);

    }

}
export class ClientPushCertificateManagement implements PushCertificateManager {

    public static rsaSha256ApplicationCertificateType: NodeId = resolveNodeId("i=12560");

    public session: IBasicSession;

    constructor(session: IBasicSession) {
        this.session = session;
    }

    /**
     * CreateSigningRequest Method asks the Server to create a PKCS #10 DER encoded
     * Certificate Request that is signed with the Server’s private key. This request can be then used
     * to request a Certificate from a CA that expects requests in this format.
     * This Method requires an encrypted channel and that the Client provide credentials with
     * administrative rights on the Server.
     *
     * @param certificateGroupId  - The NodeId of the Certificate Group Object which is affected by the request.
     *                              If null the DefaultApplicationGroup is used.
     * @param certificateTypeId   - The type of Certificate being requested. The set of permitted types is specified by
     *                              the CertificateTypes Property belonging to the Certificate Group.
     * @param subjectName         - The subject name to use in the Certificate Request.
     *                              If not specified the SubjectName from the current Certificate is used.
     *                              The subjectName parameter is a sequence of X.500 name value pairs separated by a ‘/’. For
     *                              example: CN=ApplicationName/OU=Group/O=Company.
     *                              If the certificateType is a subtype of ApplicationCertificateType the Certificate subject name
     *                              shall have an organization (O=) or domain name (DC=) field. The public key length shall meet
     *                              the length restrictions for the CertificateType. The domain name field specified in the subject
     *                              name is a logical domain used to qualify the subject name that may or may not be the same
     *                              as a domain or IP address in the subjectAltName field of the Certificate.
     *                              If the certificateType is a subtype of HttpsCertificateType the Certificate common name (CN=)
     *                              shall be the same as a domain from a DiscoveryUrl which uses HTTPS and the subject name
     *                              shall have an organization (O=) field.
     *                              If the subjectName is blank or null the CertificateManager generates a suitable default.
     * @param regeneratePrivateKey  If TRUE the Server shall create a new Private Key which it stores until the
     *                              matching signed Certificate is uploaded with the UpdateCertificate Method.
     *                              Previously created Private Keys may be discarded if UpdateCertificate was not
     *                              called before calling this method again. If FALSE the Server uses its existing
     *                              Private Key.
     * @param nonce                 Additional entropy which the caller shall provide if regeneratePrivateKey is TRUE.
     *                              It shall be at least 32 bytes long.
     *
     * @return                      The PKCS #10 DER encoded Certificate Request.
     *
     * Result Code                  Description
     * BadInvalidArgument          The certificateTypeId, certificateGroupId or subjectName is not valid.
     * BadUserAccessDenied          The current user does not have the rights required.
     */
    public async createSigningRequest(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        subjectName: string | null,
        regeneratePrivateKey?: boolean,
        nonce?: ByteString
    ): Promise<CreateSigningRequestResult> {

        nonce = nonce || Buffer.alloc(0);

        const inputArguments = [
            { dataType: DataType.NodeId, value: findCertificateGroupNodeId(certificateGroupId) },
            { dataType: DataType.NodeId, value: findCertificateTypeIdNodeId(certificateTypeId) },
            { dataType: DataType.String, value: subjectName },
            { dataType: DataType.Boolean, value: !!regeneratePrivateKey },
            { dataType: DataType.ByteString, value: nonce }
        ];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: createSigningRequestMethod,
            objectId: serverConfigurationNodeId
        };
        const callMethodResult = await this.session.call(methodToCall);

        if (callMethodResult.statusCode === StatusCodes.Good) {
            // xx console.log(callMethodResult.toString());
            return {
                certificateSigningRequest: callMethodResult.outputArguments![0].value,
                statusCode: callMethodResult.statusCode
            };
        } else {
            return { statusCode: callMethodResult.statusCode };
        }
    }

    /**
     * GetRejectedList Method returns the list of Certificates that have been rejected by the Server.
     * rules are defined for how the Server updates this list or how long a Certificate is kept in
     * the list. It is recommended that every valid but untrusted Certificate be added to the rejected
     * list as long as storage is available. Servers should omit older entries from the list returned if
     * the maximum message size is not large enough to allow the entire list to be returned.
     * This Method requires an encrypted channel and that the Client provides credentials with
     * administrative rights on the Server
     *
     * @return certificates The DER encoded form of the Certificates rejected by the Server
     */
    public async getRejectedList(): Promise<GetRejectedListResult> {
        const inputArguments: VariantLike[] = [];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: getRejectedListMethod,
            objectId: serverConfigurationNodeId
        };
        const callMethodResult = await this.session.call(methodToCall);
        if (callMethodResult.statusCode === StatusCodes.Good) {
            if (callMethodResult.outputArguments![0].dataType !== DataType.ByteString) {
                return { statusCode: StatusCodes.BadInvalidArgument };
            }
            return {
                certificates: callMethodResult.outputArguments![0].value,
                statusCode: callMethodResult.statusCode
            };
        } else {
            return {
                statusCode: callMethodResult.statusCode
            };
        }
    }

    /**
     * UpdateCertificate is used to update a Certificate for a Server.
     * There are the following three use cases for this Method:
     *   • The new Certificate was created based on a signing request created with the Method
     *     CreateSigningRequest. In this case there is no privateKey provided.
     *   • A new privateKey and Certificate was created outside the Server and both are updated
     *     with this Method.
     *   • A new Certificate was created and signed with the information from the old Certificate.
     *    In this case there is no privateKey provided.
     *
     * The Server will do all normal integrity checks on the Certificate and all of the issuer
     * Certificates. If errors occur the BadSecurityChecksFailed error is returned.
     * The Server will report an error if the public key does not match the existing Certificate and
     * the privateKey was not provided.
     * If the Server returns applyChangesRequired=FALSE then it is indicating that it is able to
     * satisfy the requirements specified for the ApplyChanges Method.
     * This Method requires an encrypted channel and that the Client provides credentials with
     * administrative rights on the Server.
     *
     * @param certificateGroupId - The NodeId of the Certificate Group Object which is affected by the update.
     *                             If null the DefaultApplicationGroup is used.
     * @param certificateTypeId  - The type of Certificate being updated. The set of permitted types is specified by
     *                             the CertificateTypes Property belonging to the Certificate Group
     * @param certificate        - The DER encoded Certificate which replaces the existing Certificate.
     * @param issuerCertificates - The issuer Certificates needed to verify the signature on the new Certificate
     * @return retVal.applyChangesRequired - Indicates that the ApplyChanges Method shall be called before the new
     *                               Certificate will be used.
     *
     *
     */
    public async updateCertificate(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        certificate: Buffer,
        issuerCertificates: Buffer[]
    ): Promise<UpdateCertificateResult>;
    /**
     *
     * @param certificateGroupId
     * @param certificateTypeId
     * @param certificate
     * @param issuerCertificates
     * @param privateKeyFormat   - The format of the Private Key (PEM or PFX). If the privateKey is not specified
     *                             the privateKeyFormat is null or empty
     * @param privateKey         - The Private Key encoded in the privateKeyFormat
     *
     */
    public async updateCertificate(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        certificate: Buffer,
        issuerCertificates: Buffer[],
        privateKeyFormat: string,
        privateKey: Buffer
    ): Promise<UpdateCertificateResult>;
    public async updateCertificate(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        certificate: Buffer,
        issuerCertificates: Buffer[],
        privateKeyFormat?: string,
        privateKey?: Buffer
    ): Promise<UpdateCertificateResult> {

        const inputArguments: VariantLike[] = [
            { dataType: DataType.NodeId, value: findCertificateGroupNodeId(certificateGroupId) },
            { dataType: DataType.NodeId, value: findCertificateTypeIdNodeId(certificateTypeId) },
            { dataType: DataType.ByteString, value: certificate },
            { dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: issuerCertificates },
            { dataType: DataType.String, value: privateKeyFormat || "" },
            { dataType: DataType.ByteString, value: privateKeyFormat ? privateKey : Buffer.alloc(0) }
        ];
        const methodToCall: CallMethodRequestLike = {
            inputArguments,
            methodId: updateCertificateMethod,
            objectId: serverConfigurationNodeId
        };
        const callMethodResult = await this.session.call(methodToCall);
        if (callMethodResult.statusCode === StatusCodes.Good) {
            if (!callMethodResult.outputArguments || callMethodResult.outputArguments!.length !== 1) {
                return {
                    statusCode: StatusCodes.BadInternalError
                };
                // throw Error("Internal Error, expecting 1 output result");
            }
            return {
                applyChangesRequired: callMethodResult.outputArguments![0].value,
                statusCode: callMethodResult.statusCode
            };
        } else {
            return { statusCode: callMethodResult.statusCode };
        }
    }

    /**
     * ApplyChanges tells the Server to apply any security changes.
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
     * If the Secure Channel being used to call this Method will be affected by the Certificate change
     * then the Server shall introduce a delay long enough to allow the caller to receive a reply.
     * This Method requires an encrypted channel and that the Client provide credentials with
     * administrative rights on the Server.
     *
     * Result Code            Description
     * BadUserAccessDenied   The current user does not have the rights required.
     */
    public async applyChanges(): Promise<StatusCode> {

        const methodToCall: CallMethodRequestLike = {
            inputArguments: [],
            methodId: applyChangesMethod,
            objectId: serverConfigurationNodeId
        };
        const callMethodResult = await this.session.call(methodToCall);

        if (callMethodResult.outputArguments && callMethodResult.outputArguments.length) {
            throw new Error("Invalid  output arguments");
        }
        return callMethodResult.statusCode;
    }

    public async getSupportedPrivateKeyFormats(): Promise<string[]> {

        const dataValue = await this.session.read({
            attributeId: AttributeIds.Value,
            nodeId: supportedPrivateKeyFormatsNodeId
        });
        return dataValue.value.value as string[];
    }

    public async getCertificateGroupId(certificateGroupName: string): Promise<NodeId> {

        if (certificateGroupName === "DefaultApplicationGroup") {
            return defaultApplicationGroup;
        }
        // toDO
        throw new Error("Not Implemented yet");
    }



    /**
     * 
     * @param browseName 
     */
    public async getCertificateGroup(
        browseName: QualifiedNameLike | "DefaultApplicationGroup" | "DefaultUserTokenGroup"): Promise<CertificateGroup> {
        browseName = coerceQualifiedName(browseName);
        if (browseName.toString() === "DefaultApplicationGroup") {
            return new CertificateGroup(this.session, resolveNodeId("ServerConfiguration_CertificateGroups_DefaultApplicationGroup"));
        }
        if (browseName.toString() === "DefaultUserTokenGroup") {
            return new CertificateGroup(this.session, resolveNodeId("ServerConfiguration_CertificateGroups_DefaultUserTokenGroup"));
        }
        // istanbul ignore next
        throw new Error("Not Implemented yet");
    }
    public async getApplicationGroup(): Promise<CertificateGroup> {
        return this.getCertificateGroup("DefaultApplicationGroup");
    }
    public async getUserTokenGroup(): Promise<CertificateGroup> {
        return this.getCertificateGroup("DefaultApplicationGroup");
    }
}
