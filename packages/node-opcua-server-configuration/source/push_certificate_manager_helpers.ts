/**
 * @module node-opcua-server-configuration
 */

import { callbackify } from "util";

import { AddressSpace, SessionContext, UAMethod } from "node-opcua-address-space";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { ByteString, UAString } from "node-opcua-basic-types";
import { CreateSigningRequestResult, PushCertificateManager } from "./push_certificate_manager";
import {
    PushCertificateManagerServerImpl,
    PushCertificateManagerServerOptions
} from "./server/push_certificate_manager_server_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = debugLog;

function hasExpectedUserAccess(context: SessionContext) {
    if (!context ||
      !context.session ||
      !context.session.userIdentityToken) {
        return false;
    }
    const currentUserRole = context.getCurrentUserRole();
    return !!currentUserRole.match("SecurityAdmin");
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
                value: !!result.applyChangesRequired! }
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

export function installPushCertificateManagement(
  addressSpace: AddressSpace,
  options: PushCertificateManagerServerOptions
) {

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

}
