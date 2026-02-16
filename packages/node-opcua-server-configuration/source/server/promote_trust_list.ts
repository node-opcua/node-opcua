/**
 * @module node-opcua-server-configuration
 */

import { fs as MemFs } from "memfs";

import {
    MethodFunctor,
    UAMethod,
    UATrustList,
    UAObject,
    UAVariable,
    ISessionContext,
    IAddressSpace
} from "node-opcua-address-space";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { CallbackT, StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions, TrustListDataType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { AccessRestrictionsFlag } from "node-opcua-data-model";
import { CertificateManager } from "node-opcua-pki";
import { AbstractFs, installFileType, OpenFileMode } from "node-opcua-file-transfer";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { split_der, verifyCertificateChain, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { exploreCertificate, readCertificate } from "node-opcua-crypto";
import { BinaryStream } from "node-opcua-binary-stream";

import { TrustListMasks, writeTrustList } from "./trust_list_server";

import { hasEncryptedChannel, hasExpectedUserAccess } from "./tools";
import { rolePermissionAdminOnly } from "./roles_and_permissions";

import fs from "fs";
import path from "path";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
doDebug;
const warningLog = make_warningLog("ServerConfiguration");
const errorLog = debugLog;

function trustListIsAlreadyOpened(trustList: UATrustList): boolean {
    // TrustList extends FileType, which has an openCount property tracking how many handles are open
    const openCountNode = trustList.openCount;
    if (!openCountNode) {
        return false;
    }
    const dataValue = openCountNode.readValue();
    if (!dataValue || !dataValue.value) {
        return false;
    }
    const openCount = dataValue.value.value as number;
    return openCount > 0;
}

/**
 * Update the mandatory LastUpdateTime property whenever the trust list is modified.
 * Per OPC UA Part 12 spec, this must be updated after AddCertificate, RemoveCertificate, or CloseAndUpdate.
 */
function updateLastUpdateTime(trustList: UATrustList): void {
    try {
        const lastUpdateTimeNode = trustList.lastUpdateTime;
        if (lastUpdateTimeNode) {
            lastUpdateTimeNode.setValueFromSource({
                dataType: DataType.DateTime,
                value: new Date()
            });
            debugLog("Updated LastUpdateTime to", new Date().toISOString());
        } else {
            warningLog("LastUpdateTime property not found on TrustList");
        }
    } catch (err) {
        errorLog("Error updating LastUpdateTime:", err);
    }
}

// Helper function to clear all CRL files from a directory
const clearCrlFolder = async (folder: string) => {
    try {
        if (!fs.existsSync(folder)) {
            return;
        }
        const files = await fs.promises.readdir(folder);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (ext === ".crl" || ext === ".der") {
                const filePath = path.join(folder, file);
                await fs.promises.unlink(filePath);
            }
        }
    } catch (err) {
        warningLog("Error clearing CRL folder:", folder, err);
    }
};

// Helper function to write CRL data directly to disk
const writeCrlToDisk = async (folder: string, crlBuffer: Buffer, index: number) => {    
    if (!fs.existsSync(folder)) {
        await fs.promises.mkdir(folder, { recursive: true });
    }
    
    // Use .crl extension for the files
    const filename = path.join(folder, `crl_${index}.crl`);
    await fs.promises.writeFile(filename, crlBuffer);
};

async function _closeAndUpdate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext,
    _close_method?: MethodFunctor
): Promise<CallMethodResultOptions> {
    const trustList = context.object as UATrustList;
    const cm = ((trustList as any).$$certificateManager as OPCUACertificateManager) || null;
    const filename = (trustList as any).$$filename as string;
    
    // Clear the write lock when closing
    (trustList as any).$$openedForWrite = false;

    // Get the close method if not provided
    if (!_close_method) {
        const closeMethod = trustList.getChildByName("Close") as UAMethod;
        if (closeMethod) {
            _close_method = (closeMethod as any)._asyncExecutionFunction as MethodFunctor;
        }
    }

    if (!cm || !filename) {
        return { statusCode: StatusCodes.BadInternalError };
    }

    // Since we support immediate application (no transactions), read the updated file and persist it
    try {
        if (MemFs.existsSync(filename)) {
            const data = await new Promise<Buffer>((resolve, reject) => {
                MemFs.readFile(filename, (err, data) => {
                    if (err) reject(err);
                    else resolve(data as Buffer);
                });
            });

            // Decode the TrustListDataType
            const stream = new BinaryStream(data);
            const trustListData = new TrustListDataType();
            trustListData.decode(stream);

            // Automatically update specifiedLists mask based on which fields are actually present
            // This ensures that fields with data are processed even if the mask wasn't set correctly
            if (trustListData.issuerCrls && trustListData.issuerCrls.length > 0) {
                trustListData.specifiedLists |= TrustListMasks.IssuerCrls;
            }
            if (trustListData.trustedCrls && trustListData.trustedCrls.length > 0) {
                trustListData.specifiedLists |= TrustListMasks.TrustedCrls;
            }
            if (trustListData.trustedCertificates && trustListData.trustedCertificates.length > 0) {
                trustListData.specifiedLists |= TrustListMasks.TrustedCertificates;
            }
            if (trustListData.issuerCertificates && trustListData.issuerCertificates.length > 0) {
                trustListData.specifiedLists |= TrustListMasks.IssuerCertificates;
            }

            // Process CRLs based on specifiedLists to implement replace/update behavior
            // Clear and replace issuer CRLs if they are part of the specified lists
            if ((trustListData.specifiedLists & TrustListMasks.IssuerCrls) === TrustListMasks.IssuerCrls) {
                // Get or construct issuersCrlFolder path
                let issuerCrlFolder = cm.issuersCrlFolder;
                if (!issuerCrlFolder) {
                    const rootDir = cm.rootDir;
                    if (rootDir) {
                        issuerCrlFolder = path.join(rootDir, "issuers", "crl");
                    }
                }
                if (issuerCrlFolder) {
                    debugLog("Processing issuer CRLs, folder:", issuerCrlFolder);
                    await clearCrlFolder(issuerCrlFolder);
                    if (trustListData.issuerCrls && trustListData.issuerCrls.length > 0) {
                        debugLog(` Writing ${trustListData.issuerCrls.length} issuer CRLs`);
                        for (let i = 0; i < trustListData.issuerCrls.length; i++) {
                            const crl = trustListData.issuerCrls[i];
                            // Write issuer CRLs directly to disk since addRevocationList
                            // goes to the trusted CRL folder, not the issuer CRL folder
                            await writeCrlToDisk(issuerCrlFolder, crl, i);
                            debugLog(`Successfully wrote issuer CRL ${i} directly to disk`);
                        }
                    }
                } else {
                    warningLog("issuerCrlFolder not found, skipping issuer CRL processing");
                }
            }

            // Clear and replace trusted CRLs if they are part of the specified lists
            if ((trustListData.specifiedLists & TrustListMasks.TrustedCrls) === TrustListMasks.TrustedCrls) {
                // Get or construct crlFolder path
                let trustedCrlFolder = cm.crlFolder;
                if (!trustedCrlFolder) {
                    const rootDir = cm.rootDir;
                    if (rootDir) {
                        trustedCrlFolder = path.join(rootDir, "crl");
                    }
                }
                if (trustedCrlFolder) {
                    await clearCrlFolder(trustedCrlFolder);
                    if (trustListData.trustedCrls && trustListData.trustedCrls.length > 0) {
                        for (let i = 0; i < trustListData.trustedCrls.length; i++) {
                            const crl = trustListData.trustedCrls[i];
                            // Write trusted CRLs directly to disk (addRevocationList may go to wrong folder)
                            await writeCrlToDisk(trustedCrlFolder, crl, i);
                        }
                    }
                }
            }

            // OPC UA Spec Part 12 Section 7.8.2.3: "The Server shall verify that every Certificate in the new
            // Trust List is valid according to the mandatory rules defined in Part 4. If an invalid Certificate
            // is found the Server shall return an error and shall not update the Trust List."
            
            // Validate all trusted certificates before applying changes
            if ((trustListData.specifiedLists & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates && trustListData.trustedCertificates) {
                for (const cert of trustListData.trustedCertificates) {
                    try {
                        // Attempt to parse and validate the certificate
                        const certs = split_der(cert);
                        const validationResult = await verifyCertificateChain([certs[0]]);
                        if (validationResult.status !== "Good") {
                            warningLog("Invalid certificate in trust list:", validationResult.status, validationResult.reason);
                            return { statusCode: StatusCodes.BadCertificateInvalid };
                        }
                    } catch (validationErr) {
                        errorLog("Certificate validation failed:", validationErr);
                        return { statusCode: StatusCodes.BadCertificateInvalid };
                    }
                }
            }

            // Validate all issuer certificates before applying changes
            if ((trustListData.specifiedLists & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates && trustListData.issuerCertificates) {
                for (const cert of trustListData.issuerCertificates) {
                    try {
                        // Attempt to parse and validate the certificate
                        const certs = split_der(cert);
                        const validationResult = await verifyCertificateChain([certs[0]]);
                        if (validationResult.status !== "Good") {
                            warningLog("Invalid issuer certificate in trust list:", validationResult.status, validationResult.reason);
                            return { statusCode: StatusCodes.BadCertificateInvalid };
                        }
                    } catch (validationErr) {
                        errorLog("Issuer certificate validation failed:", validationErr);
                        return { statusCode: StatusCodes.BadCertificateInvalid };
                    }
                }
            }

            // Update certificates (only if specified in lists and validation passed)
            if ((trustListData.specifiedLists & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates && trustListData.trustedCertificates) {
                for (const cert of trustListData.trustedCertificates) {
                    await cm.trustCertificate(cert);
                }
            }
            if ((trustListData.specifiedLists & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates && trustListData.issuerCertificates) {
                for (const cert of trustListData.issuerCertificates) {
                    await cm.addIssuer(cert);
                }
            }
        }
        
        // OPC UA Spec: Update LastUpdateTime after successful trust list update
        updateLastUpdateTime(trustList);
    } catch (err) {
        errorLog("Error in _closeAndUpdate:", err);
        return { statusCode: StatusCodes.BadInternalError };
    }

    // Close the underlying file to decrement openCount
    // OPC UA spec: "This Method closes the file and applies the changes."
    if (_close_method) {
        return new Promise<CallMethodResultOptions>((resolve, reject) => {
            _close_method.call(this, inputArguments, context, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    // Override the output argument to match CloseAndUpdate signature
                    resolve({
                        statusCode: result?.statusCode || StatusCodes.Good,
                        outputArguments: [
                            new Variant({ dataType: DataType.Boolean, value: false })
                        ]
                    });
                }
            });
        });
    }

    return {
        statusCode: StatusCodes.Good,
        outputArguments: [
            new Variant({ dataType: DataType.Boolean, value: false })
        ]
    };
}

// in TrustList
async function _addCertificate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    // If the Certificate is issued by a CA then the Client shall provide the entire
    // chain in the certificate argument (see OPC 10000-6). After validating the Certificate,
    // the Server shall add the CA Certificates to the Issuers list in the Trust List.
    // The leaf Certificate is added to the list specified by the isTrustedCertificate argument.
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const trustList = context.object as UATrustList;
    const cm = ((trustList as any).$$certificateManager as CertificateManager) || null;

    // The trust list must have been bound
    if (!cm) {
        return { statusCode: StatusCodes.BadInternalError };
    }
    // This method cannot be called if the file object is open.
    // Check both openCount and write lock flag for safety
    if (trustListIsAlreadyOpened(trustList) || (trustList as any).$$openedForWrite) {
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const certificateBuffer: Buffer = inputArguments[0].value as Buffer;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;

    // OPC UA Spec: "If FALSE Bad_CertificateInvalid is returned."
    // This method cannot add issuer certificates - they must be managed via Write method
    if (!isTrustedCertificate) {
        return { statusCode: StatusCodes.BadCertificateInvalid };
    }

    try {
        // Split the certificate chain to get individual certificates
        const certificates = split_der(certificateBuffer);

        // OPC UA Spec: "This Method cannot provide CRLs so issuer Certificates cannot be added with this Method."
        // "CA Certificates and their CRLs shall be managed with the Write Method on the containing TrustList Object."
        // We only accept the leaf certificate. Any issuer certificates in the chain must already be in the TrustList.
        if (certificates.length > 1) {
            warningLog("AddCertificate received a certificate chain. Only the leaf certificate will be added.");
            warningLog("Issuer certificates must be added using the Write/CloseAndUpdate methods.");
        }

        const leafCertificate = certificates[0];

        // Ensure the leaf certificate can be parsed
        exploreCertificate(leafCertificate);

        // Validate the leaf certificate
        const r = await verifyCertificateChain([leafCertificate]);
        if (r.status !== "Good") {
            warningLog("Invalid certificate ", r.status, r.reason);
            return { statusCode: StatusCodes.BadCertificateInvalid };
        }

        // OPC UA Spec: "This Method will return a validation error if the Certificate is issued by a CA
        // and the Certificate for the issuer is not in the TrustList."
        if (certificates.length > 1) {
            const rootDir = cm.rootDir;
            if (!rootDir) {
                return { statusCode: StatusCodes.BadInternalError };
            }
            const issuerFolder = path.join(rootDir, "issuers", "certs");
            if (!fs.existsSync(issuerFolder)) {
                return { statusCode: StatusCodes.BadCertificateInvalid };
            }

            const issuerFiles = await fs.promises.readdir(issuerFolder);
            const issuerThumbprints = new Set<string>();
            for (const file of issuerFiles) {
                const ext = path.extname(file).toLowerCase();
                if (ext === ".pem" || ext === ".der") {
                    try {
                        const issuerCert = await readCertificate(path.join(issuerFolder, file));
                        const thumbprint = makeSHA1Thumbprint(issuerCert).toString("hex").toLowerCase();
                        issuerThumbprints.add(thumbprint);
                    } catch (err) {
                        warningLog(`Error reading issuer certificate ${file}:`, err);
                    }
                }
            }

            for (const issuerCert of certificates.slice(1)) {
                const issuerThumbprint = makeSHA1Thumbprint(issuerCert).toString("hex").toLowerCase();
                if (!issuerThumbprints.has(issuerThumbprint)) {
                    warningLog("Issuer certificate not found in TrustList", issuerThumbprint);
                    return { statusCode: StatusCodes.BadCertificateInvalid };
                }
            }
        }

        // Add only the leaf certificate to trusted certificates
        await cm.trustCertificate(leafCertificate);
        
        // OPC UA Spec: Update LastUpdateTime after successful modification
        updateLastUpdateTime(trustList);
        
        debugLog("_addCertificate - done, added leaf certificate to trustedCertificates");
        return { statusCode: StatusCodes.Good };
    } catch (err) {
        // Certificate parsing or validation failed
        errorLog("Error in _addCertificate:", err);
        return { statusCode: StatusCodes.BadCertificateInvalid };
    }
}
async function _removeCertificate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }

    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const trustList = context.object as UATrustList;
    const cm = ((trustList as any).$$certificateManager as OPCUACertificateManager) || null;

    // The trust list must have been bound
    if (!cm) {
        return { statusCode: StatusCodes.BadInternalError };
    }

    // This method cannot be called if the file object is open.
    // Check both openCount and write lock flag for safety
    if (trustListIsAlreadyOpened(trustList) || (trustList as any).$$openedForWrite) {
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const thumbprint: string = inputArguments[0].value as string;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;

    try {
        // Normalize thumbprint - remove "NodeOPCUA[" prefix if present
        const normalizedThumbprint = thumbprint.replace(/^NodeOPCUA\[|\]$/g, "").toLowerCase();

        // Determine the folder based on certificate type
        let certFolder: string;
        let crlFolder: string | undefined;

        if (isTrustedCertificate) {
            certFolder = cm.trustedFolder;
            // Get or construct crlFolder path
            crlFolder = cm.crlFolder;
            if (!crlFolder) {
                const rootDir = cm.rootDir;
                if (rootDir) {
                    crlFolder = path.join(rootDir, "crl");
                }
            }
        } else {
            // Issuer certificate
            const rootDir = cm.rootDir;
            if (!rootDir) {
                return { statusCode: StatusCodes.BadInternalError };
            }
            certFolder = path.join(rootDir, "issuers", "certs");
            crlFolder = path.join(rootDir, "issuers", "crl");
        }

        if (!fs.existsSync(certFolder)) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // Find certificate files matching the thumbprint
        const files = await fs.promises.readdir(certFolder);
        let certificateFound = false;
        let certificateToRemove: Buffer | null = null;
        const filesToRemove: string[] = [];

        // Search for matching certificate files
        for (const file of files) {
            const filePath = path.join(certFolder, file);
            const ext = path.extname(file).toLowerCase();

            if (ext === ".pem" || ext === ".der") {
                try {
                    const certBuffer = await readCertificate(filePath);
                    const certThumbprint = makeSHA1Thumbprint(certBuffer).toString("hex").toLowerCase();

                    if (certThumbprint === normalizedThumbprint) {
                        certificateFound = true;
                        certificateToRemove = certBuffer;
                        filesToRemove.push(filePath);
                    }
                } catch (err) {
                    warningLog(`Error processing file ${file}:`, err);
                }
            }
        }

        if (!certificateFound) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // Check if certificate is needed for chain validation (BadCertificateChainIncomplete)
        // This would require checking all trusted certificates to see if any depend on this issuer
        // For now, we'll implement a basic check for issuer certificates
        if (!isTrustedCertificate && certificateToRemove) {
            // Check if any trusted certificate might depend on this issuer
            const trustedFolder = cm.trustedFolder;
            if (fs.existsSync(trustedFolder)) {
                const trustedFiles = await fs.promises.readdir(trustedFolder);
                for (const file of trustedFiles) {
                    const ext = path.extname(file).toLowerCase();
                    if (ext === ".pem" || ext === ".der") {
                        try {
                            const trustedCert = await readCertificate(path.join(trustedFolder, file));
                            const leaf = split_der(trustedCert)[0];
                            const validation = await verifyCertificateChain([leaf, certificateToRemove]);
                            if (validation.status === "Good") {
                                warningLog("Certificate is needed for chain validation");
                                return { statusCode: StatusCodes.BadCertificateChainIncomplete };
                            }
                        } catch (err) {
                            // Ignore errors reading individual certificates
                        }
                    }
                }
            }
        }

        // Delete the certificate files after dependency checks
        for (const filePath of filesToRemove) {
            try {
                await fs.promises.unlink(filePath);
                debugLog(`Removed certificate file: ${path.basename(filePath)}`);
            } catch (err) {
                warningLog(`Error removing file ${filePath}:`, err);
            }
        }

        // If it's an issuer certificate (CA), also remove associated CRLs
        if (!isTrustedCertificate && crlFolder && fs.existsSync(crlFolder)) {
            const crlFiles = await fs.promises.readdir(crlFolder);
            for (const file of crlFiles) {
                const ext = path.extname(file).toLowerCase();
                if (ext === ".crl" || ext === ".der") {
                    const filePath = path.join(crlFolder, file);
                    try {
                        // For simplicity, we remove all CRLs when removing an issuer certificate
                        // A more sophisticated approach would check if the CRL is issued by this CA
                        await fs.promises.unlink(filePath);
                        debugLog(`Removed CRL file: ${file}`);
                    } catch (err) {
                        warningLog(`Error removing CRL file ${file}:`, err);
                    }
                }
            }
        }

        // OPC UA Spec: Update LastUpdateTime after successful modification
        updateLastUpdateTime(trustList);
        
        debugLog("_removeCertificate - done, isTrustedCertificate=", isTrustedCertificate);
        return { statusCode: StatusCodes.Good };
    } catch (err) {
        errorLog("Error in _removeCertificate:", err);
        return { statusCode: StatusCodes.BadInternalError };
    }
}

let counter = 0;

export async function promoteTrustList(trustList: UATrustList) {
    const filename = `/tmpFile${counter}`;
    counter += 1;

    // Store filename for use in _closeAndUpdate
    (trustList as any).$$filename = filename;
    // Initialize write lock flag
    (trustList as any).$$openedForWrite = false;

    installFileType(trustList, { filename, fileSystem: MemFs as AbstractFs });

    // we need to change the default open method
    const open = trustList.getChildByName("Open") as UAMethod;
    const _open_asyncExecutionFunction = (open as any)._asyncExecutionFunction as MethodFunctor;

    // ... and bind the extended methods as well.
    const close = trustList.getChildByName("Close") as UAMethod;
    const closeAndUpdate = trustList.getChildByName("CloseAndUpdate") as UAMethod;
    const openWithMasks = trustList.getChildByName("OpenWithMasks") as UAMethod;
    const addCertificate = trustList.getChildByName("AddCertificate") as UAMethod;
    const removeCertificate = trustList.getChildByName("RemoveCertificate") as UAMethod;
    
    // Store reference to the underlying close method
    const _close_asyncExecutionFunction = (close as any)._asyncExecutionFunction as MethodFunctor;

    function _openTrustList(
        this: any,
        trustMask: TrustListMasks,
        inputArgs: Variant[],
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
        // The Open Method shall not support modes other than Read (0x01) and the Write + EraseExisting (0x06).
        const openMask = inputArgs[0].value as number;
        if (openMask !== OpenFileMode.Read && openMask !== OpenFileMode.WriteEraseExisting) {
            // OPC UA Spec: "If other modes are requested the return code is Bad_NotSupported."
            return callback(null, { statusCode: StatusCodes.BadNotSupported });
        }

        // OPC UA Spec: BadInvalidState - The Open Method was called with write access 
        // and the CloseAndUpdate Method has not been called.
        // If already opened for write, no subsequent opens (read or write) are allowed.
        const isOpenedForWrite = (trustList as any).$$openedForWrite as boolean;
        if (isOpenedForWrite) {
            return callback(null, { statusCode: StatusCodes.BadInvalidState });
        }
        // possible statusCode: Bad_UserAccessDenied	The current user does not have the rights required.
        const certificateManager = ((trustList as any).$$certificateManager as OPCUACertificateManager) || undefined;
        if (certificateManager) {
            writeTrustList(MemFs as AbstractFs, filename, trustMask, certificateManager)
                .then(() => {
                    // Track if opened for write to enforce BadInvalidState on subsequent opens
                    if (openMask === OpenFileMode.WriteEraseExisting) {
                        (trustList as any).$$openedForWrite = true;
                    }

                    _open_asyncExecutionFunction.call(this, inputArgs, context, callback);
                })
                .catch((err) => {
                    errorLog(err);
                    callback(err, { statusCode: StatusCodes.BadInternalError });
                });
        } else {
            warningLog("certificateManager is not defined on trustlist do something to update the document before we open it");
            return _open_asyncExecutionFunction.call(this, inputArgs, context, callback);
        }
    }

    function _openCallback(
        this: any,
        inputArgs: Variant[],
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
        _openTrustList.call(this, TrustListMasks.All, inputArgs, context, callback);
    }

    open.bindMethod(_openCallback);

    function _openWithMaskCallback(
        this: any,
        inputArgs: Variant[],
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
        const trustListMask = inputArgs[0].value as number;
        inputArgs[0] = new Variant({ dataType: DataType.Byte, value: OpenFileMode.Read });
        _openTrustList.call(this, trustListMask, inputArgs, context, callback);
    }
    // The OpenWithMasks Method allows a Client to read only the portion of the Trust List.
    // This Method can only be used to read the Trust List.
    openWithMasks.bindMethod(_openWithMaskCallback);
    addCertificate.bindMethod(_addCertificate);
    removeCertificate.bindMethod(_removeCertificate);
    
    // Wrapper to pass the underlying close method to _closeAndUpdate
    closeAndUpdate?.bindMethod(async function(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        return _closeAndUpdate.call(this, inputArguments, context, _close_asyncExecutionFunction);
    });

    function install_method_handle_on_TrustListType(addressSpace: IAddressSpace): void {
        const fileType = addressSpace.findObjectType("TrustListType") as any;
        if (!fileType || fileType.addCertificate.isBound()) {
            return;
        }
        fileType.open && fileType.open.bindMethod(_openCallback);
        fileType.addCertificate.bindMethod(_addCertificate);
        fileType.removeCertificate.bindMethod(_removeCertificate);
        fileType.openWithMasks && fileType.openWithMasks.bindMethod(_openWithMaskCallback);
        fileType.closeAndUpdate && fileType.closeAndUpdate.bindMethod(_closeAndUpdate);
    }
    install_method_handle_on_TrustListType(trustList.addressSpace);
}

export function installAccessRestrictionOnTrustList(trustList: UAVariable | UAObject) {
    for (const m of trustList.getComponents()) {
        m?.setRolePermissions(rolePermissionAdminOnly);
        m?.setAccessRestrictions(AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired);
    }
}
