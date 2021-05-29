/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { ExtraDataTypeManager, resolveDynamicExtensionObject } from "node-opcua-client-dynamic-extension-object";
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { CallMethodRequest } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { UAObjectType } from "../../src/ua_object_type";

import { AddressSpace, UAMethod, UAObject } from "../address_space_ts";
import { ensureDatatypeExtractedWithCallback } from "../loader/load_nodeset2";
import { SessionContext } from "../session_context";
import { getMethodDeclaration_ArgumentList, verifyArguments_ArgumentList } from "./argument_list";

// Symbolic Id                   Description
// ----------------------------  -----------------------------------------------------------------------------
// BadNodeIdInvalid              Used to indicate that the specified object is not valid.
//
// BadNodeIdUnknown             Used to indicate that the specified object is not valid.
//
// BadArgumentsMissing          The client did not specify all of the input arguments for the method.
// BadUserAccessDenied
//
// BadMethodInvalid             The method id does not refer to a method for the specified object.
// BadOutOfRange                Used to indicate that an input argument is outside the acceptable range.
// BadTypeMismatch              Used to indicate that an input argument does not have the correct data type.
//                               A ByteString is structurally the same as a one dimensional array of Byte.
//                               A server shall accept a ByteString if an array of Byte is expected.
// BadNoCommunication
type ResponseCallback<T> = (err: Error | null, result?: T) => void;

export function callMethodHelper(
    context: SessionContext,
    addressSpace: AddressSpace,
    callMethodRequest: CallMethodRequest,
    callback: ResponseCallback<CallMethodResultOptions>
): void {

    const objectId = callMethodRequest.objectId;
    const methodId = callMethodRequest.methodId;
    const inputArguments = callMethodRequest.inputArguments || [];

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);

    const object = addressSpace.findNode(objectId) as UAObject;
    if (!object) {
        return callback(null, { statusCode: StatusCodes.BadNodeIdUnknown });
    }
    if (object.nodeClass !== NodeClass.Object && object.nodeClass !== NodeClass.ObjectType) {
        return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
    }

    const methodObj = addressSpace.findNode(methodId) as UAMethod;
    if (!methodObj) {
        return callback(null, { statusCode: StatusCodes.BadNodeIdUnknown });
    }
    if (methodObj.nodeClass !== NodeClass.Method) {
        return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
    }

    const response1 = getMethodDeclaration_ArgumentList(addressSpace, objectId, methodId);

    if (response1.statusCode !== StatusCodes.Good) {
        return callback(null, { statusCode: response1.statusCode });
    }
    const methodDeclaration = response1.methodDeclaration!;

    // verify input Parameters
    const methodInputArguments = methodDeclaration.getInputArguments();

    const response = verifyArguments_ArgumentList(addressSpace, methodInputArguments, inputArguments);
    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, response);
    }

    let l_extraDataTypeManager: ExtraDataTypeManager;

    ensureDatatypeExtractedWithCallback(addressSpace, (err2: Error | null, extraDataTypeManager?: ExtraDataTypeManager) => {
        if (err2) {
            return callback(err2);
        }
        l_extraDataTypeManager = extraDataTypeManager!;

        // resolve opaque data structure from inputArguments
        for (const variant of inputArguments) {
            resolveDynamicExtensionObject(variant, l_extraDataTypeManager);
        }

        methodObj.execute(object, inputArguments, context, (err: Error | null, callMethodResponse?: CallMethodResultOptions) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!callMethodResponse) {
                return callback(new Error("internal Error"));
            }

            callMethodResponse.inputArgumentResults =
                callMethodResponse.inputArgumentResults || response.inputArgumentResults || [];
            assert(callMethodResponse.statusCode);

            if (callMethodResponse.statusCode === StatusCodes.Good) {
                assert(Array.isArray(callMethodResponse.outputArguments));
            }

            assert(Array.isArray(callMethodResponse.inputArgumentResults));
            assert(callMethodResponse.inputArgumentResults!.length === methodInputArguments.length);

            if (callMethodResponse.outputArguments) {
                const outputArguments = callMethodResponse.outputArguments || [];
                for (const variant of outputArguments) {
                    resolveDynamicExtensionObject(variant as Variant, l_extraDataTypeManager);
                }
            }

            return callback(null, callMethodResponse);
        });
    });
}
