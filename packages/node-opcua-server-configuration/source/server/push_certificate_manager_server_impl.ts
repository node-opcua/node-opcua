/**
 * @module node-opcua-server-configuration-server
 */
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { rimraf } from "rimraf";
import { SubjectOptions } from "node-opcua-pki";
import { assert } from "node-opcua-assert";
import { ByteString, StatusCodes } from "node-opcua-basic-types";
import {
    convertPEMtoDER,
    exploreCertificate,
    makeSHA1Thumbprint,
    toPem,
    verifyCertificateChain,
    PrivateKey,
    certificateMatchesPrivateKey,
    coercePEMorDerToPrivateKey,
    coercePrivateKeyPem,
    DirectoryName
} from "node-opcua-crypto/web";

import { readPrivateKey, readCertificate } from "node-opcua-crypto";

import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { CertificateManager } from "node-opcua-certificate-manager";
import { StatusCode } from "node-opcua-status-code";

import {
    CreateSigningRequestResult,
    GetRejectedListResult,
    PushCertificateManager,
    UpdateCertificateResult
} from "../push_certificate_manager";

// node 14 onward : import {  readFile, writeFile, readdir } from "fs/promises";
const { readFile, writeFile, readdir } = fs.promises;

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
doDebug;

const defaultApplicationGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultApplicationGroup");
const defaultHttpsGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultHttpsGroup");
const defaultUserTokenGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultUserTokenGroup");

// OPC UA Part 12 Certificate Types - defined once to avoid duplication
const rsaCertificateTypes = [
    resolveNodeId("ns=0;i=12537"), // ApplicationInstanceCertificate_RSA_Min (deprecated)
    resolveNodeId("ns=0;i=12538"), // ApplicationInstanceCertificate_RSA_Sha256 (deprecated)
    resolveNodeId("ns=0;i=12541"), // ApplicationInstanceCertificate_RSA_Sha256_2048
    resolveNodeId("ns=0;i=12542"), // ApplicationInstanceCertificate_RSA_Sha256_4096
];

const eccCertificateTypes = [
    resolveNodeId("ns=0;i=12556"), // ApplicationInstanceCertificate_ECC (deprecated)
    resolveNodeId("ns=0;i=12557"), // ApplicationInstanceCertificate_ECC_nistP256
    resolveNodeId("ns=0;i=12558"), // ApplicationInstanceCertificate_ECC_nistP384
    resolveNodeId("ns=0;i=12559"), // ApplicationInstanceCertificate_ECC_brainpoolP256r1
    resolveNodeId("ns=0;i=12560"), // ApplicationInstanceCertificate_ECC_brainpoolP384r1
    resolveNodeId("ns=0;i=12561"), // ApplicationInstanceCertificate_ECC_curve25519
    resolveNodeId("ns=0;i=12562"), // ApplicationInstanceCertificate_ECC_curve448
];

function findCertificateGroupName(certificateGroupNodeId: NodeId | string): string {
    // Convert string to NodeId if needed to check for null NodeId
    let nodeId: NodeId;
    if (typeof certificateGroupNodeId === "string") {
        try {
            nodeId = resolveNodeId(certificateGroupNodeId);
        } catch {
            // Invalid NodeId string - treat as literal group name
            return certificateGroupNodeId;
        }
    } else {
        nodeId = certificateGroupNodeId;
    }
    
    // Check if it's null NodeId or DefaultApplicationGroup
    if (sameNodeId(nodeId, NodeId.nullNodeId) || sameNodeId(nodeId, defaultApplicationGroup)) {
        return "DefaultApplicationGroup";
    }
    if (sameNodeId(nodeId, defaultHttpsGroup)) {
        return "DefaultHttpsGroup";
    }
    if (sameNodeId(nodeId, defaultUserTokenGroup)) {
        return "DefaultUserTokenGroup";
    }
    
    // If it's a valid NodeId but not recognized, return empty string
    // If it was originally a string (and not a standard group), return the string as group name
    return typeof certificateGroupNodeId === "string" ? certificateGroupNodeId : "";
}

/**
 * Extract the key type from a certificate (RSA or ECC)
 * @param certificate The certificate to analyze
 * @returns "RSA" or "ECC" or null if unknown
 */
function getCertificateKeyType(certificate: Buffer): "RSA" | "ECC" | null {
    try {
        const certInfo = exploreCertificate(certificate);
        
        // Use the signature algorithm to determine the key type
        // RSA algorithms include RSA-SHA1, RSA-SHA256, etc.
        // ECC algorithms include ECDSA-SHA256, etc.
        const signatureAlgorithm = certInfo.signatureAlgorithm;
        debugLog("Certificate signatureAlgorithm:", signatureAlgorithm);
        
        // Convert AlgorithmIdentifier to string
        const algorithmStr = typeof signatureAlgorithm === "string" 
            ? signatureAlgorithm 
            : (signatureAlgorithm as any)?.identifier || signatureAlgorithm?.toString();
        
        if (!algorithmStr) {
            warningLog("Unable to extract signature algorithm from certificate");
            return null;
        }
        
        const algorithmLower = algorithmStr.toLowerCase();
        
        // Check for RSA algorithms
        // OID format: "1.2.840.113549.1.1.x" (all RSA signature OIDs)
        // String format: "sha256WithRSAEncryption", "sha1WithRSAEncryption", "rsaEncryption", etc.
        if (algorithmStr.startsWith("1.2.840.113549.1.1") || 
            algorithmLower.includes("rsa")) {
            return "RSA";
        }
        
        // Check for ECDSA algorithms
        // OID format: "1.2.840.10045.4.x" (all ECDSA signature OIDs)
        // String format: "ecdsa-with-SHA256", "ecdsaWithSHA256", etc.
        if (algorithmStr.startsWith("1.2.840.10045.4") || 
            algorithmLower.includes("ecdsa") || 
            algorithmLower.includes("ecc")) {
            return "ECC";
        }
        
        warningLog("Unknown certificate signature algorithm:", algorithmStr);
        return null;
    } catch (err) {
        errorLog("Error extracting certificate key type:", (err as Error).message);
        return null;
    }
}

/**
 * Validate that the certificate type matches the expected type from certificateTypeId
 * 
 * Note: This function requires the certificate to extract its key type (RSA/ECC) and match it
 * against the certificateTypeId. For validating certificateTypeId without a certificate
 * (e.g., in createSigningRequest where no cert exists yet), use inline validation instead.
 * 
 * FIXME: Consider extracting certificateTypeId validation into a separate function
 * that doesn't require the certificate, to avoid code duplication between
 * createSigningRequest and updateCertificate.
 * 
 * @param certificate The certificate to validate
 * @param certificateTypeId The NodeId of the expected certificate type
 * @returns true if valid or if validation is not applicable
 */
function validateCertificateType(certificate: Buffer, certificateTypeId: NodeId | string): boolean {
    // FIXME: Certificate type validation should check against CertificateTypes property
    // Currently we validate against a hardcoded list of known OPC UA certificate types.
    // Per OPC UA Part 12, the validation should instead check if the certificateTypeId
    // is present in the CertificateTypes Property of the specific CertificateGroup Object.
    // This would allow custom certificate types and proper per-group validation.
    // Implementation steps:
    // 1. Accept certificateGroupId as parameter to identify which group to check
    // 2. Browse the CertificateGroup Object to read its CertificateTypes Property value
    // 3. Check if certificateTypeId exists in that list
    // 4. Return false if not found in the group's permitted types
    
    // If certificateTypeId is null or not specified, skip validation
    if (!certificateTypeId || 
        (certificateTypeId instanceof NodeId && sameNodeId(certificateTypeId, NodeId.nullNodeId))) {
        return true;
    }
    
    const keyType = getCertificateKeyType(certificate);
    if (!keyType) {
        // If we can't determine the key type, allow it (backward compatibility)
        return true;
    }
    
    // Convert to NodeId if string
    let typeNodeId: NodeId;
    if (typeof certificateTypeId === "string") {
        try {
            typeNodeId = resolveNodeId(certificateTypeId);
        } catch {
            // Invalid NodeId string, skip validation
            return true;
        }
    } else {
        typeNodeId = certificateTypeId;
    }
    
    // Check again after conversion - empty string becomes null NodeId
    if (sameNodeId(typeNodeId, NodeId.nullNodeId)) {
        return true;
    }

    // The CertificateType specifies the type of an Application Instance Certificate.
    // Different types define requirements for key length, signature algorithm, and key usage.
    // The certificateType argument in UpdateCertificate and CreateSigningRequest specifies
    // which type of certificate is expected.
    
    // Check if the certificate type matches
    if (keyType === "RSA") {
        return rsaCertificateTypes.some(t => sameNodeId(t, typeNodeId));
    } else if (keyType === "ECC") {
        return eccCertificateTypes.some(t => sameNodeId(t, typeNodeId));
    }
    
    // If we reach here, the certificateTypeId is specified but doesn't match
    // any known type - this should fail validation
    warningLog("Certificate typeId does not match known RSA or ECC types:", certificateTypeId);
    return false;
}

export interface PushCertificateManagerServerOptions {
    applicationGroup?: CertificateManager;
    userTokenGroup?: CertificateManager;
    httpsGroup?: CertificateManager;

    applicationUri: string;
}

type Functor = () => Promise<void>;

export async function copyFile(source: string, dest: string): Promise<void> {
    try {
        debugLog("copying file \n source ", source, "\n =>\n dest ", dest);
        const sourceExist = fs.existsSync(source);
        if (sourceExist) {
            await fs.promises.copyFile(source, dest);
        }
    } catch (err) {
        errorLog(err);
    }
}

export async function deleteFile(file: string): Promise<void> {
    try {
        const exists = fs.existsSync(file);
        if (exists) {
            debugLog("deleting file ", file);
            await fs.promises.unlink(file);
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


export function subjectToString(subject: SubjectOptions & DirectoryName): string {
    let s = "";
    subject.commonName && (s += `/CN=${subject.commonName}`);

    subject.country && (s += `/C=${subject.country}`);
    subject.countryName && (s += `/C=${subject.countryName}`);

    subject.domainComponent && (s += `/DC=${subject.domainComponent}`);

    subject.locality && (s += `/L=${subject.locality}`);
    subject.localityName && (s += `/L=${subject.localityName}`);

    subject.organization && (s += `/O=${subject.organization}`);
    subject.organizationName && (s += `/O=${subject.organizationName}`);

    subject.organizationUnitName && (s += `/OU=${subject.organizationUnitName}`);

    subject.state && (s += `/ST=${subject.state}`);
    subject.stateOrProvinceName && (s += `/ST=${subject.stateOrProvinceName}`);

    return s;
}

export type ActionQueue = (() => Promise<void>)[];

export class PushCertificateManagerServerImpl extends EventEmitter implements PushCertificateManager {
    public applicationGroup?: CertificateManager;
    public userTokenGroup?: CertificateManager;
    public httpsGroup?: CertificateManager;

    private readonly _map: { [key: string]: CertificateManager } = {};
    private readonly _pendingTasks: Functor[] = [];
    private _tmpCertificateManager?: CertificateManager;
    private $$actionQueue: ActionQueue = [];
    private fileCounter = 0;
    private _updateCertificateInProgress = false;

    private applicationUri: string;

    constructor(options: PushCertificateManagerServerOptions) {
        super();

        this.applicationUri = options ? options.applicationUri : "";

        if (options) {
            this.applicationGroup = options.applicationGroup;
            this.userTokenGroup = options.userTokenGroup;
            this.httpsGroup = options.httpsGroup;
            if (this.userTokenGroup) {
                this._map.DefaultUserTokenGroup = this.userTokenGroup;

                // istanbul ignore next
                if (!(this.userTokenGroup instanceof CertificateManager)) {
                    errorLog(
                        "Expecting this.userTokenGroup to be instanceof CertificateManager :",
                        (this.userTokenGroup as any).constructor.name
                    );
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
        
        // Clean up any stale pending files from previous failed operations
        await this.cleanupPendingFiles();
    }
    
    /**
     * Remove all pending files and temporary directories from certificate folders.
     * This is called during initialization to clean up stale files from previous failed operations,
     * and can be called after errors to ensure no temporary files remain.
     * Cleans up:
     * - _pending_issuer_* files from issuers/certs
     * - _pending_certificate* files from own/certs
     * - _pending_private_key* files from own/private
     * - tmp/ directories with abandoned temporary certificates/keys
     */
    private async cleanupPendingFiles(): Promise<void> {
        const groups = [this.applicationGroup, this.userTokenGroup, this.httpsGroup];
        
        for (const group of groups) {
            if (!group) continue;
            
            // Define folders and their corresponding pending file patterns
            const foldersToClean = [
                { folder: path.join(group.rootDir, "issuers/certs"), pattern: "_pending_issuer_" },
                { folder: path.join(group.rootDir, "own/certs"), pattern: "_pending_certificate" },
                { folder: path.join(group.rootDir, "own/private"), pattern: "_pending_private_key" }
            ];
            
            for (const { folder, pattern } of foldersToClean) {
                try {
                    const files = await readdir(folder);
                    const pendingFiles = files.filter(f => f.startsWith(pattern));
                    
                    if (pendingFiles.length > 0) {
                        debugLog(`Cleaning up ${pendingFiles.length} stale pending files from ${folder}`);
                        
                        for (const file of pendingFiles) {
                            const filePath = path.join(folder, file);
                            try {
                                await fs.promises.unlink(filePath);
                                debugLog(`Removed stale pending file: ${file}`);
                            } catch (err) {
                                warningLog(`Failed to remove stale pending file ${file}:`, err);
                            }
                        }
                    }
                } catch (err) {
                    // Folder doesn't exist or other error - this is fine during cleanup
                    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                        warningLog(`Error during pending files cleanup in ${folder}:`, err);
                    }
                }
            }
            
            // Clean up tmp directory if it exists (from abandoned createSigningRequest operations)
            const tmpDir = path.join(group.rootDir, "tmp");
            try {
                await rimraf.rimraf(tmpDir);
                debugLog(`Cleaned up tmp directory: ${tmpDir}`);
            } catch (err) {
                warningLog(`Failed to cleanup tmp directory ${tmpDir}:`, err);
            }
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
        subjectName: string | SubjectOptions | null,
        regeneratePrivateKey?: boolean,
        nonce?: Buffer
    ): Promise<CreateSigningRequestResult> {
        let certificateManager = this.getCertificateManager(certificateGroupId);

        if (!certificateManager) {
            debugLog(" cannot find group ", certificateGroupId);
            return {
                statusCode: StatusCodes.BadInvalidArgument
            };
        }

        // OPC UA Part 12 - CreateSigningRequest Method:
        // The certificateTypeId specifies the type of Certificate being requested.
        // The set of permitted types is specified by the CertificateTypes Property 
        // belonging to the Certificate Group. Valid types are defined in OPC UA Part 12, Section 6.3.2.
        // Note: Unlike certificateGroupId, there is no "If null" clause in the spec for certificateTypeId.
        // However, null NodeId and empty string are accepted (treated as "no type validation").
        
        // FIXME: Certificate type validation should check against CertificateTypes property
        // Currently we validate against a hardcoded list of known OPC UA certificate types.
        // Per OPC UA Part 12, the validation should instead check if the certificateTypeId
        // is present in the CertificateTypes Property of the specific CertificateGroup Object.
        // This would allow custom certificate types and proper per-group validation.
        // Implementation steps:
        // 1. Browse the CertificateGroup Object to read its CertificateTypes Property value
        // 2. Check if certificateTypeId exists in that list
        // 3. Return BadInvalidArgument if not found in the group's permitted types
        
        if (certificateTypeId) {
            let typeNodeId: NodeId;
            if (typeof certificateTypeId === "string") {
                // Empty string is accepted for backward compatibility (skip validation)
                if (certificateTypeId === "") {
                    // Skip validation - backward compatibility
                } else {
                    try {
                        typeNodeId = resolveNodeId(certificateTypeId);
                    } catch {
                        // Invalid NodeId string - return error
                        warningLog("Invalid certificateTypeId string:", certificateTypeId);
                        return {
                            statusCode: StatusCodes.BadInvalidArgument
                        };
                    }
                    
                    // Check if it's a null NodeId - accept it (skip validation)
                    if (sameNodeId(typeNodeId, NodeId.nullNodeId)) {
                        // Skip validation - null NodeId means no type specified
                    } else {
                        // Validate the type
                        const isValidType = rsaCertificateTypes.some(t => sameNodeId(t, typeNodeId!)) || 
                                            eccCertificateTypes.some(t => sameNodeId(t, typeNodeId!));
                        
                        if (!isValidType) {
                            warningLog("Unknown or unsupported certificateTypeId:", certificateTypeId);
                            return {
                                statusCode: StatusCodes.BadInvalidArgument
                            };
                        }
                        
                        // FIXME: ECC key generation is not yet supported
                        // To implement ECC support:
                        // 1. Map certificateTypeId to ECC curve (e.g., i=12557 -> prime256v1, i=12558 -> secp384r1)
                        // 2. Extend CertificateManager to accept curve parameter instead of/alongside keySize
                        // 3. Add conditional logic to pass either keySize (RSA) or curve (ECC) to CertificateManager
                        // For now, we only support RSA key generation
                        const isEccType = eccCertificateTypes.some(t => sameNodeId(t, typeNodeId!));
                        if (isEccType && regeneratePrivateKey) {
                            warningLog("ECC certificate type requested but ECC key generation is not yet supported:", certificateTypeId);
                            return {
                                statusCode: StatusCodes.BadNotSupported
                            };
                        }
                    }
                }
            } else {
                // certificateTypeId is a NodeId object
                typeNodeId = certificateTypeId;
                
                // Check if it's a null NodeId - accept it (skip validation)
                if (sameNodeId(typeNodeId, NodeId.nullNodeId)) {
                    // Skip validation - null NodeId means no type specified
                } else {
                    // Validate the type
                    const isValidType = rsaCertificateTypes.some(t => sameNodeId(t, typeNodeId)) || 
                                        eccCertificateTypes.some(t => sameNodeId(t, typeNodeId));
                    
                    if (!isValidType) {
                        warningLog("Unknown or unsupported certificateTypeId:", certificateTypeId);
                        return {
                            statusCode: StatusCodes.BadInvalidArgument
                        };
                    }
                    
                    // FIXME: ECC key generation is not yet supported
                    // To implement ECC support:
                    // 1. Map certificateTypeId to ECC curve (e.g., i=12557 -> prime256v1, i=12558 -> secp384r1)
                    // 2. Extend CertificateManager to accept curve parameter instead of/alongside keySize
                    // 3. Add conditional logic to pass either keySize (RSA) or curve (ECC) to CertificateManager
                    // For now, we only support RSA key generation
                    const isEccType = eccCertificateTypes.some(t => sameNodeId(t, typeNodeId));
                    if (isEccType && regeneratePrivateKey) {
                        warningLog("ECC certificate type requested but ECC key generation is not yet supported:", certificateTypeId);
                        return {
                            statusCode: StatusCodes.BadNotSupported
                        };
                    }
                }
            }
        }

        if (!subjectName) {
            // reuse existing subjectName
            const currentCertificateFilename = path.join(certificateManager.rootDir, "own/certs/certificate.pem");
            try {
                const certificate = readCertificate(currentCertificateFilename);
                const e = exploreCertificate(certificate);
                subjectName = subjectToString(e.tbsCertificate.subject);
                warningLog("reusing existing certificate subjectName = ", subjectName);
            } catch (err) {
                errorLog("Cannot find existing certificate to extract subjectName", currentCertificateFilename, ":", (err as Error).message);
                return {
                    statusCode: StatusCodes.BadInvalidState
                };
            }
        }

        if (regeneratePrivateKey) {
            // The Server shall create a new Private Key which it stores until the
            // matching signed Certificate is uploaded with the UpdateCertificate Method.
            // Previously created Private Keys may be discarded if UpdateCertificate was not
            // called before calling this method again.

            // Additional entropy which the caller shall provide if regeneratePrivateKey is TRUE.
            // It shall be at least 32 bytes long
            if (!nonce || nonce.length < 32) {
                make_warningLog(
                    " nonce should be provided when regeneratePrivateKey is set, and length shall be at least 32 bytes"
                );
                return {
                    statusCode: StatusCodes.BadInvalidArgument
                };
            }

            const location = path.join(certificateManager.rootDir, "tmp");
            // Clean up existing tmp directory if present
            await rimraf.rimraf(path.join(location));
            // Create fresh tmp directory
            await fs.promises.mkdir(location, { recursive: true });

            const destCertificateManager = certificateManager;
            const keySize = (certificateManager as any).keySize; // because keySize is private !
            certificateManager = new CertificateManager({
                keySize,
                location
            });
            debugLog("generating a new private key ...");
            await certificateManager.initialize();

            this._tmpCertificateManager = certificateManager;

            this.addPendingTask(async () => {
                await moveFileWithBackup(certificateManager!.privateKey, destCertificateManager.privateKey);
            });
            this.addPendingTask(async () => {
                await rimraf.rimraf(path.join(location));
            });
        } else {
            // The Server uses its existing Private Key
        }

        if (typeof subjectName !== "string") {
            return { statusCode: StatusCodes.BadInternalError };
        }
        const options = {
            applicationUri: this.applicationUri,
            subject: subjectName!
        };
        await certificateManager.initialize();
        const csrFile = await certificateManager.createCertificateRequest(options);
        const csrPEM = await readFile(csrFile, "utf8");
        const certificateSigningRequest = convertPEMtoDER(csrPEM);

        this.addPendingTask(() => deleteFile(csrFile));

        return {
            certificateSigningRequest,
            statusCode: StatusCodes.Good
        };
    }

    public async getRejectedList(): Promise<GetRejectedListResult> {
        interface FileData {
            filename: string;
            stat: {
                mtime: Date;
            };
        }

        // rejectedList comes from each group
        async function extractRejectedList(group: CertificateManager | undefined, certificateList: FileData[]): Promise<void> {
            if (!group) {
                return;
            }
            const rejectedFolder = path.join(group.rootDir, "rejected");
            const files = await readdir(rejectedFolder);

            const stat = fs.promises.stat;

            const promises1: Promise<fs.Stats>[] = [];
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
        list.sort((a: FileData, b: FileData) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

        const promises: Promise<string>[] = [];
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

    // eslint-disable-next-line max-statements
    public async updateCertificate(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        certificate: Buffer,
        issuerCertificates: ByteString[],
        privateKeyFormat?: string,
        privateKey?: Buffer | string
    ): Promise<UpdateCertificateResult> {
        if (this._updateCertificateInProgress) {
            return {
                statusCode: StatusCodes.BadTooManyOperations,
                applyChangesRequired: false
            };
        }

        this._updateCertificateInProgress = true;
        try {
        // Result Code                Description
        // BadInvalidArgument        The certificateTypeId or certificateGroupId is not valid.
        // BadCertificateInvalid     The Certificate is invalid or the format is not supported.
        // BadNotSupported           The Private Key is invalid or the format is not supported.
        // BadUserAccessDenied       The current user does not have the rights required.
        // BadSecurityChecksFailed   Some failure occurred verifying the integrity of the Certificate.
        const certificateManager = this.getCertificateManager(certificateGroupId)!;

        if (!certificateManager) {
            debugLog(" cannot find group ", certificateGroupId);
            return {
                statusCode: StatusCodes.BadInvalidArgument,
                applyChangesRequired: false
            };
        }

        // Validate certificate type if specified
        if (!validateCertificateType(certificate, certificateTypeId)) {
            warningLog("Certificate type does not match expected certificateTypeId", certificateTypeId);
            return {
                statusCode: StatusCodes.BadCertificateInvalid,
                applyChangesRequired: false
            };
        }

        // Process issuer certificates - stage them to temporary files and add move tasks to _pendingTasks
        async function preInstallIssuerCertificates(self: PushCertificateManagerServerImpl) {
            if (issuerCertificates && issuerCertificates.length > 0) {
                const issuerFolder = path.join(certificateManager.rootDir, "issuers/certs");
                const pendingFilesCreated: string[] = [];

                // Ensure the directory exists before writing files
                await fs.promises.mkdir(issuerFolder, { recursive: true });
                
                for (let i = 0; i < issuerCertificates.length; i++) {
                    const issuerCert = issuerCertificates[i];
                    
                    const thumbprint = makeSHA1Thumbprint(issuerCert).toString("hex");
                    
                    // Write to temporary/pending files instead of final destination
                    const pendingIssuerFileDER = path.join(issuerFolder, `_pending_issuer_${thumbprint}${self.fileCounter++}.der`);
                    const pendingIssuerFilePEM = path.join(issuerFolder, `_pending_issuer_${thumbprint}${self.fileCounter++}.pem`);
                    
                    const finalIssuerFileDER = path.join(issuerFolder, `issuer_${thumbprint}.der`);
                    const finalIssuerFilePEM = path.join(issuerFolder, `issuer_${thumbprint}.pem`);
                    
                    // Write issuer certificate in both DER and PEM format to temporary files
                    await writeFile(pendingIssuerFileDER, issuerCert, "binary");
                    pendingFilesCreated.push(pendingIssuerFileDER);
                    
                    await writeFile(pendingIssuerFilePEM, toPem(issuerCert, "CERTIFICATE"), "utf-8");
                    pendingFilesCreated.push(pendingIssuerFilePEM);
                    
                    // Stage the move operations to be applied on applyChanges()
                    self.addPendingTask(() => moveFileWithBackup(pendingIssuerFileDER, finalIssuerFileDER));
                    self.addPendingTask(() => moveFileWithBackup(pendingIssuerFilePEM, finalIssuerFilePEM));
                    
                    debugLog(`Staged issuer certificate ${i + 1}/${issuerCertificates.length}: ${thumbprint}`);
                }
            }
        }

        async function preInstallCertificate(self: PushCertificateManagerServerImpl) {
            const certFolder = path.join(certificateManager.rootDir, "own/certs");
            const certificateFileDER = path.join(certFolder, `_pending_certificate${self.fileCounter++}.der`);
            const certificateFilePEM = path.join(certFolder, `_pending_certificate${self.fileCounter++}.pem`);

            await writeFile(certificateFileDER, certificate, "binary");
            await writeFile(certificateFilePEM, toPem(certificate, "CERTIFICATE"));

            const destDER = path.join(certFolder, "certificate.der");
            const destPEM = path.join(certFolder, "certificate.pem");

            // put existing file in security by backing them up
            self.addPendingTask(() => moveFileWithBackup(certificateFileDER, destDER));
            self.addPendingTask(() => moveFileWithBackup(certificateFilePEM, destPEM));
        }

        async function preInstallPrivateKey(self: PushCertificateManagerServerImpl) {
            assert(privateKeyFormat!.toUpperCase() === "PEM");

            const ownPrivateFolder = path.join(certificateManager.rootDir, "own/private");
            const privateKeyFilePEM = path.join(ownPrivateFolder, `_pending_private_key${self.fileCounter++}.pem`);

            if (privateKey) {
                const privateKey1 = coercePEMorDerToPrivateKey(privateKey);
                const privateKeyPEM = await coercePrivateKeyPem(privateKey1);
                await writeFile(privateKeyFilePEM, privateKeyPEM, "utf-8");
                self.addPendingTask(() => moveFileWithBackup(privateKeyFilePEM, certificateManager.privateKey));
            }
        }

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
        
        // FIXME: Additional certificate validation checks required per OPC UA Part 4 & 6:
        // 1. SubjectAltName (SAN) validation:
        //    - Must contain applicationUri as uniformResourceIdentifier
        //    - Should match this.applicationUri
        //    - May contain DNS names and IP addresses
        // 2. Key Usage extension (critical):
        //    - For application certificates: digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
        //    - Should be marked as critical
        // 3. Extended Key Usage:
        //    - serverAuth (1.3.6.1.5.5.7.3.1) for OPC UA servers
        //    - clientAuth (1.3.6.1.5.5.7.3.2) for OPC UA clients
        // 4. Subject Distinguished Name validation:
        //    - Should contain meaningful organization/common name
        //    - Common Name should match application name
        // 5. Key length validation:
        //    - RSA: minimum 2048 bits (per certificateTypeId i=12541 or i=12542)
        //    - ECC: curve must match certificateTypeId (nistP256, nistP384, etc.)
        // 6. Signature algorithm strength:
        //    - Should be SHA256 or stronger (no SHA1, MD5)
        //    - RSA signatures should use PKCS#1 v1.5 or PSS
        // 7. Basic Constraints:
        //    - CA: FALSE for application instance certificates
        // Currently implemented: parseability, validity dates (notBefore/notAfter), certificateTypeId matching
        
        let certInfo;
        try {
            certInfo = exploreCertificate(certificate);
        } catch (err) {
            // Certificate is invalid or cannot be parsed
            errorLog("Cannot parse certificate:", (err as Error).message);
            return {
                statusCode: StatusCodes.BadCertificateInvalid,
                applyChangesRequired: false
            };
        }

        const issuerCertBuffers = (issuerCertificates || []).filter((cert): cert is Buffer => {
            return Buffer.isBuffer(cert) && cert.length > 0;
        });
        if ((issuerCertificates || []).length !== issuerCertBuffers.length) {
            warningLog("issuerCertificates contains invalid entries");
            return {
                statusCode: StatusCodes.BadCertificateInvalid,
                applyChangesRequired: false
            };
        }

        for (const issuerCert of issuerCertBuffers) {
            try {
                const issuerInfo = exploreCertificate(issuerCert);
                const nowIssuer = new Date();
                if (issuerInfo.tbsCertificate.validity.notBefore.getTime() > nowIssuer.getTime()) {
                    warningLog("Issuer certificate is not yet valid");
                    return {
                        statusCode: StatusCodes.BadSecurityChecksFailed,
                        applyChangesRequired: false
                    };
                }
                if (issuerInfo.tbsCertificate.validity.notAfter.getTime() < nowIssuer.getTime()) {
                    warningLog("Issuer certificate is out of date");
                    return {
                        statusCode: StatusCodes.BadSecurityChecksFailed,
                        applyChangesRequired: false
                    };
                }
            } catch (err) {
                errorLog("Cannot parse issuer certificate:", (err as Error).message);
                return {
                    statusCode: StatusCodes.BadCertificateInvalid,
                    applyChangesRequired: false
                };
            }
        }

        if (issuerCertBuffers.length > 0) {
            const chainCheck = await verifyCertificateChain([certificate, ...issuerCertBuffers]);
            if (chainCheck.status !== "Good") {
                warningLog("Issuer chain validation failed:", chainCheck.status, chainCheck.reason);
                return {
                    statusCode: StatusCodes.BadSecurityChecksFailed,
                    applyChangesRequired: false
                };
            }
        }

        const certificateChain = Buffer.concat([certificate, ...issuerCertBuffers]);
        
        // Skip trust validation for the application group (server's own certificate)
        // Trust validation is only relevant for client certificates, not the server's own certificate
        const isApplicationGroup = certificateManager === this.applicationGroup;
        
        if (!isApplicationGroup) {
            const verifyCertificate = (certificateManager as any).verifyCertificate as
                | ((chain: Buffer) => Promise<string> | string)
                | undefined;
            const checkCertificate = (certificateManager as any).checkCertificate as
                | ((chain: Buffer) => Promise<StatusCode>)
                | undefined;

            if (verifyCertificate) {
                const status = await Promise.resolve(verifyCertificate.call(certificateManager, certificateChain));
                if (status !== "Good") {
                    warningLog("Certificate trust validation failed:", status);
                    return {
                        statusCode: StatusCodes.BadSecurityChecksFailed,
                        applyChangesRequired: false
                    };
                }
            } else if (checkCertificate) {
                const statusCode = await checkCertificate.call(certificateManager, certificateChain);
                if (statusCode && statusCode.isNotGood()) {
                    warningLog("Certificate trust validation failed:", statusCode.toString());
                    return {
                        statusCode: StatusCodes.BadSecurityChecksFailed,
                        applyChangesRequired: false
                    };
                }
            }
        }

        const now = new Date();
        if (certInfo.tbsCertificate.validity.notBefore.getTime() > now.getTime()) {
            // certificate is not yet valid
            warningLog(
                "Certificate is not yet valid : not before ",
                certInfo.tbsCertificate.validity.notBefore.toISOString(),
                "now = ",
                now.toISOString()
            );
            return {
                statusCode: StatusCodes.BadSecurityChecksFailed,
                applyChangesRequired: false
            };
        }
        if (certInfo.tbsCertificate.validity.notAfter.getTime() < now.getTime()) {
            // certificate is already out of date
            warningLog(
                "Certificate is already out of date : not after ",
                certInfo.tbsCertificate.validity.notAfter.toISOString(),
                "now = ",
                now.toISOString()
            );
            return {
                statusCode: StatusCodes.BadSecurityChecksFailed,
                applyChangesRequired: false
            };
        }

        // If the Server returns applyChangesRequired=FALSE then it is indicating that it is able to
        // satisfy the requirements specified for the ApplyChanges Method.

        debugLog(" updateCertificate ", makeSHA1Thumbprint(certificate).toString("hex"));

        // The privateKeyFormat and privateKey parameters are optional but must be provided together.
        // If privateKey is provided, privateKeyFormat specifies the format of the privateKey.
        // The three use cases are:
        //   1. New certificate from signing request (no privateKey/privateKeyFormat)
        //   2. New privateKey and certificate created outside server (both provided)
        //   3. New certificate signed from old certificate info (no privateKey/privateKeyFormat)
        // Validate that privateKeyFormat and privateKey are provided together
        // Treat empty strings and empty buffers as not provided (undefined/null)
        const hasPrivateKeyFormat = privateKeyFormat !== undefined && privateKeyFormat !== null && privateKeyFormat !== "";
        const hasPrivateKey = privateKey !== undefined && privateKey !== null && 
                              privateKey !== "" && 
                              !(privateKey instanceof Buffer && privateKey.length === 0);
        
        if (hasPrivateKeyFormat !== hasPrivateKey) {
            // Only one of the two parameters is provided - this is invalid
            warningLog("privateKeyFormat and privateKey must both be provided or both be omitted");
            return {
                statusCode: StatusCodes.BadInvalidArgument,
                applyChangesRequired: false
            };
        }

        if (!hasPrivateKeyFormat && !hasPrivateKey) {
            // Neither privateKeyFormat nor privateKey are provided
            // first of all we need to find the future private key;
            // this one may have been created during the creation of the certificate signing request
            // but is not active yet
            const privateKey1 = readPrivateKey(
                this._tmpCertificateManager ? this._tmpCertificateManager.privateKey : certificateManager.privateKey
            );

            // The Server shall report an error if the public key does not match the existing Certificate and
            // the privateKey was not provided.
            // privateKey is not provided, so check that the public key matches the existing certificate
            if (!certificateMatchesPrivateKey(certificate, privateKey1)) {
                // certificate doesn't match privateKey
                warningLog("certificate doesn't match privateKey");
                /* debug code */
                const certificatePEM = toPem(certificate, "CERTIFICATE");
                certificatePEM;
                //xx const privateKeyPEM = toPem(privateKeyDER, "RSA PRIVATE KEY");
                //xx const initialBuffer = Buffer.from("Lorem Ipsum");
                //xx const encryptedBuffer = publicEncrypt_long(initialBuffer, certificatePEM, 256, 11);
                //xx const decryptedBuffer = privateDecrypt_long(encryptedBuffer, privateKeyPEM, 256);
                return { 
                    statusCode: StatusCodes.BadSecurityChecksFailed,
                    applyChangesRequired: false,
                };
            }
            await preInstallIssuerCertificates(this);
            await preInstallCertificate(this);
            return {
                statusCode: StatusCodes.Good,
                applyChangesRequired: true,
            };
        } else {
            // Both privateKey and privateKeyFormat are provided by the caller
            // Validate privateKeyFormat
            if (privateKeyFormat !== "PEM" && privateKeyFormat !== "PFX") {
                warningLog(" the private key format is invalid privateKeyFormat =" + privateKeyFormat);
                return { statusCode: StatusCodes.BadNotSupported, applyChangesRequired: false };
            }
            if (privateKeyFormat !== "PEM") {
                warningLog("in NodeOPCUA we only support PEM for the moment privateKeyFormat =" + privateKeyFormat);
                return { statusCode: StatusCodes.BadNotSupported , applyChangesRequired: false };
            }

            // Convert privateKey to PrivateKey object
            let privateKey1: PrivateKey | undefined;
            if (privateKey instanceof Buffer || typeof privateKey === "string") {
                if (privateKey instanceof Buffer) {
                    assert(privateKeyFormat === "PEM");
                    privateKey = privateKey.toString("utf-8");
                }
                privateKey1 = coercePEMorDerToPrivateKey(privateKey);
            }
            if (!privateKey1) {
                return { statusCode: StatusCodes.BadNotSupported, applyChangesRequired: false };
            }
            
            // Verify that the certificate matches the provided private key
            if (!certificateMatchesPrivateKey(certificate, privateKey1)) {
                warningLog("certificate doesn't match privateKey");
                return { statusCode: StatusCodes.BadSecurityChecksFailed, applyChangesRequired: false };
            }

            await preInstallPrivateKey(this);
            await preInstallIssuerCertificates(this);
            await preInstallCertificate(this);

            return {
                statusCode: StatusCodes.Good,
                applyChangesRequired: true
            };
        }
        } finally {
            this._updateCertificateInProgress = false;
        }
    }

    /**
     * 
     * ApplyChanges is used to apply pending Certificate and TrustList updates 
     * and to complete a transaction as described in 7.10.2.
     * 
     * ApplyChanges returns Bad_InvalidState if any TrustList is still open for writing.
     * No changes are applied and ApplyChanges can be called again after the TrustList is closed.
     * 
     * If a Session is closed or abandoned then the transaction is closed and all pending changes are discarded.
     * 
     * If ApplyChanges is called and there is no active transaction then the Server returns Bad_NothingToDo. 
     * If there is an active transaction, however, no changes are pending the result is Good and the transaction is closed.
     * 
     * When a Server Certificate or TrustList changes active SecureChannels are not immediately affected.
     * This ensures the caller of ApplyChanges can get a response to the Method call. 
     * Once the Method response is returned the Server shall force existing SecureChannels affected by 
     * the changes to renegotiate and use the new Server Certificate and/or TrustLists.
     * 
     * Servers may close SecureChannels without discarding any Sessions or Subscriptions. 
     * This will seem like a network interruption from the perspective of the Client and the Client reconnect 
     * logic (see OPC 10000-4) allows them to recover their Session and Subscriptions. 
     * Note that some Clients may not be able to reconnect because they are no longer trusted.
     * 
     * Other Servers may need to do a complete shutdown.
     * 
     * In this case, the Server shall advertise its intent to interrupt connections by setting the 
     * SecondsTillShutdown and ShutdownReason Properties in the ServerStatus Variable.
     * 
     * If a TrustList change only affects UserIdentity associated with a Session then Servers 
     * shall re-evaluate the UserIdentity and if it is no longer valid the Session and associated 
     * Subscriptions are closed.
     * 
     * This Method shall be called from an authenticated SecureChannel and from the Session that 
     * created the transaction and has access to the SecurityAdmin Role (see 7.2).
     * 
     */
    public async applyChanges(): Promise<StatusCode> {
        // ApplyChanges is used to tell the Server to apply any security changes.
        // This Method should only be called if a previous call to a Method that changed the
        // configuration returns applyChangesRequired=true.
        //
        // If the Server Certificate has changed, Secure Channels using the old Certificate will
        // eventually be interrupted.

        // Check if there are any pending tasks
        if (this._pendingTasks.length === 0 && this.$$actionQueue.length === 0) {
            // If ApplyChanges is called and there is no active transaction then return Bad_NothingToDo
            return StatusCodes.BadNothingToDo;
        }
        
        try {
            this.emit("CertificateAboutToChange", this.$$actionQueue);
        } catch (err) {
            errorLog("Event listener error:", (err as Error).message);
        }
        await this.flushActionQueue();

        try {
            await this.applyPendingTasks();
        } catch (err) {
            debugLog("err ", (err as Error).message);
            return StatusCodes.BadInternalError;
        }
        try {
            this.emit("CertificateChanged", this.$$actionQueue);
        } catch (err) {
            errorLog("Event listener error:", (err as Error).message);
        }
        await this.flushActionQueue();

        // Clear temporary certificate manager after applying changes
        this._tmpCertificateManager = undefined;

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

    private getCertificateManager(certificateGroupId: NodeId | string): CertificateManager | null {
        const groupName = findCertificateGroupName(certificateGroupId);
        return this._map[groupName] || null;
    }

    private addPendingTask(functor: () => Promise<void>): void {
        this._pendingTasks.push(functor);
    }

    private async applyPendingTasks(): Promise<void> {
        debugLog("start applyPendingTasks");
        const promises: Promise<void>[] = [];
        const t = this._pendingTasks.splice(0);

        // FIXME: Transaction rollback capability
        // If a task fails partway through, we currently clean up pending files but don't
        // restore the previous certificate state. For true transaction safety, we should:
        // 1. Keep backup references to all files being replaced
        // 2. On error, restore backups atomically (rollback)
        // 3. Implement a two-phase commit pattern:
        //    - Phase 1: Validate all operations can succeed (write to _pending files)
        //    - Phase 2: Commit all changes atomically (move _pending to final)
        // This would prevent partial certificate updates that leave the server in an inconsistent state.
        
        try {
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
        } catch (err) {
            errorLog("Error during applyPendingTasks, cleaning up pending files:", (err as Error).message);
            // Clean up any remaining pending files on error
            await this.cleanupPendingFiles();
            throw err;
        }
    }

    private async flushActionQueue(): Promise<void> {
        while (this.$$actionQueue.length) {
            const first = this.$$actionQueue.pop()!;
            await first!();
        }
    }
}
