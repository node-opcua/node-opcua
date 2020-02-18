/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import * as ec from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator, OutputBinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import * as factories from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant, VariantLike } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { NodeClass } from "node-opcua-data-model";
import { ArgumentOptions } from "node-opcua-types";
import { AddressSpace, UADataType, UAMethod, UAObject } from "../address_space_ts";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function myfindBuiltInType(dataType: DataType): any {
    return factories.findBuiltInType(DataType[dataType]);
}

export function encode_ArgumentList(
    definition: any[],
    args: any,
    stream: OutputBinaryStream
) {

    assert(definition.length === args.length);

    assert(_.isArray(definition));
    assert(_.isArray(args));
    assert(definition.length === args.length);
    assert(definition.length >= 0);

    // we only encode arguments by following the definition

    for (let i = 0; i < definition.length; i++) {

        const def = definition[i];
        const value = args[i];

        const encodeFunc = myfindBuiltInType(def.dataType).encode;
        // assert((def.valueRank === -1) || (def.valueRank === 0));

        // todo : handle -3 -2
        const isArray = (def.valueRank && (def.valueRank === 1 || def.valueRank !== -1));

        if (isArray) {
            ec.encodeArray(value, stream, encodeFunc);
        } else {
            encodeFunc(value, stream);
        }
    }

}

export function decode_ArgumentList(definition: any[], stream: BinaryStream): any[] {

    if (!_.isArray(definition)) {
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
        const isArray = (def.valueRank === 1 || def.valueRank === -1);

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

    assert(_.isArray(description));
    assert(_.isArray(args));
    assert(args.length === description.length);

    const stream = new BinaryStreamSizeCalculator();
    encode_ArgumentList(description, args, stream);
    return stream.length;
}

export function getMethodDeclaration_ArgumentList(
    addressSpace: AddressSpace,
    objectId: NodeId,
    methodId: NodeId
): any {

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);
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
            return { statusCode: StatusCodes.BadMethodInvalid };
        }
    }

    const methodDeclarationId = (objectMethod as any).methodDeclarationId;

    const methodDeclaration = addressSpace.findNode(methodDeclarationId);
    if (!methodDeclaration) {
        //  return {statusCode: StatusCodes.BadMethodInvalid};
        return { statusCode: StatusCodes.Good, methodDeclaration: objectMethod };
    }
    return { statusCode: StatusCodes.Good, methodDeclaration };
}

/**
 * @private
 */
function isArgumentValid(
    addressSpace: AddressSpace,
    argDefinition: Argument,
    arg: Variant
): boolean {

    assert(argDefinition instanceof Argument);
    assert(argDefinition.hasOwnProperty("dataType"));
    assert(argDefinition.hasOwnProperty("valueRank"));
    assert(arg instanceof Variant);

    const argDefDataType = addressSpace.findDataType(argDefinition.dataType);
    const argDataType = addressSpace.findDataType(resolveNodeId(arg.dataType));

    // istanbul ignore next
    if (!argDefDataType) {
        return false;
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

    const isArray = (arg.arrayType === VariantArrayType.Array);

    if (argDefinition.valueRank > 0) {

        return isArray;

    } else if (argDefinition.valueRank === -1) { // SCALAR
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
    inputArgumentResults?: StatusCode[],
    statusCode: StatusCode,
} {

    const inputArgumentResults: StatusCode[] = [];

    if (methodInputArguments.length === 0 && !inputArguments) {
        // it is possible to not provide inputArguments when method  has no arguments
        return { statusCode: StatusCodes.Good };
    }
    if (methodInputArguments.length > 0 && !inputArguments) {
        return { statusCode: StatusCodes.BadArgumentsMissing };
    }
    inputArguments = inputArguments || [];
    if (methodInputArguments.length > inputArguments.length) {
        // istanbul ignore next
        if (doDebug) {
            debugLog("verifyArguments_ArgumentList " +
                "\n       The client did  specify too many input arguments for the method.  " +
                "\n        expected : " + methodInputArguments.length + "" +
                "\n        actual   : " + inputArguments.length);
        }
        return { statusCode: StatusCodes.BadArgumentsMissing };
    }

    if (methodInputArguments.length < inputArguments.length) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(" verifyArguments_ArgumentList " +
                "\n        The client did not specify all of the input arguments for the method. " +
                "\n        expected : " + methodInputArguments.length + "" +
                "\n        actual   : " + inputArguments.length);
        }
        return { statusCode: StatusCodes.BadTooManyArguments };
    }

    let errorCount = 0;
    for (let i = 0; i < methodInputArguments.length; i++) {

        const argDefinition = methodInputArguments[i];

        const arg = inputArguments[i];

        // istanbul ignore next
        if (doDebug) {
            debugLog("verifyArguments_ArgumentList checking argument " + i +
                "\n        argDefinition is    : " + JSON.stringify(argDefinition) +
                "\n        corresponding arg is: " + JSON.stringify(arg));
        }
        if (!isArgumentValid(addressSpace, argDefinition, arg)) {
            // istanbul ignore next
            if (doDebug) {
                debugLog("verifyArguments_ArgumentList \n" +
                    "         The client did specify a argument with the wrong data type.\n" +
                    chalk.white("          expected : ") + argDefinition.dataType + "\n" +
                    chalk.cyan("          actual   :") + arg.dataType);
            }
            inputArgumentResults.push(StatusCodes.BadTypeMismatch);
            errorCount += 1;
        } else {
            inputArgumentResults.push(StatusCodes.Good);
        }
    }
    assert(inputArgumentResults.length === methodInputArguments.length);

    const ret = {
        inputArgumentResults,
        statusCode: errorCount === 0 ? StatusCodes.Good : StatusCodes.BadInvalidArgument
    };

    return ret;
}

export function build_retrieveInputArgumentsDefinition(
    addressSpace: AddressSpace
) {
    const the_address_space = addressSpace;
    return (objectId: NodeId, methodId: NodeId) => {
        const response = getMethodDeclaration_ArgumentList(the_address_space, objectId, methodId);

        /* istanbul ignore next */
        if (response.statusCode !== StatusCodes.Good) {
            debugLog(" StatusCode  = " + response.statusCode.toString());
            throw new Error("Invalid Method " + response.statusCode.toString() +
                " ObjectId= " + objectId.toString() + "Method Id =" + methodId.toString());
        }
        const methodDeclaration = response.methodDeclaration;
        // verify input Parameters
        const methodInputArguments = methodDeclaration.getInputArguments();
        assert(_.isArray(methodInputArguments));
        return methodInputArguments;
    };
}

export function convertJavaScriptToVariant(
    argumentDefinition: ArgumentOptions[],
    values: any[]
): Variant[] {

    assert(argumentDefinition.length === values.length);
    assert(_.isArray(argumentDefinition));
    assert(_.isArray(values));

    return _.zip(values, argumentDefinition).map((pair: any) => {
        pair = pair as [VariantLike, Argument];
        const value = pair[0];
        const arg = pair[1];
        const variant = _.extend({}, arg);
        variant.value = value;
        return new Variant(variant);
    });
}
