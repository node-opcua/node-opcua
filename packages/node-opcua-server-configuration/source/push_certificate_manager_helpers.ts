/**
 * @module node-opcua-server-configuration
 */

import { callbackify } from "util";

import { AddressSpace, MethodFunctor, SessionContext, UAMethod, UATrustList, WellKnownRoles } from "node-opcua-address-space";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";

import { ByteString, UAString } from "node-opcua-basic-types";
import { CreateSigningRequestResult, PushCertificateManager } from "./push_certificate_manager";
import {
    installCertificateExpirationAlarm
} from "./server/install_CertificateAlarm";
import {
    PushCertificateManagerServerImpl,
    PushCertificateManagerServerOptions
} from "./server/push_certificate_manager_server_impl";
import { UAObject, UAFileType } from "node-opcua-address-space";
import { AbstractFs, installFileType } from "node-opcua-file-transfer";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { writeTrustList } from "./server/trust_list_server";
import { fs as MemFs } from "memfs";
import { CertificateManager } from "node-opcua-pki";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
const errorLog = debugLog;

function hasExpectedUserAccess(context: SessionContext) {
    if (!context ||
        !context.session ||
        !context.session.userIdentityToken) {
        return false;
    }
    return context.currentUserHasRole(WellKnownRoles.SecurityAdmin);
}

function hasEncryptedChannel(context: SessionContext) {
    // todo
    return true;
}

function expected(
    variant: Variant | undefined,
    dataType: DataType,
    variantArrayType: VariantArrayType
): boolean {
    if (!variant) {
        return false;
    }
    if (variant.dataType !== dataType) {
        return false;
    }
    if (variant.arrayType !== variantArrayType) {
        return false;
    }
    return true;
}

function getPushCertificateManager(method: UAMethod): PushCertificateManager | null {

    const serverConfiguration = method.addressSpace.rootFolder.objects.server.serverConfiguration;
    const serverConfigurationPriv = serverConfiguration as any;
    if (serverConfigurationPriv.$pushCertificateManager) {
        return serverConfigurationPriv.$pushCertificateManager;
    }
    // throw new Error("Cannot find pushCertificateManager object");
    return null;
}

async function _createSigningRequest(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    const certificateGroupIdVariant = inputArguments[0];
    const certificateTypeIdVariant = inputArguments[1];
    const subjectNameVariant = inputArguments[2];
    const regeneratePrivateKeyVariant = inputArguments[3];
    const nonceVariant = inputArguments[4];

    if (!expected(certificateGroupIdVariant, DataType.NodeId, VariantArrayType.Scalar)) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(certificateTypeIdVariant, DataType.NodeId, VariantArrayType.Scalar)) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(subjectNameVariant, DataType.String, VariantArrayType.Scalar)) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(regeneratePrivateKeyVariant, DataType.Boolean, VariantArrayType.Scalar)) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(regeneratePrivateKeyVariant, DataType.Boolean, VariantArrayType.Scalar)) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }

    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const certificateGroupId = certificateGroupIdVariant.value as NodeId;
    const certificateTypeId = certificateTypeIdVariant.value as NodeId;
    const subjectName = subjectNameVariant.value as string;
    const regeneratePrivateKey = regeneratePrivateKeyVariant.value as boolean;
    const nonce = nonceVariant.value as Buffer;

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }
    const result: CreateSigningRequestResult = await pushCertificateManager.createSigningRequest(
        certificateGroupId,
        certificateTypeId,
        subjectName,
        regeneratePrivateKey,
        nonce
    );

    if (result.statusCode !== StatusCodes.Good) {
        return { statusCode: result.statusCode };
    }

    const callMethodResult = {
        outputArguments: [
            {
                dataType: DataType.ByteString,
                value: result.certificateSigningRequest
            }
        ],
        statusCode: result.statusCode
    };
    return callMethodResult;
}

async function _updateCertificate(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    const certificateGroupId: NodeId = inputArguments[0].value as NodeId;
    const certificateTypeId: NodeId = inputArguments[1].value as NodeId;
    const certificate: Buffer = inputArguments[2].value as Buffer;
    const issuerCertificates: Buffer[] = inputArguments[3].value as Buffer[];
    const privateKeyFormat: UAString = inputArguments[4].value as UAString;
    const privateKey: Buffer = inputArguments[5].value as ByteString;

    // This Method requires an encrypted channel and that the Client provides credentials with
    // administrative rights on the Server
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    if (privateKeyFormat && privateKeyFormat !== "" && privateKeyFormat.toLowerCase() !== "pem") {
        errorLog("_updateCertificate: Invalid PEM format requested " + privateKeyFormat);
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }

    const result = await pushCertificateManager.updateCertificate(
        certificateGroupId,
        certificateTypeId,
        certificate,
        issuerCertificates,
        privateKeyFormat,
        privateKey,
    );

    // todo   raise a CertificateUpdatedAuditEventType

    if (result.statusCode !== StatusCodes.Good) {
        return { statusCode: result.statusCode };
    }
    const callMethodResult = {
        outputArguments: [
            {
                dataType: DataType.Boolean,
                value: !!result.applyChangesRequired!
            }
        ],
        statusCode: result.statusCode
    };
    return callMethodResult;
}

async function _getRejectedList(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }

    const result = await pushCertificateManager.getRejectedList();

    if (result.statusCode !== StatusCodes.Good) {
        return { statusCode: result.statusCode };
    }

    return {
        outputArguments: [
            {
                arrayType: VariantArrayType.Array,
                dataType: DataType.ByteString,
                value: result.certificates
            }
        ],
        statusCode: StatusCodes.Good
    };
}

async function _applyChanges(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    // This Method requires an encrypted channel and that the Client provide credentials with
    // administrative rights on the Server.
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }
    const statusCode = await pushCertificateManager.applyChanges();
    return { statusCode };
}


// in TrustList
async function _addCertificate(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    console.log("_addCertificate");
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }
    const trustList = context.object as UATrustList;
    const cm = (trustList as any).$$certificateManager as CertificateManager || null;
    if (!cm) {
        return { statusCode: StatusCodes.BadInternalError };
    }
    const certificate: Buffer = inputArguments[0].value as Buffer;
    const isTrustedCertificate: boolean = inputArguments[1].value as boolean;
    if (isTrustedCertificate) {
        await cm.trustCertificate(certificate);
    } else {
        await cm.addIssuer(certificate);
    }
    console.log("_addCertificate - done");
    return { statusCode: StatusCodes.Good };

}
async function _removeCertificate(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
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

function bindCertificateManager(
    addressSpace: AddressSpace,
    options: PushCertificateManagerServerOptions
) {

    const serverConfiguration = addressSpace.rootFolder.objects.server.serverConfiguration;

    const defaultApplicationGroup = serverConfiguration.certificateGroups.getComponentByName("DefaultApplicationGroup");
    if (defaultApplicationGroup) {
        const trustList = defaultApplicationGroup.getComponentByName("TrustList");
        if (trustList) {
            (trustList as any).$$certificateManager = options.applicationGroup;
        }
    }
    const defaultTokenGroup = serverConfiguration.certificateGroups.getComponentByName("DefaultUserTokenGroup");
    if (defaultTokenGroup) {
        const trustList = defaultTokenGroup.getComponentByName("TrustList");
        if (trustList) {
            (trustList as any).$$certificateManager = options.userTokenGroup;
        }
    }
}
export async function installPushCertificateManagement(
    addressSpace: AddressSpace,
    options: PushCertificateManagerServerOptions
): Promise<void> {

    const serverConfiguration = addressSpace.rootFolder.objects.server.serverConfiguration;

    const serverConfigurationPriv = serverConfiguration as any;
    if (serverConfigurationPriv.$pushCertificateManager) {
        return;
        throw new Error("PushCertificateManagement has already been installed");
    }
    serverConfigurationPriv.$pushCertificateManager = new PushCertificateManagerServerImpl(options);

    serverConfiguration.supportedPrivateKeyFormats.setValueFromSource({
        arrayType: VariantArrayType.Array,
        dataType: DataType.String,
        value: ["PEM"]
    });

    serverConfiguration.createSigningRequest.bindMethod(callbackify(_createSigningRequest));

    serverConfiguration.updateCertificate.bindMethod(callbackify(_updateCertificate));

    serverConfiguration.getRejectedList.bindMethod(callbackify(_getRejectedList));

    if (serverConfiguration.applyChanges) {
        serverConfiguration.applyChanges!.bindMethod(callbackify(_applyChanges));
    }

    installCertificateExpirationAlarm(addressSpace);


    async function _closeAndUpdate(
        this: UAMethod,
        inputArguments: Variant[],
        context: SessionContext
    ): Promise<CallMethodResultOptions> {
        return { statusCode: StatusCodes.Good };
    }
    async function promoteCertificateGroup(certificateGroup: UAObject) {
        const trustList = certificateGroup.getChildByName("TrustList");
        if (trustList) {

            const filename = "/tmpFile" + counter; counter += 1;

            installFileType(trustList as UAFileType, { filename, fileSystem: MemFs as AbstractFs });

            const closeAndUpdate = trustList.getChildByName("CloseAndUpdate") as UAMethod;
            closeAndUpdate?.bindMethod(callbackify(_closeAndUpdate));

            // change open methos
            const open = trustList.getChildByName("Open") as UAMethod;

            const _asyncExecutionFunction = (open as any)._asyncExecutionFunction as MethodFunctor;
            open.bindMethod(function (this: any, inputArgs: Variant[], context: SessionContext, callback: any) {
                //
                const certificateMangaer = (trustList as any).$$certificateManager as OPCUACertificateManager || undefined;
                if (certificateMangaer) {
                    writeTrustList(MemFs as AbstractFs, filename, certificateMangaer).then(() => {
                        _asyncExecutionFunction.call(this, inputArgs, context, callback);
                    }).catch((err) => {
                        callback(err);
                    })
                } else {
                    console.log("do something to update the document before we open it")
                    return _asyncExecutionFunction.call(this, inputArgs, context, callback);
                }
            })

            const addCertificate = trustList.getChildByName("AddCertificate") as UAMethod;
            addCertificate.bindMethod(callbackify(_addCertificate));
            const removeCertificate = trustList.getChildByName("RemoveCertificate") as UAMethod;
            removeCertificate.bindMethod(callbackify(_removeCertificate));


        }
    }
    const cg = serverConfiguration.certificateGroups.getComponents();
    for (const certificateGroup of cg) {
        if (certificateGroup.nodeClass !== NodeClass.Object) {
            continue;
        }
        await promoteCertificateGroup(certificateGroup as UAObject);
    }
    await bindCertificateManager(addressSpace, options);
}

