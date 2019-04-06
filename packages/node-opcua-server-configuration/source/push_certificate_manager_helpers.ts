/**
 * @module node-opcua-server-configuration
 */

import { callbackify } from "util";

import { AddressSpace, SessionContext, UAMethod } from "node-opcua-address-space";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

function expected(variant: Variant | undefined, dataType: DataType, variantArrayType: VariantArrayType) {
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

async function _createSigningRequest(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    const certificaeGroupeIdVariant = inputArguments[0];
    const certificateTypeIdVariant = inputArguments[1];
    const subjectNameVariant = inputArguments[2];
    const regeneratePrivateKeyVariant = inputArguments[3];
    const nonceVariant = inputArguments[4];

    if (!expected(certificaeGroupeIdVariant, DataType.NodeId, VariantArrayType.Scalar)) {
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

    const certificaeGroupeId = certificaeGroupeIdVariant.value as NodeId;
    const certificateTypeId = certificateTypeIdVariant.value as NodeId;
    const subjectName = subjectNameVariant.value as string;
    const regeneratePrivateKey = regeneratePrivateKeyVariant.value as boolean;
    const nonce = nonceVariant.value as Buffer;

    const certificateRequest = Buffer.from("qsdqsdqs");
    const statusCode = StatusCodes.Good;

    const callMethodResult = {
        outputArguments: [
            { dataType: DataType.ByteString, value: certificateRequest }
        ],

        statusCode
    };
    return callMethodResult;
}

function hasExpectedUserAccess(context: SessionContext) {
    if (!context ||
      !context.session ||
      !context.session.userIdentityToken) {
        return false;
    }
    const currentUserRole = context.getCurrentUserRole();
    return currentUserRole === "admin";
}

function hasEncryptedChannel(context: SessionContext) {
    // todo
    return true;
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
    const privateKeyFormat: string = inputArguments[4].value as string;
    const privateKey: Buffer = inputArguments[5].value as Buffer;

    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    if (privateKeyFormat.toLowerCase() !== "pem") {
        console.log(" Invalid PEM format requested " + privateKeyFormat );
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const applyChangesRequired = true;
    const statusCode = StatusCodes.Good;

    const callMethodResult = {
        outputArguments: [
            { dataType: DataType.Boolean, value: applyChangesRequired }
        ],
        statusCode
    };
    return callMethodResult;
}

export function installPushCertificateManagement(addressSpace: AddressSpace) {

    const server = addressSpace.rootFolder.objects.server;

    server.serverConfiguration.supportedPrivateKeyFormats.setValueFromSource({
        arrayType: VariantArrayType.Array,
        dataType: DataType.String,
        value: ["PEM"]
    });

    server.serverConfiguration.createSigningRequest.bindMethod(callbackify(_createSigningRequest));

    server.serverConfiguration.updateCertificate.bindMethod(callbackify(_updateCertificate));

}
