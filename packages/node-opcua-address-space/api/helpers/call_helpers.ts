/**
 * @module node-opcua-address-space
 */

import type { BaseNode, IAddressSpace, ISessionContext, UAMethod, UAObject, UAObjectType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import type { CallMethodRequest } from "node-opcua-service-call";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { type CallMethodResultOptions, PermissionType } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";

import { getMethodDeclaration_ArgumentList, verifyArguments_ArgumentList } from "./argument_list.js";
import { resolveOpaqueOnAddressSpace } from "./resolve_opaque_on_address_space.js";

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
// BadInvalidArgument           One of the input arguments is not valid; inputArgumentResults[i] says why:
// BadOutOfRange                Used to indicate that an input argument is outside the acceptable range.
// BadTypeMismatch              Used to indicate that an input argument does not have the correct data type.
//                               A ByteString is structurally the same as a one dimensional array of Byte.
//                               A server shall accept a ByteString if an array of Byte is expected.
// BadNoCommunication

// guards against a cyclic MethodDeclarationId chain or a runaway type hierarchy
const maxDepth = 64;

/** true when `method` was instantiated from `declaration`, directly or through a chain of MethodDeclarationId */
function isDeclaredBy(method: UAMethod, declaration: UAMethod): boolean {
    let current: UAMethod = method;
    for (let i = 0; i < maxDepth; i++) {
        const declarationId = current.methodDeclarationId;
        if (!declarationId || sameNodeId(declarationId, current.nodeId)) {
            return false;
        }
        if (sameNodeId(declarationId, declaration.nodeId)) {
            return true;
        }
        const next = current.addressSpace.findNode(declarationId);
        if (!next || next.nodeClass !== NodeClass.Method) {
            return false;
        }
        current = next as UAMethod;
    }
    return false;
}

/**
 * the Method whose implementation runs: the target's own, else the one named by methodId, else the first
 * bound Method along the target's MethodDeclarationId chain (an instance created before its type's method was
 * bound). The target itself when none is bound: execute() then reports it as not bound.
 */
function implementationOf(targetMethod: UAMethod, methodObj: UAMethod): UAMethod {
    if (targetMethod.isBound()) {
        return targetMethod;
    }
    if (methodObj.isBound()) {
        return methodObj;
    }
    let current: UAMethod = targetMethod;
    for (let i = 0; i < maxDepth; i++) {
        const declarationId = current.methodDeclarationId;
        if (!declarationId || sameNodeId(declarationId, current.nodeId)) {
            break;
        }
        const next = current.addressSpace.findNode(declarationId);
        if (!next || next.nodeClass !== NodeClass.Method) {
            break;
        }
        current = next as UAMethod;
        if (current.isBound()) {
            return current;
        }
    }
    return targetMethod;
}

/** the ObjectType of `object` (or `object` itself when it is an ObjectType) and all its supertypes */
function typeHierarchyOf(object: UAObject | UAObjectType): UAObjectType[] {
    const types: UAObjectType[] = [];
    let type: UAObjectType | null =
        object.nodeClass === NodeClass.ObjectType ? (object as UAObjectType) : (object as UAObject).typeDefinitionObj;
    while (type && types.length < maxDepth) {
        types.push(type);
        type = type.subtypeOfObj;
    }
    return types;
}

/**
 * true when `declaringNode` is an ObjectType that defines methods for `object`: one of its types or supertypes,
 * or an InterfaceType (or a supertype of one) that the object or one of its types implements (OPC 10000-3 v1.05.06 §4.10)
 */
function isTypeOf(declaringNode: BaseNode | null, object: UAObject | UAObjectType): boolean {
    if (!declaringNode || declaringNode.nodeClass !== NodeClass.ObjectType) {
        return false;
    }
    const types = typeHierarchyOf(object);
    if (types.includes(declaringNode as UAObjectType)) {
        return true;
    }
    if (!object.addressSpace.findReferenceType("HasInterface")) {
        return false;
    }
    for (const node of [object, ...types]) {
        for (const iface of node.findReferencesExAsObject("HasInterface", BrowseDirection.Forward)) {
            if (
                iface === declaringNode ||
                (iface.nodeClass === NodeClass.ObjectType && (iface as UAObjectType).isSubtypeOf(declaringNode as UAObjectType))
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * OPC 10000-4 v1.05.07 §5.12.2 Call, methodId: "If the objectId is the NodeId of an Object, the methodId is either the
 * NodeId of the Method that is a component of the Object instance or the NodeId of the Method in the ObjectType
 * that defines the Method. Independent of the methodId parameter, the RolePermissions are always verified with
 * the Method Node that is the target of a HasComponent from the Node defined by objectId."
 *
 * Returns the Method whose AccessRestrictions and RolePermissions govern the call:
 * - `methodObj` itself when it is a component of `object`;
 * - otherwise the component of `object` instantiated from `methodObj` (MethodDeclarationId), or, when
 *   `methodObj` belongs to a type of `object`, the component with the same BrowseName;
 * - `methodObj` when it belongs to a type of `object` that has no such component (a method called on its
 *   ObjectType, or an optional method not instantiated);
 * - BadMethodInvalid when `methodObj` is neither a method of `object` nor one of its types.
 */
function resolveMethodOfObject(
    object: UAObject | UAObjectType,
    methodObj: UAMethod
): { statusCode: StatusCode; method?: UAMethod } {
    if (object.getMethodById(methodObj.nodeId)) {
        return { statusCode: StatusCodes.Good, method: methodObj };
    }
    const methods = object.getMethods();
    const instantiated = methods.find((m) => isDeclaredBy(m, methodObj));
    if (instantiated) {
        return { statusCode: StatusCodes.Good, method: instantiated };
    }
    if (!isTypeOf(methodObj.parent, object)) {
        return { statusCode: StatusCodes.BadMethodInvalid };
    }
    const browseName = methodObj.browseName.toString();
    const sameName = methods.find((m) => m.browseName.toString() === browseName);
    return { statusCode: StatusCodes.Good, method: sameName || methodObj };
}

export async function callMethodHelper(
    context: ISessionContext,
    addressSpace: IAddressSpace,
    callMethodRequest: CallMethodRequest
): Promise<CallMethodResultOptions> {
    const objectId = callMethodRequest.objectId;
    const methodId = callMethodRequest.methodId;
    const inputArguments = callMethodRequest.inputArguments || [];

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);

    const object = addressSpace.findNode(objectId) as UAObject;
    if (!object) {
        return { statusCode: StatusCodes.BadNodeIdUnknown };
    }
    if (object.nodeClass !== NodeClass.Object && object.nodeClass !== NodeClass.ObjectType) {
        return { statusCode: StatusCodes.BadNodeIdInvalid };
    }

    const methodObj = addressSpace.findNode(methodId) as UAMethod;
    if (!methodObj) {
        return { statusCode: StatusCodes.BadMethodInvalid };
    }
    if (methodObj.nodeClass !== NodeClass.Method) {
        return { statusCode: StatusCodes.BadMethodInvalid };
    }

    const resolved = resolveMethodOfObject(object, methodObj);
    if (!resolved.method) {
        return { statusCode: resolved.statusCode };
    }
    // the Method whose AccessRestrictions and RolePermissions apply, whatever methodId named
    const targetMethod = resolved.method;

    const response1 = getMethodDeclaration_ArgumentList(addressSpace, objectId, targetMethod.nodeId);

    if (response1.statusCode.isNotGood()) {
        return { statusCode: response1.statusCode };
    }
    const methodDeclaration = response1.methodDeclaration;
    if (!methodDeclaration) {
        return { statusCode: StatusCodes.BadMethodInvalid };
    }

    // verify input Parameters
    const methodInputArguments = methodDeclaration.getInputArguments();

    const response = verifyArguments_ArgumentList(addressSpace, methodInputArguments, inputArguments);
    if (response.statusCode.isNotGood()) {
        return response;
    }

    try {
        await resolveOpaqueOnAddressSpace(addressSpace, inputArguments);

        // execute() verifies the method it runs on; when the instance method has no implementation of its own,
        // the declaration's runs, so the instance method is verified here first, in the same order as execute()
        const executingMethod = implementationOf(targetMethod, methodObj);
        if (executingMethod !== targetMethod) {
            if (context.isAccessRestricted(targetMethod)) {
                return { statusCode: StatusCodes.BadSecurityModeInsufficient };
            }
            if (!context.checkPermission(targetMethod, PermissionType.Call)) {
                return { statusCode: StatusCodes.BadUserAccessDenied };
            }
        }
        const callMethodResponse = await executingMethod.execute(object, inputArguments, context);
        callMethodResponse.inputArgumentResults = callMethodResponse.inputArgumentResults || response.inputArgumentResults || [];
        assert(callMethodResponse.statusCode);

        if (callMethodResponse.statusCode?.isGood()) {
            assert(Array.isArray(callMethodResponse.outputArguments));
        }

        assert(Array.isArray(callMethodResponse.inputArgumentResults));
        assert(callMethodResponse.inputArgumentResults?.length === methodInputArguments.length);

        const outputArguments = callMethodResponse.outputArguments || [];
        await resolveOpaqueOnAddressSpace(addressSpace, outputArguments as Variant[]);

        return callMethodResponse;
    } catch (_err) {
        return { statusCode: StatusCodes.BadInternalError };
    }
}
