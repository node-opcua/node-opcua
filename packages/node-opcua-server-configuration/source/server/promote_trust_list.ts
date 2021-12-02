/**
 * @module node-opcua-server-configuration
 */

import { callbackify } from "util";
import { fs as MemFs } from "memfs";

import {
    AddressSpace,
    MethodFunctor,
    SessionContext,
    UAMethod,
    UATrustList,
    UAObject,
    UAVariable,
    ISessionContext,
    IAddressSpace
} from "node-opcua-address-space";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { CallbackT, StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { AccessRestrictionsFlag } from "node-opcua-data-model";
import { CertificateManager } from "node-opcua-pki";
import { AbstractFs, installFileType, OpenFileMode } from "node-opcua-file-transfer";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { split_der, verifyCertificateChain } from "node-opcua-crypto";

import { TrustListMasks, writeTrustList } from "./trust_list_server";

import { hasEncryptedChannel, hasExpectedUserAccess } from "./tools";
import { rolePermissionAdminOnly } from "./roles_and_permissions";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");
const errorLog = debugLog;

function trustListIsAlreadyOpened(trustList: UATrustList): boolean {
    return false; // to do...
}

async function _closeAndUpdate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    return { statusCode: StatusCodes.Good };
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
    if (trustListIsAlreadyOpened(trustList)) {
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const certificateChain: Buffer = inputArguments[0].value as Buffer;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;

    const certificates = split_der(certificateChain);

    // validate certificate first
    const r = await verifyCertificateChain(certificates);
    if (r.status !== "Good") {
        warningLog("Invalid certificate ", r.status, r.reason);
        return { statusCode: StatusCodes.BadCertificateInvalid };
    }

    for (let i = 0; i < certificates.length; i++) {
        const certificate = certificates[i];
        if (i === certificates.length - 1 && isTrustedCertificate) {
            await cm.trustCertificate(certificate);
        } else {
            await cm.addIssuer(certificate);
        }
    }
    debugLog("_addCertificate - done isTrustedCertificate= ", isTrustedCertificate);
    return { statusCode: StatusCodes.Good };
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

    return { statusCode: StatusCodes.Good };
}

let counter = 0;

export async function promoteTrustList(trustList: UATrustList) {
    const filename = `/tmpFile${counter}`;
    counter += 1;

    installFileType(trustList, { filename, fileSystem: MemFs as AbstractFs });

    // we need to change the default open method
    const open = trustList.getChildByName("Open") as UAMethod;
    const _open_asyncExecutionFunction = (open as any)._asyncExecutionFunction as MethodFunctor;

    // ... and bind the extended methods as well.
    const closeAndUpdate = trustList.getChildByName("CloseAndUpdate") as UAMethod;
    const openWithMasks = trustList.getChildByName("OpenWithMasks") as UAMethod;
    const addCertificate = trustList.getChildByName("AddCertificate") as UAMethod;
    const removeCertificate = trustList.getChildByName("RemoveCertificate") as UAMethod;

    function _openTrustList(
        this: any,
        trustMask: TrustListMasks,
        inputArgs: Variant[],
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
        if (trustListIsAlreadyOpened(trustList)) {
            return callback(null, { statusCode: StatusCodes.BadInvalidState });
        }
        // if (trustList.isOpened) {
        //     warningLog("TrustList is already opened")
        //     return { statusCode: StatusCodes.BadInvalidState};
        // }

        // The Open Method shall not support modes other than Read (0x01) and the Write + EraseExisting (0x06).
        const openMask = inputArgs[0].value as number;
        if (openMask !== OpenFileMode.Read && openMask !== OpenFileMode.WriteEraseExisting) {
            return callback(null, { statusCode: StatusCodes.BadInvalidArgument });
        }
        // possible statusCode: Bad_UserAccessDenied	The current user does not have the rights required.
        const certificateManager = ((trustList as any).$$certificateManager as OPCUACertificateManager) || undefined;
        if (certificateManager) {
            writeTrustList(MemFs as AbstractFs, filename, trustMask, certificateManager)
                .then(() => {
                    //  trustList.isOpened = true;

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
    closeAndUpdate?.bindMethod(_closeAndUpdate);

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
