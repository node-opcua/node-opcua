/**
 * @module node-opcua-server-configuration
 */
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { assert } from "node-opcua-assert";
import { ByteString, StatusCodes } from "node-opcua-basic-types";
import {
    convertPEMtoDER,
    exploreCertificate,
    makeSHA1Thumbprint,
    readPrivateKey,
    toPem
} from "node-opcua-crypto";
import {
    Certificate,
    CertificatePEM,
    privateDecrypt_long,
    PrivateKey,
    PrivateKeyPEM,
    publicEncrypt_long
} from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { CertificateManager } from "node-opcua-pki";
import { StatusCode } from "node-opcua-status-code";

import {
    CreateSigningRequestResult,
    GetRejectedListResult,
    PushCertificateManager,
    UpdateCertificateResult
} from "../push_certificate_manager";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

const defaultApplicationGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultApplicationGroup");
const defaultHttpsGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultHttpsGroup");
const defaultUserTokenGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultUserTokenGroup");

/**
 * check that the given certificate matches the given private key
 * @param certificate
 * @param privateKey
 */
function certificateMatchesPrivateKeyPEM(certificate: CertificatePEM, privateKey: PrivateKeyPEM): boolean {

    const initialBuffer = Buffer.from("Lorem Ipsum");
    const encryptedBuffer = publicEncrypt_long(initialBuffer, certificate, 256, 11);
    const decryptedBuffer = privateDecrypt_long(encryptedBuffer, privateKey, 256);
    return initialBuffer.toString("ascii") === decryptedBuffer.toString("ascii");
}

export function certificateMatchesPrivateKey(certificate: Certificate, privateKey: PrivateKey): boolean {

    const certificatePEM = toPem(certificate, "CERTIFICATE");
    const privateKeyPEM = toPem(privateKey, "RSA PRIVATE KEY");
    return certificateMatchesPrivateKeyPEM(certificatePEM, privateKeyPEM);
}

function findCertificateGroupName(certificateGroupNodeId: NodeId | string): string {

    if (typeof certificateGroupNodeId === "string") {
        return certificateGroupNodeId;
    }
    if (sameNodeId(certificateGroupNodeId, NodeId.nullNodeId) ||
      sameNodeId(certificateGroupNodeId, defaultApplicationGroup)) {
        return "DefaultApplicationGroup";
    }
    if (sameNodeId(certificateGroupNodeId, defaultHttpsGroup)) {
        return "DefaultHttpsGroup";
    }
    if (sameNodeId(certificateGroupNodeId, defaultUserTokenGroup)) {
        return "DefaultUserTokenGroup";
    }
    return "";
}

export interface PushCertificateManagerServerOptions {
    applicationGroup?: CertificateManager;
    userTokenGroup?: CertificateManager;
    httpsGroup?: CertificateManager;
}

type Functor = () => Promise<void>;

export async function copyFile(source: string, dest: string): Promise<void> {
    try {
        debugLog("copying file \n source ", source, "\n =>\n dest ", dest);
        const sourceExist = await promisify(fs.exists)(source);
        if (sourceExist) {
            await promisify(fs.copyFile)(source, dest);
        }
    } catch (err) {
        errorLog(err);
    }
}

export async function deleteFile(file: string): Promise<void> {
    try {
        const exists = await promisify(fs.exists)(file);
        if (exists) {
            debugLog("deleting file ", file);
            await promisify(fs.unlink)(file);
        }
    } catch (err) {
        errorLog(err);
    }
}

export async function moveFile(source: string, dest: string): Promise<void> {

    debugLog("moving file file \n source ", source, "\n =>\n dest ", dest);
    try {
        await copyFile(source, dest);
        await deleteFile(source);
    } catch (err) {
        errorLog(err);
    }
}

export async function moveFileWithBackup(source: string, dest: string): Promise<void> {
    // let make a copy of the destination file
    debugLog("moveFileWithBackup file \n source ", source, "\n =>\n dest ", dest);
    await copyFile(dest, dest + "_old");
    await moveFile(source, dest);
}

let fileCounter = 0;

export type ActionQueue = Array<() => Promise<void>>;

export class PushCertificateManagerServerImpl extends EventEmitter implements PushCertificateManager {

    public applicationGroup?: CertificateManager;
    public userTokenGroup?: CertificateManager;
    public httpsGroup?: CertificateManager;

    private readonly _map: { [key: string]: CertificateManager } = {};
    private readonly _pendingTasks: Functor[] = [];

    private $$actionQueue: ActionQueue = [];

    constructor(options?: PushCertificateManagerServerOptions) {

        super();

        if (options) {
            this.applicationGroup = options.applicationGroup;
            this.userTokenGroup = options.userTokenGroup;
            this.httpsGroup = options.httpsGroup;
            if (this.userTokenGroup) {
                this._map.DefaultUserTokenGroup = this.userTokenGroup;

                // istanbul ignore next
                if (!(this.userTokenGroup instanceof CertificateManager)) {
                    errorLog("Expecting this.userTokenGroup to be instanceof CertificateManager :", (this.userTokenGroup as any).constructor.name);
                    throw new Error("Expecting this.userTokenGroup to be instanceof CertificateManager ");
                }
            }
            if (this.applicationGroup) {
                this._map.DefaultApplicationGroup = this.applicationGroup;
                assert(this.applicationGroup instanceof CertificateManager);
            }
            if (this.httpsGroup) {
                this._map.DefaultHttpsGroup = this.httpsGroup;
                assert(this.httpsGroup instanceof CertificateManager);
            }
        }
    }

    public async initialize() {
        if (this.applicationGroup) {
            await this.applicationGroup.initialize();
        }
        if (this.userTokenGroup) {
            await this.userTokenGroup.initialize();
        }
        if (this.httpsGroup) {
            await this.httpsGroup.initialize();
        }
    }

    public get supportedPrivateKeyFormats(): string[] {
        return ["PEM"];
    }

    public async getSupportedPrivateKeyFormats(): Promise<string[]> {
        return this.supportedPrivateKeyFormats;
    }

    public async createSigningRequest(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      subjectName: string,
      regeneratePrivateKey?: boolean,
      nonce?: Buffer
    ): Promise<CreateSigningRequestResult> {

        const certificateManager = this.getCertificateManager(certificateGroupId);

        if (!certificateManager) {
            debugLog(" cannot find group ", certificateGroupId);
            return {
                statusCode: StatusCodes.BadInvalidArgument
            };
        }

        // todo : at this time regenerate PrivateKey is not supported
        if (regeneratePrivateKey) {
            // The Server shall create a new Private Key which it stores until the
            // matching signed Certificate is uploaded with the UpdateCertificate Method.
            // Previously created Private Keys may be discarded if UpdateCertificate was not
            // called before calling this method again.
            debugLog(" regeneratePrivateKey = true not supported yet");

            // debugLog("generating a new private key ...");
            // setEnv("RANDFILE", certificateManager.randomFile);
            // await createPrivateKey(certificateManager.privateKey, certificateManager.keySize);

            return {
                statusCode: StatusCodes.BadInvalidArgument
            };
        } else {
            // The Server uses its existing Private Key
        }

        const options = {
            subject: subjectName
        };
        const csrfile = await certificateManager.createCertificateRequest(options);
        const csrPEM = await promisify(fs.readFile)(csrfile, "utf8");
        const certificateSigningRequest = convertPEMtoDER(csrPEM);

        this.addPendingTask(() => deleteFile(csrfile));

        return {
            certificateSigningRequest,
            statusCode: StatusCodes.Good
        };
    }

    public async getRejectedList(): Promise<GetRejectedListResult> {

        interface FileData {
            filename: string;
            stat: {
                mtime: Date
            };
        }

        // rejectedList comes from each group
        async function extractRejectedList(
          group: CertificateManager | undefined,
          certificateList: FileData[]
        ): Promise<void> {
            if (!group) {
                return;
            }
            const rejectedFolder = path.join(group.rootDir, "rejected");
            const files = await promisify(fs.readdir)(rejectedFolder);

            const stat = promisify(fs.stat);

            const promises1: Array<Promise<fs.Stats>> = [];
            for (const certFile of files) {
                // read date
                promises1.push(stat(path.join(rejectedFolder, certFile)));
            }
            const stats = await Promise.all(promises1);

            for (let i = 0; i < stats.length; i++) {
                certificateList.push({
                    filename: path.join(rejectedFolder, files[i]),
                    stat: stats[i]
                });
            }
        }

        const list: FileData[] = [];
        await extractRejectedList(this.applicationGroup, list);
        await extractRejectedList(this.userTokenGroup, list);
        await extractRejectedList(this.httpsGroup, list);

        // now sort list from newer file to older file
        list.sort((a: FileData, b: FileData) =>
          b.stat.mtime.getTime() - a.stat.mtime.getTime()
        );

        const readFile = promisify(fs.readFile);
        const promises: Array<Promise<string>> = [];
        for (const item of list) {
            promises.push(readFile(item.filename, "utf8"));
        }
        const certificatesPEM: string[] = await Promise.all(promises);

        const certificates: Buffer[] = certificatesPEM.map(convertPEMtoDER);
        return {
            certificates,
            statusCode: StatusCodes.Good
        };
    }

    public async updateCertificate(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      certificate: Buffer,
      issuerCertificates: ByteString[]
    ): Promise<UpdateCertificateResult>;
    public async updateCertificate(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      certificate: Buffer,
      issuerCertificates: ByteString[],
      privateKeyFormat?: string,
      privateKey?: Buffer
    ): Promise<UpdateCertificateResult> {

        // Result Code                Description
        // BadInvalidArgument        The certificateTypeId or certificateGroupId is not valid.
        // BadCertificateInvalid     The Certificate is invalid or the format is not supported.
        // BadNotSupported           The PrivateKey is invalid or the format is not supported.
        // BadUserAccessDenied       The current user does not have the rights required.
        // BadSecurityChecksFailed   Some failure occurred verifying the integrity of the Certificate.
        const certificateManager = this.getCertificateManager(certificateGroupId)!;

        if (!certificateManager) {
            debugLog(" cannot find group ", certificateGroupId);
            return {
                statusCode: StatusCodes.BadInvalidArgument
            };
        }

        async function preinstallCertificate(self: PushCertificateManagerServerImpl) {

            const certFolder = path.join(certificateManager.rootDir, "own/certs");
            const certificateFileDER = path.join(certFolder, `_pending_certificate${fileCounter++}.der`);
            const certificateFilePEM = path.join(certFolder, `_pending_certificate${fileCounter++}.pem`);

            await promisify(fs.writeFile)(certificateFileDER, certificate, "binary");
            await promisify(fs.writeFile)(certificateFilePEM, toPem(certificate, "CERTIFICATE"));

            const destDER = path.join(certFolder, "certificate.der");
            const destPEM = path.join(certFolder, "certificate.pem");

            // put existing file in security by backing them up
            self.addPendingTask(() => moveFileWithBackup(certificateFileDER, destDER));
            self.addPendingTask(() => moveFileWithBackup(certificateFilePEM, destPEM));

        }

        async function preinstallPrivateKey(self: PushCertificateManagerServerImpl) {

            assert(privateKeyFormat!.toUpperCase() === "PEM");
            assert(privateKey! instanceof Buffer); // could be DER or PEM in a buffer ?

            const ownPrivateFolder = path.join(certificateManager.rootDir, "own/private");
            const privateKeyFilePEM = path.join(ownPrivateFolder, `_pending_private_key${fileCounter++}.pem`);

            const privateKeyPEM = toPem(privateKey!, "RSA PRIVATE KEY");
            await promisify(fs.writeFile)(privateKeyFilePEM, privateKeyPEM, "utf-8");

            // console.log("KYKY ", privateKeyPEM);
            // console.log("KYKY certificateManager.privateKey = ", certificateManager.privateKey);

            self.addPendingTask(() => moveFileWithBackup(privateKeyFilePEM, certificateManager.privateKey));

        }

        // OPC Unified Architecture, Part 12 42 Release 1.04:
        //
        // UpdateCertificate is used to update a Certificate for a Server.
        // There are the following three use cases for this Method:
        //
        //  - The new Certificate was created based on a signing request created with the Method
        //    In this case there is no privateKey provided.
        //  - A new privateKey and Certificate was created outside the Server and both are updated
        //    with this Method.
        //  - A new Certificate was created and signed with the information from the old Certificate.
        //    In this case there is no privateKey provided.

        // The Server shall do all normal integrity checks on the Certificate and all of the issuer
        // Certificates. If errors occur the BadSecurityChecksFailed error is returned.
        // todo : all normal integrity check on the certificate
        const certInfo = exploreCertificate(certificate);

        const now = new Date();
        if (certInfo.tbsCertificate.validity.notBefore.getTime() > now.getTime()) {
            // certificate is not yet valid
            debugLog("Certificate is not yet valid");
            return { statusCode: StatusCodes.BadSecurityChecksFailed };

        }
        if (certInfo.tbsCertificate.validity.notAfter.getTime() < now.getTime()) {
            // certificate is already out of date
            debugLog("Certificate is already out of date");
            return { statusCode: StatusCodes.BadSecurityChecksFailed };
        }

        // If the Server returns applyChangesRequired=FALSE then it is indicating that it is able to
        // satisfy the requirements specified for the ApplyChanges Method.

        debugLog(" updateCertificate ", makeSHA1Thumbprint(certificate).toString("hex"));

        if (!privateKeyFormat || !privateKey) {

            // The Server shall report an error if the public key does not match the existing Certificate and
            // the privateKey was not provided.
            // privateKey is not provided, so check that the public key matches the existing certificate
            const privateKeyDER = readPrivateKey(certificateManager.privateKey);
            if (!certificateMatchesPrivateKey(certificate, privateKeyDER)) {
                // certificate doesn't match privateKey
                debugLog("certificate doesn't match privateKey");
                return { statusCode: StatusCodes.BadSecurityChecksFailed };
            }
            // a new certificate is provided for us,
            // we keep our private key
            // we do this in two stages
            await preinstallCertificate(this);

            return {
                statusCode: StatusCodes.Good
            };

        } else if (privateKey) {

            // a private key has been provided by the caller !
            if (!privateKeyFormat) {
                debugLog("the privateKeyFormat must be specified " + privateKeyFormat);
                return { statusCode: StatusCodes.BadNotSupported };
            }
            if (privateKeyFormat !== "PEM" && privateKeyFormat !== "PFX") {
                debugLog(" the private key format is invalid privateKeyFormat =" + privateKeyFormat);
                return { statusCode: StatusCodes.BadNotSupported };
            }
            if (privateKeyFormat !== "PEM") {
                debugLog("in NodeOPCUA we only support PEM for the moment privateKeyFormat =" + privateKeyFormat);
                return { statusCode: StatusCodes.BadNotSupported };
            }

            // privateKey is  provided, so check that the public key matches provided private key
            if (!certificateMatchesPrivateKey(certificate, privateKey)) {
                // certificate doesn't match privateKey
                debugLog("certificate doesn't match privateKey");
                return { statusCode: StatusCodes.BadSecurityChecksFailed };
            }

            await preinstallPrivateKey(this);

            await preinstallCertificate(this);

            return {
                statusCode: StatusCodes.Good
            };

        } else {
            // todo !
            return {
                statusCode: StatusCodes.BadNotSupported
            };
        }
    }

    public async applyChanges(): Promise<StatusCode> {

        // ApplyChanges is used to tell the Server to apply any security changes.
        // This Method should only be called if a previous call to a Method that changed the
        // configuration returns applyChangesRequired=true.
        //
        // If the Server Certificate has changed, Secure Channels using the old Certificate will
        // eventually be interrupted.

        this.emit("CertificateAboutToChange", this.$$actionQueue);
        await this.flushActionQueue();

        try {
            await this.applyPendingTasks();
        } catch (err) {
            debugLog("err ", err);
            return StatusCodes.BadInternalError;
        }
        this.emit("CertificateChanged", this.$$actionQueue);
        await this.flushActionQueue();

        // The only leeway the Server has is with the timing.
        // In the best case, the Server can close the TransportConnections for the affected Endpoints and leave any
        // Subscriptions intact. This should appear no different than a network interruption from the
        // perspective of the Client. The Client should be prepared to deal with Certificate changes
        // during its reconnect logic. In the worst case, a full shutdown which affects all connected
        // Clients will be necessary. In the latter case, the Server shall advertise its intent to interrupt
        // connections by setting the SecondsTillShutdown and ShutdownReason Properties in the
        // ServerStatus Variable.

        // If the Secure Channel being used to call this Method will be affected by the Certificate change
        // then the Server shall introduce a delay long enough to allow the caller to receive a reply.
        return StatusCodes.Good;
    }

    private getCertificateManager(
      certificateGroupId: NodeId | string
    ): CertificateManager | null {
        const groupName = findCertificateGroupName(certificateGroupId);
        return this._map[groupName] || null;
    }

    private addPendingTask(functor: () => Promise<void>): void {
        this._pendingTasks.push(functor);
    }

    private async applyPendingTasks(): Promise<void> {

        debugLog("start applyPendingTasks");
        const promises: Array<Promise<void>> = [];
        const t = this._pendingTasks.splice(0);

        if (false) {
            // node 10.2 and above
            for await (const task of t) {
                await task();
            }
        } else {
            while (t.length) {
                const task = t.shift()!;
                await task();
            }
        }
        await Promise.all(promises);
        debugLog("end applyPendingTasks");
    }

    private async flushActionQueue(): Promise<void> {
        while (this.$$actionQueue.length) {
            const first = this.$$actionQueue.pop()!;
            await first!();
        }
    }

}
