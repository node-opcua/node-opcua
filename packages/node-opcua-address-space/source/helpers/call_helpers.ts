/**
 * @module node-opcua-address-space
 */
import _ = require("underscore");

import assert from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { CallMethodRequest } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";

import { IServerBase, ISessionBase, SessionContext } from "../session_context";
import { getMethodDeclaration_ArgumentList, verifyArguments_ArgumentList } from "./argument_list";
import { AddressSpace, UAMethod, UAObject } from "../address_space_ts";

// Symbolic Id                   Description
// ----------------------------  -----------------------------------------------------------------------------
// Bad_NodeIdInvalid             Used to indicate that the specified object is not valid.
//
// Bad_NodeIdUnknown             Used to indicate that the specified object is not valid.
//
// Bad_ArgumentsMissing          The client did not specify all of the input arguments for the method.
// Bad_UserAccessDenied
//
// Bad_MethodInvalid             The method id does not refer to a method for the specified object.
// Bad_OutOfRange                Used to indicate that an input argument is outside the acceptable range.
// Bad_TypeMismatch              Used to indicate that an input argument does not have the correct data type.
//                               A ByteString is structurally the same as a one dimensional array of Byte.
//                               A server shall accept a ByteString if an array of Byte is expected.
// Bad_NoCommunication
type ResponseCallback<T> = (err: Error | null, result?: T) => void;

export function callMethodHelper(
  server: IServerBase,
  session: ISessionBase,
  addressSpace: AddressSpace,
  callMethodRequest: CallMethodRequest,
  callback: ResponseCallback<CallMethodResultOptions>
): void {
    const objectId = callMethodRequest.objectId;
    const methodId = callMethodRequest.methodId;
    const inputArguments = callMethodRequest.inputArguments || [];

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);

    let response = getMethodDeclaration_ArgumentList(addressSpace, objectId, methodId);

    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, { statusCode: response.statusCode });
    }
    const methodDeclaration = response.methodDeclaration;

    // verify input Parameters
    const methodInputArguments = methodDeclaration.getInputArguments();

    response = verifyArguments_ArgumentList(addressSpace, methodInputArguments, inputArguments);
    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, response);
    }

    const methodObj = addressSpace.findNode(methodId) as UAMethod;
    if (methodObj.nodeClass !== NodeClass.Method) {
        return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
    }

    // invoke method on object
    const context = new SessionContext({
        object: addressSpace.findNode(objectId) as UAObject,
        server,
        session
    });

    methodObj.execute(inputArguments, context,
      (err: Error | null, callMethodResponse?: CallMethodResultOptions) => {

          /* istanbul ignore next */
          if (err) {
              return callback(err);
          }
          if (!callMethodResponse) {
              return callback(new Error("internal Error"));
          }

          callMethodResponse.inputArgumentResults = response.inputArgumentResults || [];
          assert(callMethodResponse.statusCode);

          if (callMethodResponse.statusCode === StatusCodes.Good) {
              assert(_.isArray(callMethodResponse.outputArguments));
          }

          assert(_.isArray(callMethodResponse.inputArgumentResults));
          assert(callMethodResponse.inputArgumentResults!.length === methodInputArguments.length);

          return callback(null, callMethodResponse);
      });
}
