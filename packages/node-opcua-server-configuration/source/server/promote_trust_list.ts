/**
 * @module node-opcua-server-configuration
 */

import fs from "node:fs";
import path from "node:path";

import { fs as MemFs } from "memfs";

import type {
    IAddressSpace,
    ISessionContext,
    MethodFunctor,
    UAMethod,
    UAObject,
    UAObjectType,
    UATrustList,
    UATrustList_Base,
    UAVariable
} from "node-opcua-address-space";
import { BinaryStream } from "node-opcua-binary-stream";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { split_der, verifyCertificateChain } from "node-opcua-crypto/web";
import { AccessRestrictionsFlag } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { type AbstractFs, installFileType, OpenFileMode } from "node-opcua-file-transfer";
import { VerificationStatus } from "node-opcua-pki";
import { type CallbackT, type StatusCode, StatusCodes } from "node-opcua-status-code";
import { type CallMethodResultOptions, TrustListDataType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import type { PushCertificateManagerServerImpl } from "./push_certificate_manager_server_impl.js";
import { rolePermissionAdminOnly } from "./roles_and_permissions.js";
import { hasEncryptedChannel, hasExpectedUserAccess } from "./tools.js";
import { TrustListMasks, writeTrustList } from "./trust_list_server.js";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");

/**
 * Navigate from a TrustList node up to the push certificate manager
 * and emit a `"trustListUpdated"` event with the certificate-group
 * browse-name.
 */
function emitTrustListUpdated(trustList: UATrustList): void {
    try {
        const certificateGroup = trustList.parent;
        const groupName = certificateGroup?.browseName?.name ?? "Unknown";

        const serverConfiguration = trustList.addressSpace.rootFolder.objects.server.getChildByName("ServerConfiguration");
        if (!serverConfiguration) return;

        const pushManager = (
            serverConfiguration as unknown as {
                $pushCertificateManager?: PushCertificateManagerServerImpl;
            }
        ).$pushCertificateManager;

        if (pushManager) {
            pushManager.emit("trustListUpdated", groupName);
        }
    } catch (err) {
        errorLog("emitTrustListUpdated error:", (err as Error).message);
    }
}

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
            doDebug && debugLog("Updated LastUpdateTime to", new Date().toISOString());
        } else {
            warningLog("LastUpdateTime property not found on TrustList");
        }
    } catch (err) {
        errorLog("Error updating LastUpdateTime:", err);
    }
}

/**
 * Scan the PKI store folders (trusted/certs, trusted/crl, issuers/certs,
 * issuers/crl) and return the most recent modification time across all
 * files. Returns null if no files are found.
 *
 * Uses async fs.promises to avoid blocking the event loop on startup
 * when PKI directories are large or on slow filesystems.
 */
async function getNewestMtimeFromPkiStore(
    cm: OPCUACertificateManager,
    isAborted?: () => boolean
): Promise<Date | null> {
    const dirs = [cm.trustedFolder, cm.crlFolder, cm.issuersCertFolder, cm.issuersCrlFolder];
    let newest: Date | null = null;
    
    for (const dir of dirs) {
        if (isAborted?.()) break;

        try {
            await fs.promises.access(dir);
        } catch {
            continue;
        }
        let entries: string[];
        try {
            entries = await fs.promises.readdir(dir);
        } catch {
            continue;
        }
        
        // Process stats in parallel arrays to avoid sequential bottleneck
        const statPromises = entries.map(async (entry) => {
            if (isAborted?.()) return null;
            try {
                const stat = await fs.promises.stat(path.join(dir, entry));
                if (stat.isFile()) {
                    return stat.mtime;
                }
            } catch {
                // skip unreadable entries
            }
            return null;
        });
        
        const mtimes = await Promise.all(statPromises);
        for (const mtime of mtimes) {
            if (mtime && (!newest || mtime > newest)) {
                newest = mtime;
            }
        }
    }
    return newest;
}

/**
 * Initialize the LastUpdateTime property from the PKI store's
 * filesystem timestamps. This avoids displaying MinDate
 * (0001-01-01T00:00:00Z) when the trust store already contains
 * certificates or CRLs (e.g. populated by selfOnboard or addIssuer).
 *
 * Also subscribes to the CertificateManager's filesystem watcher
 * events (certificateAdded, certificateRemoved, certificateChange,
 * crlAdded, crlRemoved) so that LastUpdateTime stays current even
 * when the trust store is modified externally (e.g. manual file
 * copy, programmatic addIssuer/trustCertificate calls).
 *
 * Listeners are installed at most once per TrustList node
 * (guarded by $$listenersInstalled) and are removed via
 * addressSpace.registerShutdownTask to prevent leaks.
 */
async function _initializeLastUpdateTimeFromFilesystem(trustList: UATrustListEx): Promise<void> {
    const cm = trustList.$$certificateManager;
    if (!cm) return;

    if (trustList.$$initaliseMTimePromise) {
        return await trustList.$$initaliseMTimePromise;
    }

    trustList.$$initaliseMTimePromise = (async () => {
        const startTime = Date.now();
        let isAborted = false;
        
        const abortHandler = () => { isAborted = true; };
        trustList.addressSpace.registerShutdownTask(abortHandler);

        try {
            const lastUpdateTimeNode = trustList.lastUpdateTime;
            if (!lastUpdateTimeNode) return;

            // Seed the initial timestamp from the filesystem only when
            // the current value is still unset (MinDate).  The event
            // listeners below must always be installed regardless, so we
            // must NOT return early here.
            const currentValue = lastUpdateTimeNode.readValue().value.value as Date | undefined;
            if (!currentValue || currentValue.getTime() <= 0) {
                const newest = await getNewestMtimeFromPkiStore(cm, () => isAborted);
                if (isAborted) {
                    console.log(`[node-opcua] _initializeLastUpdateTimeFromFilesystem aborted for ${trustList.browseName.toString()}`);
                    return;
                }
                if (newest) {
                    lastUpdateTimeNode.setValueFromSource({
                        dataType: DataType.DateTime,
                        value: newest
                    });
                    doDebug && debugLog("Initialized LastUpdateTime from filesystem:", newest.toISOString());
                }
            }

            // Guard: install listeners at most once per TrustList node
            // to prevent duplicate handler invocation on re-promotion.
            if (trustList.$$listenersInstalled) {
                return;
            }
            trustList.$$listenersInstalled = true;

            // Subscribe to CertificateManager filesystem watcher events
            // so LastUpdateTime stays current when the store is modified
            // outside of OPC UA methods (e.g. addIssuer, trustCertificate,
            // or manual file operations).
            const _updateNow = () => {
                updateLastUpdateTime(trustList);
            };

            const events = ["certificateAdded", "certificateRemoved", "certificateChange", "crlAdded", "crlRemoved"] as const;
            for (const event of events) {
                cm.on(event, _updateNow);
            }

            // Clean up listeners when the address space shuts down
            // to avoid MaxListenersExceededWarning and memory leaks.
            trustList.addressSpace.registerShutdownTask(() => {
                for (const event of events) {
                    cm.removeListener(event, _updateNow);
                }
                trustList.$$listenersInstalled = false;
            });

            console.log(`[node-opcua] _initializeLastUpdateTimeFromFilesystem took ${Date.now() - startTime}ms for ${trustList.browseName.toString()}`);
        } finally {
            trustList.$$initaliseMTimePromise = undefined;
        }
    })();
    return await trustList.$$initaliseMTimePromise;
}

interface UAMethodEx extends UAMethod {
    _asyncExecutionFunction?: MethodFunctor;
}
interface UATrustListEx extends UATrustList {
    $$certificateManager: OPCUACertificateManager;
    $$filename: string;
    $$openedForWrite: boolean;
    $$listenersInstalled: boolean;
    $$initaliseMTimePromise?: Promise<void>;
}

async function applyTrustListChanges(cm: OPCUACertificateManager, trustListData: TrustListDataType): Promise<StatusCode> {
    try {
        // Automatically update specifiedLists mask
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

        // Process CRLs
        if ((trustListData.specifiedLists & TrustListMasks.IssuerCrls) === TrustListMasks.IssuerCrls) {
            doDebug && debugLog("Processing issuer CRLs");
            await cm.clearRevocationLists("issuers");
            if (trustListData.issuerCrls && trustListData.issuerCrls.length > 0) {
                doDebug && debugLog(` Writing ${trustListData.issuerCrls.length} issuer CRLs`);
                for (const crl of trustListData.issuerCrls) {
                    await cm.addRevocationList(crl, "issuers");
                }
            }
        }

        if ((trustListData.specifiedLists & TrustListMasks.TrustedCrls) === TrustListMasks.TrustedCrls) {
            doDebug && debugLog("Processing trusted CRLs");
            await cm.clearRevocationLists("trusted");
            if (trustListData.trustedCrls && trustListData.trustedCrls.length > 0) {
                doDebug && debugLog(` Writing ${trustListData.trustedCrls.length} trusted CRLs`);
                for (const crl of trustListData.trustedCrls) {
                    await cm.addRevocationList(crl, "trusted");
                }
            }
        }

        // Validate all trusted certificates
        if (
            (trustListData.specifiedLists & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates &&
            trustListData.trustedCertificates
        ) {
            for (const cert of trustListData.trustedCertificates) {
                try {
                    const certs = split_der(cert);
                    const validationResult = await verifyCertificateChain([certs[0]]);
                    if (validationResult.status !== "Good") {
                        warningLog("Invalid certificate in trust list:", validationResult.status, validationResult.reason);
                        return StatusCodes.BadCertificateInvalid;
                    }
                } catch (validationErr) {
                    errorLog("Certificate validation failed:", validationErr);
                    return StatusCodes.BadCertificateInvalid;
                }
            }
        }

        // Validate all issuer certificates
        if (
            (trustListData.specifiedLists & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates &&
            trustListData.issuerCertificates
        ) {
            for (const cert of trustListData.issuerCertificates) {
                try {
                    const certs = split_der(cert);
                    const validationResult = await verifyCertificateChain([certs[0]]);
                    if (validationResult.status !== "Good") {
                        warningLog("Invalid issuer certificate in trust list:", validationResult.status, validationResult.reason);
                        return StatusCodes.BadCertificateInvalid;
                    }
                } catch (validationErr) {
                    errorLog("Issuer certificate validation failed:", validationErr);
                    return StatusCodes.BadCertificateInvalid;
                }
            }
        }

        // Update certificates
        if (
            (trustListData.specifiedLists & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates &&
            trustListData.trustedCertificates
        ) {
            for (const cert of trustListData.trustedCertificates) {
                await cm.trustCertificate(cert);
            }
        }
        if (
            (trustListData.specifiedLists & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates &&
            trustListData.issuerCertificates
        ) {
            for (const cert of trustListData.issuerCertificates) {
                await cm.addIssuer(cert);
            }
        }

        return StatusCodes.Good;
    } catch (err) {
        errorLog("Error in applyTrustListChanges:", err);
        return StatusCodes.BadInternalError;
    }
}

async function _closeAndUpdate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext,
    _close_method?: MethodFunctor
): Promise<CallMethodResultOptions> {
    const trustList = context.object as UATrustListEx;
    const cm = trustList.$$certificateManager;
    const filename = trustList.$$filename;

    // Clear the write lock when closing
    trustList.$$openedForWrite = false;

    // Get the close method if not provided
    if (!_close_method) {
        const closeMethod = trustList.getChildByName("Close") as UAMethodEx;
        if (closeMethod) {
            _close_method = closeMethod._asyncExecutionFunction;
        }
    }

    if (!cm || !filename) {
        return { statusCode: StatusCodes.BadInternalError };
    }

    let processStatusCode: StatusCode = StatusCodes.Good;

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

            processStatusCode = await applyTrustListChanges(cm, trustListData);

            if (processStatusCode === StatusCodes.Good) {
                // OPC UA Spec: Update LastUpdateTime after successful trust list update
                updateLastUpdateTime(trustList);
                emitTrustListUpdated(trustList);
            }
        }
    } catch (err) {
        errorLog("Error in _closeAndUpdate:", err);
        processStatusCode = StatusCodes.BadInternalError;
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
                        statusCode:
                            processStatusCode === StatusCodes.Good ? result?.statusCode || StatusCodes.Good : processStatusCode,
                        outputArguments: [new Variant({ dataType: DataType.Boolean, value: false })]
                    });
                }
            });
        });
    }

    return {
        statusCode: processStatusCode,
        outputArguments: [new Variant({ dataType: DataType.Boolean, value: false })]
    };
}

/**
 * Map a `VerificationStatus` returned by the PKI layer to the
 * corresponding OPC UA `StatusCode`.
 */
function verificationStatusToStatusCode(status: VerificationStatus): StatusCode {
    switch (status) {
        case VerificationStatus.BadCertificateChainIncomplete:
            return StatusCodes.BadCertificateChainIncomplete;
        case VerificationStatus.BadCertificateRevoked:
            return StatusCodes.BadCertificateRevoked;
        case VerificationStatus.BadCertificateIssuerRevoked:
            return StatusCodes.BadCertificateIssuerRevoked;
        case VerificationStatus.BadCertificateRevocationUnknown:
            return StatusCodes.BadCertificateRevocationUnknown;
        case VerificationStatus.BadCertificateIssuerRevocationUnknown:
            return StatusCodes.BadCertificateIssuerRevocationUnknown;
        case VerificationStatus.BadCertificateTimeInvalid:
            return StatusCodes.BadCertificateTimeInvalid;
        case VerificationStatus.BadCertificateIssuerTimeInvalid:
            return StatusCodes.BadCertificateIssuerTimeInvalid;
        case VerificationStatus.BadCertificateUntrusted:
            return StatusCodes.BadCertificateUntrusted;
        case VerificationStatus.BadSecurityChecksFailed:
            return StatusCodes.BadSecurityChecksFailed;
        case VerificationStatus.BadCertificateInvalid:
        default:
            return StatusCodes.BadCertificateInvalid;
    }
}

// in TrustList
async function _addCertificate(
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

    const trustList = context.object as UATrustListEx;
    const cm = trustList.$$certificateManager;

    if (!cm) {
        return { statusCode: StatusCodes.BadInternalError };
    }
    if (trustListIsAlreadyOpened(trustList) || trustList.$$openedForWrite) {
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const certificateBuffer: Buffer = inputArguments[0].value as Buffer;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;

    // OPC UA Spec: "If FALSE Bad_CertificateInvalid is returned."
    if (!isTrustedCertificate) {
        return { statusCode: StatusCodes.BadCertificateInvalid };
    }

    try {
        const certificates = split_der(certificateBuffer);
        if (certificates.length > 1) {
            warningLog("AddCertificate received a certificate chain. Only the leaf certificate will be added.");
            warningLog("Issuer certificates must be added using the Write/CloseAndUpdate methods.");
        }

        const status = await cm.addTrustedCertificateFromChain(certificateBuffer);

        if (status !== VerificationStatus.Good) {
            warningLog("Certificate validation failed:", status);
            return { statusCode: verificationStatusToStatusCode(status) };
        }

        updateLastUpdateTime(trustList);
        emitTrustListUpdated(trustList);

        doDebug && debugLog("_addCertificate - done,  leaf certificate has been added to trustedCertificates");
        return { statusCode: StatusCodes.Good };
    } catch (err) {
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

    const trustList = context.object as UATrustListEx;
    const cm = trustList.$$certificateManager;

    if (!cm) {
        return { statusCode: StatusCodes.BadInternalError };
    }

    if (trustListIsAlreadyOpened(trustList) || trustList.$$openedForWrite) {
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const thumbprint: string = inputArguments[0].value as string;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;

    try {
        // Normalize thumbprint - remove "NodeOPCUA[" prefix if present
        const normalizedThumbprint = thumbprint.replace(/^NodeOPCUA\[|\]$/g, "").toLowerCase();

        if (isTrustedCertificate) {
            // Remove from trusted store
            const removed = await cm.removeTrustedCertificate(normalizedThumbprint);
            if (!removed) {
                return { statusCode: StatusCodes.BadInvalidArgument };
            }
        } else {
            // Removing an issuer certificate — first check if it's still
            // needed by any trusted certificate
            const issuerCert = await cm.removeIssuer(normalizedThumbprint);
            if (!issuerCert) {
                return { statusCode: StatusCodes.BadInvalidArgument };
            }

            // Check dependency: is any trusted cert signed by this issuer?
            if (await cm.isIssuerInUseByTrustedCertificate(issuerCert)) {
                // Re-add the issuer since we can't remove it
                await cm.addIssuer(issuerCert);
                warningLog("Certificate is needed for chain validation");
                return { statusCode: StatusCodes.BadCertificateChainIncomplete };
            }

            // Also remove CRLs issued by this CA
            await cm.removeRevocationListsForIssuer(issuerCert, "issuers");
        }

        updateLastUpdateTime(trustList);
        emitTrustListUpdated(trustList);

        doDebug && debugLog("_removeCertificate - done, isTrustedCertificate=", isTrustedCertificate);
        return { statusCode: StatusCodes.Good };
    } catch (err) {
        errorLog("Error in _removeCertificate:", err);
        return { statusCode: StatusCodes.BadInternalError };
    }
}

let counter = 0;

export async function promoteTrustList(trustList: UATrustList) {
    const trustListEx = trustList as UATrustListEx & { $$promoted?: boolean };
    
    // Prevent double-binding if called multiple times testing
    if (trustListEx.$$promoted) {
        await _initializeLastUpdateTimeFromFilesystem(trustListEx);
        return;
    }
    trustListEx.$$promoted = true;

    const filename = `/tmpFile${counter}`;
    counter += 1;

    // Store filename for use in _closeAndUpdate
    trustListEx.$$filename = filename;
    // Initialize write lock flag
    trustListEx.$$openedForWrite = false;

    installFileType(trustList, { filename, fileSystem: MemFs as AbstractFs });

    // we need to change the default open method
    const open = trustList.getChildByName("Open") as UAMethodEx;
    const _open_asyncExecutionFunction = open._asyncExecutionFunction as MethodFunctor;

    // ... and bind the extended methods as well.
    const close = trustList.getChildByName("Close") as UAMethodEx;
    const _close_asyncExecutionFunction = close._asyncExecutionFunction as MethodFunctor;

    const closeAndUpdate = trustList.getChildByName("CloseAndUpdate") as UAMethodEx;
    const openWithMasks = trustList.getChildByName("OpenWithMasks") as UAMethodEx;
    const addCertificate = trustList.getChildByName("AddCertificate") as UAMethodEx;
    const removeCertificate = trustList.getChildByName("RemoveCertificate") as UAMethodEx;

    function _openTrustList(
        this: UAMethod,
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
        const isOpenedForWrite = trustListEx.$$openedForWrite;
        if (isOpenedForWrite) {
            return callback(null, { statusCode: StatusCodes.BadInvalidState });
        }
        // possible statusCode: Bad_UserAccessDenied	The current user does not have the rights required.
        const certificateManager = trustListEx.$$certificateManager;
        if (certificateManager) {
            writeTrustList(MemFs as AbstractFs, filename, trustMask, certificateManager)
                .then(() => {
                    // Track if opened for write to enforce BadInvalidState on subsequent opens
                    if (openMask === OpenFileMode.WriteEraseExisting) {
                        trustListEx.$$openedForWrite = true;
                    }

                    _open_asyncExecutionFunction.call(this, inputArgs, context, callback);
                })
                .catch((err) => {
                    errorLog((err as Error).message);
                    callback(err, { statusCode: StatusCodes.BadInternalError });
                });
        } else {
            warningLog(
                "certificateManager is not defined on trustlist do something to update the trust list document before we open it"
            );
            return _open_asyncExecutionFunction.call(this, inputArgs, context, callback);
        }
    }

    function _openCallback(
        this: UAMethod,
        inputArgs: Variant[],
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
        _openTrustList.call(this, TrustListMasks.All, inputArgs, context, callback);
    }

    open.bindMethod(_openCallback);

    function _openWithMaskCallback(
        this: UAMethod,
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

    function _closeCallback(
        this: UAMethod,
        inputArgs: Variant[],
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
        trustListEx.$$openedForWrite = false;
        _close_asyncExecutionFunction.call(this, inputArgs, context, callback);
    }
    close.bindMethod(_closeCallback);

    // Wrapper to pass the underlying close method to _closeAndUpdate
    closeAndUpdate?.bindMethod(async function (
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        return _closeAndUpdate.call(this, inputArguments, context, _close_asyncExecutionFunction);
    });

    function install_method_handle_on_TrustListType(addressSpace: IAddressSpace): void {
        const fileType = addressSpace.findObjectType("TrustListType") as (UAObjectType & UATrustList_Base) | null;
        if (!fileType || fileType.addCertificate.isBound()) {
            return;
        }
        fileType.open?.bindMethod(_openCallback);
        fileType.close?.bindMethod(_closeCallback);
        fileType.addCertificate.bindMethod(_addCertificate);
        fileType.removeCertificate.bindMethod(_removeCertificate);
        fileType.openWithMasks?.bindMethod(_openWithMaskCallback);
        fileType.closeAndUpdate?.bindMethod(_closeAndUpdate);
    }
    install_method_handle_on_TrustListType(trustList.addressSpace);

    // Initialize LastUpdateTime from the PKI store's filesystem timestamps
    // so it doesn't show MinDate (0001-01-01) when files already exist.
    await _initializeLastUpdateTimeFromFilesystem(trustListEx);
}

export function installAccessRestrictionOnTrustList(trustList: UAVariable | UAObject) {
    for (const m of trustList.getComponents()) {
        m?.setRolePermissions(rolePermissionAdminOnly);
        m?.setAccessRestrictions(AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired);
    }
}
