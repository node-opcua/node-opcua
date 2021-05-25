/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import * as ec from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator, OutputBinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import * as factories from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { NodeClass } from "node-opcua-data-model";
import { AddressSpace, UAMethod, UAObject } from "../address_space_ts";

const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);

function myfindBuiltInType(dataType: DataType): any {
    return factories.findBuiltInType(DataType[dataType]);
}

export function encode_ArgumentList(definition: any[], args: any, stream: OutputBinaryStream) {
    assert(definition.length === args.length);

    assert(Array.isArray(definition));
    assert(Array.isArray(args));
    assert(definition.length === args.length);
    assert(definition.length >= 0);

    // we only encode arguments by following the definition

    for (let i = 0; i < definition.length; i++) {
        const def = definition[i];
        const value = args[i];

        const encodeFunc = myfindBuiltInType(def.dataType).encode;
        // assert((def.valueRank === -1) || (def.valueRank === 0));

        // todo : handle -3 -2
        const isArray = def.valueRank && (def.valueRank === 1 || def.valueRank !== -1);

        if (isArray) {
            ec.encodeArray(value, stream, encodeFunc);
        } else {
            encodeFunc(value, stream);
        }
    }
}

export function decode_ArgumentList(definition: any[], stream: BinaryStream): any[] {
    if (!Array.isArray(definition)) {
        throw new Error(
            "This BaseDataType cannot be decoded because it has no definition.\n" +
                "Please construct a BaseDataType({definition : [{dataType: DataType.UInt32 }]});"
        );
    }

    const args: any[] = [];
    let value;

    for (const def of definition) {
        const decodeFunc = myfindBuiltInType(def.dataType).decode;

        // xx assert(def.valueRank === -1 || def.valueRank==0);
        const isArray = def.valueRank === 1 || def.valueRank === -1;

        if (isArray) {
            value = ec.decodeArray(stream, decodeFunc);
        } else {
            value = decodeFunc(stream);
        }
        args.push(value);
    }
    return args;
}

export function binaryStoreSize_ArgumentList(description: any, args: any) {
    assert(Array.isArray(description));
    assert(Array.isArray(args));
    assert(args.length === description.length);

    const stream = new BinaryStreamSizeCalculator();
    encode_ArgumentList(description, args, stream);
    return stream.length;
}

export function getMethodDeclaration_ArgumentList(
    addressSpace: AddressSpace,
    objectId: NodeId,
    methodId: NodeId
): { statusCode: StatusCode; methodDeclaration?: UAMethod } {
    // find object in address space
    const obj = addressSpace.findNode(objectId) as UAObject;
    if (!obj) {
        // istanbul ignore next
        if (doDebug) {
            debugLog("cannot find node ", objectId.toString());
        }
        return { statusCode: StatusCodes.BadNodeIdUnknown };
    }
    let objectMethod = obj.getMethodById(methodId) as UAMethod;
    if (!objectMethod) {
        // the method doesn't belong to the object, nevertheless
        // the method can be called
        objectMethod = addressSpace.findNode(methodId) as UAMethod;
        if (!objectMethod || objectMethod.nodeClass !== NodeClass.Method) {
            warningLog("cannot find method with id", methodId.toString(), "object Id = ", objectId.toString());
            return { statusCode: StatusCodes.BadMethodInvalid };
        }
    }

    const methodDeclarationId = objectMethod.methodDeclarationId;
    const methodDeclaration = addressSpace.findNode(methodDeclarationId) as UAMethod;
    if (!methodDeclaration) {
        //  return {statusCode: StatusCodes.BadMethodInvalid};
        return { statusCode: StatusCodes.Good, methodDeclaration: objectMethod };
    }
    // istanbul ignore next
    if (methodDeclaration.nodeClass !== NodeClass.Method) {
        throw new Error("Expecting a Method here");
    }
    return { statusCode: StatusCodes.Good, methodDeclaration };
}

/**
 * @private
 */
function isArgumentValid(addressSpace: AddressSpace, argDefinition: Argument, arg: Variant): boolean {
    assert(argDefinition.hasOwnProperty("dataType"));
    assert(argDefinition.hasOwnProperty("valueRank"));

    const argDefDataType = addressSpace.findDataType(argDefinition.dataType);
    const argDataType = addressSpace.findDataType(resolveNodeId(arg.dataType));

    // istanbul ignore next
    if (!argDefDataType) {
        debugLog("dataType ", argDefinition.dataType.toString(), "doesn't exist");
        return false;
    }

    if (argDefinition.valueRank > 0 && arg.dataType === DataType.Null) {
        // this is valid to receive an empty array ith DataType.Null;
        return true;
    }

    // istanbul ignore next
    if (!argDataType) {
        debugLog(" cannot find dataType ", arg.dataType, resolveNodeId(arg.dataType));
        debugLog(" arg = ", arg.toString());
        debugLog(" def =", argDefinition.toString());
        return false;
    }

    // istanbul ignore next
    if (doDebug) {
        debugLog(" checking argDefDataType ", argDefDataType.toString());
        debugLog(" checking argDataType ", argDataType.toString());
    }

    const isArray = arg.arrayType === VariantArrayType.Array;

    if (argDefinition.valueRank > 0) {
        return isArray;
    } else if (argDefinition.valueRank === -1) {
        // SCALAR
        if (isArray) {
            return false;
        }
    }

    if (argDataType.nodeId.value === argDefDataType!.nodeId.value) {
        return true;
    }

    // check that dataType is of the same type (derived )
    return argDefDataType.isSupertypeOf(argDataType);
}

/**
 * @method verifyArguments_ArgumentList
 * @param addressSpace
 * @param methodInputArguments
 * @param inputArguments
 * @return statusCode,inputArgumentResults
 */
export function verifyArguments_ArgumentList(
    addressSpace: AddressSpace,
    methodInputArguments: Argument[],
    inputArguments?: Variant[]
): {
    inputArgumentResults?: StatusCode[];
    statusCode: StatusCode;
} {
    if (!inputArguments) {
        // it is possible to not provide inputArguments when method  has no arguments
        return methodInputArguments.length === 0
            ? { statusCode: StatusCodes.Good }
            : { statusCode: StatusCodes.BadArgumentsMissing };
    }

    const inputArgumentResults: StatusCode[] = methodInputArguments.map((methodInputArgument, index) => {
        const argument = inputArguments![index];
        if (!argument) {
            return StatusCodes.BadNoData;
        } else if (!isArgumentValid(addressSpace, methodInputArgument, argument)) {
            return StatusCodes.BadTypeMismatch;
        } else {
            return StatusCodes.Good;
        }
    });

    if (methodInputArguments.length > inputArguments.length) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(
                "verifyArguments_ArgumentList " +
                    "\n       The client did  specify too many input arguments for the method.  " +
                    "\n        expected : " +
                    methodInputArguments.length +
                    "" +
                    "\n        actual   : " +
                    inputArguments.length
            );
        }
        return { inputArgumentResults, statusCode: StatusCodes.BadArgumentsMissing };
    }

    if (methodInputArguments.length < inputArguments.length) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(
                " verifyArguments_ArgumentList " +
                    "\n        The client did not specify all of the input arguments for the method. " +
                    "\n        expected : " +
                    methodInputArguments.length +
                    "" +
                    "\n        actual   : " +
                    inputArguments.length
            );
        }
        return { inputArgumentResults, statusCode: StatusCodes.BadTooManyArguments };
    }

    return {
        inputArgumentResults,
        statusCode: 
            (   
                inputArgumentResults.includes(StatusCodes.BadTypeMismatch)  ||
                inputArgumentResults.includes(StatusCodes.BadOutOfRange)
            ) 
            ? StatusCodes.BadInvalidArgument
            : StatusCodes.Good
    };
}

export function build_retrieveInputArgumentsDefinition(addressSpace: AddressSpace) {
    const the_address_space = addressSpace;
    return (objectId: NodeId, methodId: NodeId) => {
        const response = getMethodDeclaration_ArgumentList(the_address_space, objectId, methodId);

        /* istanbul ignore next */
        if (response.statusCode !== StatusCodes.Good) {
            debugLog(" StatusCode  = " + response.statusCode.toString());
            throw new Error(
                "Invalid Method " +
                    response.statusCode.toString() +
                    " ObjectId= " +
                    objectId.toString() +
                    "Method Id =" +
                    methodId.toString()
            );
        }
        const methodDeclaration = response.methodDeclaration!;
        // verify input Parameters
        const methodInputArguments = methodDeclaration.getInputArguments();
        assert(Array.isArray(methodInputArguments));
        return methodInputArguments;
    };
}
