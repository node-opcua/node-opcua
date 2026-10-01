/**
 * @module node-opcua-server-configuration
 */

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { fs as MemFs } from "memfs";

import type {
    IAddressSpace,
    ISessionContext,
    MethodFunctorC,
    UAMethod,
    UAObject,
    UAObjectType,
    UATrustList,
    UATrustList_Base,
    UAVariable
} from "node-opcua-address-space";
import { BinaryStream } from "node-opcua-binary-stream";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    exploreCertificate,
    makeSHA1Thumbprint,
    split_der,
    verifyCertificateChain,
    verifyCertificateSignature
} from "node-opcua-crypto/web";
import { AccessRestrictionsFlag } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { type AbstractFs, installFileType, OpenFileMode } from "node-opcua-file-transfer";
import { VerificationStatus } from "node-opcua-pki";
import { type CallbackT, type StatusCode, StatusCodes } from "node-opcua-status-code";
import { type CallMethodResultOptions, TrustListDataType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { confirmTrust, isSharedTrustListStore, leafCertificatesIn, leafThumbprintsIn } from "./application_setup.js";
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
    if (!dataValue?.value) {
        return false;
    }
    const openCount = dataValue.value.value as number;
    return openCount > 0;
}

/**
 * AddCertificate and RemoveCertificate "cannot be called if the containing
 * TrustList Object is open" (OPC 10000-12 §7.8.2.6, §7.8.2.7). Their result
 * tables tell the two cases apart: open with write access is Bad_InvalidState,
 * open for read only is Bad_NotWritable.
 */
function statusWhenOpen(trustList: UATrustListEx): StatusCode | undefined {
    if (trustList.$$openedForWrite) {
        return StatusCodes.BadInvalidState;
    }
    if (trustListIsAlreadyOpened(trustList)) {
        return StatusCodes.BadNotWritable;
    }
    return undefined;
}

type TrustListStore = "trusted" | "issuers";

/**
 * Whether removing `thumbprint` from `store` would leave another Certificate
 * of the TrustList without an issuer able to validate it (§7.8.2.7:
 * Bad_CertificateChainIncomplete). Both lists count, so an intermediate CA in
 * the Issuer list keeps its root. A copy of the same CA kept in the other
 * list, or another CA with the same key, still validates the child.
 */
async function isNeededToValidateAnother(
    cm: OPCUACertificateManager,
    store: TrustListStore,
    thumbprint: string,
    certificate: Buffer
): Promise<boolean> {
    const entries = [
        ...(await leafCertificatesIn(cm.trustedFolder)).map((e) => ({ ...e, store: "trusted" })),
        ...(await leafCertificatesIn(cm.issuersCertFolder)).map((e) => ({ ...e, store: "issuers" }))
    ];
    const remaining = entries.filter((e) => !(e.store === store && e.thumbprint === thumbprint));
    const signedBy = (child: Buffer, issuer: Buffer) => {
        try {
            return verifyCertificateSignature(child, issuer);
        } catch {
            return false;
        }
    };
    return remaining.some(
        (child) =>
            child.thumbprint !== thumbprint &&
            signedBy(child.certificate, certificate) &&
            !remaining.some((other) => other.thumbprint !== child.thumbprint && signedBy(child.certificate, other.certificate))
    );
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
async function getNewestMtimeFromPkiStore(cm: OPCUACertificateManager, isAborted?: () => boolean): Promise<Date | null> {
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

        // Process stats sequentially to avoid threadpool exhaustion
        // and event-loop lag when directories have thousands of files.
        for (const entry of entries) {
            if (isAborted?.()) return null;
            try {
                const stat = await fs.promises.stat(path.join(dir, entry));
                if (stat.isFile() && (!newest || stat.mtime > newest)) {
                    newest = stat.mtime;
                }
            } catch {
                // skip unreadable entries
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
        const isAborted = false;

        // Note: Removed abortHandler from registerShutdownTask because AddressSpace
        // does not have an unregister mechanism, which causes `_shutdownTasks` to leak
        // continuously if promoteTrustList is called multiple times.
        // Sequential scanning is fast enough that it won't block shutdown significantly.

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
                    console.log(
                        `[node-opcua] _initializeLastUpdateTimeFromFilesystem aborted for ${trustList.browseName.toString()}`
                    );
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
            // Guard: addressSpace may be null if dispose() was called
            // concurrently (e.g. fast test teardown).
            if (trustList.addressSpace) {
                trustList.addressSpace.registerShutdownTask(() => {
                    for (const event of events) {
                        cm.removeListener(event, _updateNow);
                    }
                    trustList.$$listenersInstalled = false;
                });
            }

            console.log(
                `[node-opcua] _initializeLastUpdateTimeFromFilesystem took ${Date.now() - startTime}ms for ${trustList.browseName.toString()}`
            );
        } finally {
            trustList.$$initaliseMTimePromise = undefined;
        }
    })();
    return await trustList.$$initaliseMTimePromise;
}

interface UAMethodEx extends UAMethod {
    _asyncExecutionFunction?: MethodFunctorC;
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

        // Validate all trusted certificates
        if (
            (trustListData.specifiedLists & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates &&
            trustListData.trustedCertificates
        ) {
            for (const cert of trustListData.trustedCertificates) {
                try {
                    const certs = split_der(cert);
                    // verifyCertificateChain checks nothing on a one-element chain;
                    // parsing is what rejects bytes that are not a certificate.
                    exploreCertificate(certs[0]);
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
                    // verifyCertificateChain checks nothing on a one-element chain;
                    // parsing is what rejects bytes that are not a certificate.
                    exploreCertificate(certs[0]);
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

        // Nothing below runs unless every uploaded certificate is valid, so an
        // invalid upload leaves the TrustList (CRLs included) as it was.
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

        // Update certificates. A list whose bit is set is replaced by the one
        // uploaded, not added to (§7.8.2.5: the Server "creates a new TrustList
        // that includes the existing TrustList plus any updates"; §7.8.2.9: a
        // list whose bit is not set is not changed). The uploaded certificates
        // are added before the others are removed: should an add fail, the
        // list is left larger than asked, never emptier, so nobody who was
        // trusted is locked out by a half-applied write.
        if ((trustListData.specifiedLists & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates) {
            const uploaded = trustListData.trustedCertificates ?? [];
            for (const cert of uploaded) {
                await cm.trustCertificate(cert);
            }
            await confirmTrust(cm, "trusted", uploaded.map(leafThumbprint));
            await removeCertificatesNotIn(cm, cm.trustedFolder, uploaded, (thumbprint) => cm.removeTrustedCertificate(thumbprint));
        }
        if ((trustListData.specifiedLists & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates) {
            const uploaded = trustListData.issuerCertificates ?? [];
            for (const cert of uploaded) {
                await cm.addIssuer(cert);
            }
            await confirmTrust(cm, "issuers", uploaded.map(leafThumbprint));
            await removeCertificatesNotIn(cm, cm.issuersCertFolder, uploaded, (thumbprint) => cm.removeIssuer(thumbprint));
        }

        return StatusCodes.Good;
    } catch (err) {
        errorLog("Error in applyTrustListChanges:", err);
        return StatusCodes.BadInternalError;
    }
}

function leafThumbprint(certificateOrChain: Buffer): string {
    return makeSHA1Thumbprint(split_der(certificateOrChain)[0]).toString("hex");
}

/**
 * Remove from `folder` every certificate that is not in `uploaded`.
 *
 * Skipped, with a warning, when the store backs another CertificateGroup as
 * well: the certificates of both groups sit in the same folder, and removing
 * what this group's upload leaves out would remove the other group's too.
 * Such a store keeps the previous behaviour, adding only.
 */
async function removeCertificatesNotIn(
    cm: OPCUACertificateManager,
    folder: string,
    uploaded: Buffer[],
    remove: (thumbprint: string) => Promise<unknown>
): Promise<void> {
    if (isSharedTrustListStore(cm)) {
        warningLog(
            `[TrustList] ${cm.rootDir} backs more than one CertificateGroup: the uploaded list is added to it, not replacing it (OPC 10000-12 §7.8.2.5). Give each group its own CertificateManager.`
        );
        return;
    }
    const kept = new Set(uploaded.map(leafThumbprint));
    for (const thumbprint of await leafThumbprintsIn(folder)) {
        if (!kept.has(thumbprint)) {
            await remove(thumbprint);
        }
    }
}

async function _closeAndUpdate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext,
    _close_method?: MethodFunctorC
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
    const openStatus = statusWhenOpen(trustList);
    if (openStatus) {
        return { statusCode: openStatus };
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

        await confirmTrust(cm, "trusted", [leafThumbprint(certificateBuffer)]);
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

    const openStatus = statusWhenOpen(trustList);
    if (openStatus) {
        return { statusCode: openStatus };
    }

    const thumbprint: string = inputArguments[0].value as string;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;

    try {
        // Normalize thumbprint - remove "NodeOPCUA[" prefix if present
        const normalizedThumbprint = thumbprint.replace(/^NodeOPCUA\[|\]$/g, "").toLowerCase();

        // §7.8.2.7, the same rules for both lists: Bad_InvalidArgument when
        // the thumbprint is not in the list, Bad_CertificateChainIncomplete
        // when another Certificate still needs it, checked before anything is
        // removed, and a CA's CRLs leave with it.
        const store: TrustListStore = isTrustedCertificate ? "trusted" : "issuers";
        const folder = isTrustedCertificate ? cm.trustedFolder : cm.issuersCertFolder;
        const certificate = (await leafCertificatesIn(folder)).find((e) => e.thumbprint === normalizedThumbprint)?.certificate;
        if (!certificate) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        if (await isNeededToValidateAnother(cm, store, normalizedThumbprint, certificate)) {
            warningLog("Certificate is needed for chain validation");
            return { statusCode: StatusCodes.BadCertificateChainIncomplete };
        }
        const removed = isTrustedCertificate
            ? await cm.removeTrustedCertificate(normalizedThumbprint)
            : await cm.removeIssuer(normalizedThumbprint);
        if (!removed) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        await cm.removeRevocationListsForIssuer(certificate, store);
        await confirmTrust(cm, store, [normalizedThumbprint]);

        updateLastUpdateTime(trustList);
        emitTrustListUpdated(trustList);

        doDebug && debugLog("_removeCertificate - done, isTrustedCertificate=", isTrustedCertificate);
        return { statusCode: StatusCodes.Good };
    } catch (err) {
        errorLog("Error in _removeCertificate:", err);
        return { statusCode: StatusCodes.BadInternalError };
    }
}

/**
 * Backing path on the in-memory volume for a TrustList's FileType.
 *
 * Replaces a module-scoped `counter`. `memfs` exports one process-wide
 * volume, but the counter is only unique within one *instance* of this
 * module, and a process can easily load several (duplicated transitive
 * dependency, a monorepo resolving two versions). Two TrustLists in
 * different copies then both take `/tmpFile0` on the same volume and
 * silently serve each other's bytes.
 *
 * A NodeId alone does not fix it either: two OPCUAServers in one
 * process have separate address spaces in which the same TrustList
 * NodeId occurs, so they would collide too. The path therefore combines
 * a per-address-space id with the NodeId. The id is stored on the
 * address space object itself, not in a module-scoped map, so every
 * copy of this module sees the same value.
 */
function trustListBackingPath(trustList: UATrustList): string {
    const addressSpace = trustList.addressSpace as IAddressSpace & { $$trustListVolumeId?: string };
    if (!addressSpace.$$trustListVolumeId) {
        addressSpace.$$trustListVolumeId = randomBytes(6).toString("hex");
    }
    const node = trustList.nodeId.toString().replace(/[^A-Za-z0-9]/g, "_");
    return `/trustlist_${addressSpace.$$trustListVolumeId}_${node}`;
}

export async function promoteTrustList(trustList: UATrustList) {
    const trustListEx = trustList as UATrustListEx & { $$promoted?: boolean };

    // Prevent double-binding if called multiple times testing
    if (trustListEx.$$promoted) {
        await _initializeLastUpdateTimeFromFilesystem(trustListEx);
        return;
    }
    trustListEx.$$promoted = true;

    const filename = trustListBackingPath(trustList);

    // The file is normally written by _openTrustList, just before the
    // FileType Open runs. But Size is readable without Open, and Open
    // itself falls through to the raw implementation when the group has
    // no certificateManager, so the path has to exist from promotion
    // time. Without this, both read ENOENT: Size logs and yields no
    // value, and Open answers Bad_UnexpectedError instead of presenting
    // an empty TrustList, which is the correct answer for a group that
    // has nothing to serve.
    if (!MemFs.existsSync(filename)) {
        MemFs.writeFileSync(filename, Buffer.alloc(0));
    }

    // `memfs` exports one volume for the whole process and nothing here ever
    // released these paths. Each Open rewrites the full serialized TrustList
    // (every trusted cert, issuer cert and CRL) and it then stays resident
    // for the lifetime of the process. That was masked while the filename
    // came from a module counter, because a second address space reused
    // `/tmpFile0` and overwrote the first one's bytes; now that the paths are
    // distinct, a process that builds and tears down servers repeatedly (test
    // suites, an in-process restart) would accumulate one blob per TrustList
    // per server. Release them with the address space.
    //
    // Registering once per TrustList is bounded: the $$promoted guard above
    // means this runs once per node, and registerShutdownTask has no
    // unregister counterpart.
    trustList.addressSpace.registerShutdownTask(() => {
        try {
            if (MemFs.existsSync(filename)) {
                MemFs.unlinkSync(filename);
            }
        } catch (err) {
            // c8 ignore next
            doDebug && debugLog("could not release trust list backing file", filename, (err as Error).message);
        }
    });

    // Store filename for use in _closeAndUpdate
    trustListEx.$$filename = filename;
    // Initialize write lock flag
    trustListEx.$$openedForWrite = false;

    installFileType(trustList, { filename, fileSystem: MemFs as unknown as AbstractFs });

    // we need to change the default open method
    const open = trustList.getChildByName("Open") as UAMethodEx;
    const _open_asyncExecutionFunction = open._asyncExecutionFunction as MethodFunctorC;

    // ... and bind the extended methods as well.
    const close = trustList.getChildByName("Close") as UAMethodEx;
    const _close_asyncExecutionFunction = close._asyncExecutionFunction as MethodFunctorC;

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
            writeTrustList(MemFs as unknown as AbstractFs, filename, trustMask, certificateManager)
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
