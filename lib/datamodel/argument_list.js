"use strict";
require("requirish")._(module);

var factories = require("lib/misc/factories");
var ec = require("lib/misc/encode_decode");
var Variant = require("lib/datamodel/variant").Variant;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var UADataType = require("lib/address_space/ua_data_type").UADataType;
var UAMethod = require("lib/address_space/ua_method").UAMethod;

var _ = require("underscore");
var assert = require("better-assert");

var Argument = require("_generated_/_auto_generated_Argument").Argument;

exports.Argument = Argument;

function myfindBuiltInType(dataType) {
    return factories.findBuiltInType(dataType.key);
}

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);


function encode_ArgumentList(definition, args, stream) {

    assert(definition.length === args.length);

    assert(_.isArray(definition));
    assert(_.isArray(args));
    assert(definition.length === args.length);
    assert(definition.length >= 0);

    // we only encode arguments by following the definition

    for (var i = 0; i < definition.length; i++) {

        var def = definition[i];
        var value = args[i];

        var encodeFunc = myfindBuiltInType(def.dataType).encode;

        // xx console.log(" cxxxxxxxxxxc ",def);
        // assert((def.valueRank === -1) || (def.valueRank === 0));

        // todo : handle -3 -2
        var isArray = (def.valueRank && ( def.valueRank === 1 || def.valueRank !== -1)) ? true : false;

        if (isArray) {
            ec.encodeArray(value, stream, encodeFunc);
        } else {
            encodeFunc(value, stream);
        }
    }

}
exports.encode_ArgumentList = encode_ArgumentList;

var decode_ArgumentList = function (definition, stream) {

    if (!_.isArray(definition)) {
        throw new Error(
            "This BaseDataType cannot be decoded because it has no definition.\n" +
            "Please construct a BaseDataType({definition : [{dataType: DataType.UInt32 }]});"
        );
    }

    var args = [];
    var value;

    for (var i = 0; i < definition.length; i++) {

        var def = definition[i];

        var decodeFunc = myfindBuiltInType(def.dataType).decode;

        //xx assert(def.valueRank == -1 || def.valueRank==0);
        var isArray = ( def.valueRank === 1 || def.valueRank === -1) ? true : false;

        if (isArray) {
            value = ec.decodeArray(stream, decodeFunc);
        } else {
            value = decodeFunc(stream);
        }
        args.push(value);
    }
    return args;
};

exports.decode_ArgumentList = decode_ArgumentList;

var BinaryStreamSizeCalculator = require("lib/misc/binaryStream").BinaryStreamSizeCalculator;
var binaryStoreSize_ArgumentList = function (description, args) {

    assert(_.isArray(description));
    assert(_.isArray(args));
    assert(args.length === description.length);

    var stream = new BinaryStreamSizeCalculator();
    encode_ArgumentList(description, args, stream);
    return stream.length;
};
exports.binaryStoreSize_ArgumentList = binaryStoreSize_ArgumentList;


function getMethodDeclaration_ArgumentList(addressSpace, objectId, methodId) {

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);
    // find object in address space
    var obj = addressSpace.findNode(objectId);
    if (!obj) {

        // istanbul ignore next
        if(doDebug) {
            console.warn("cannot find node ",objectId.toString());
        }
        return {statusCode: StatusCodes.BadNodeIdUnknown};
    }
    if (!obj.hasMethods) {
        return {statusCode: StatusCodes.BadNodeIdInvalid};
    }
    var objectMethod = obj.getMethodById(methodId);
    if (!objectMethod) {

        // the method doesn't belong to the object, nevertheless
        // the method can be called
        objectMethod = addressSpace.findNode(methodId);
        if (!objectMethod || !(objectMethod instanceof UAMethod)) {
            return {statusCode: StatusCodes.BadMethodInvalid};
        }
    }

    var methodDeclarationId = objectMethod.methodDeclarationId;

    var methodDeclaration = addressSpace.findNode(methodDeclarationId);
    if (!methodDeclaration) {
        //  return {statusCode: StatusCodes.BadMethodInvalid};
        return {statusCode: StatusCodes.Good, methodDeclaration: objectMethod};
    }
    return {statusCode: StatusCodes.Good, methodDeclaration: methodDeclaration};
}
exports.getMethodDeclaration_ArgumentList = getMethodDeclaration_ArgumentList;

/**
 *
 * @param addressSpace  {AddressSpace}
 * @param argDefinition {Argument}
 * @param arg           {Variant}
 * @return              {Boolean}
 * @private
 */
function isArgumentValid(addressSpace,argDefinition, arg) {

    assert(argDefinition instanceof Argument);
    assert(argDefinition.hasOwnProperty("dataType"));
    assert(argDefinition.hasOwnProperty("valueRank"));
    assert(arg instanceof Variant);

    var argDefDataType = addressSpace.findDataType(argDefinition.dataType);
    var argDataType = addressSpace.findDataType(arg.dataType);

    if (! argDataType) {
        console.log(" cannot find dataType ",arg.dataType);
        return false;
    }
    assert(argDefDataType instanceof UADataType);
    assert(argDataType    instanceof UADataType);

    // istanbul ignore next
    if (doDebug) {
        console.log(" checking argDefDataType ",argDefDataType.toString());
        console.log(" checking argDataType ",argDataType.toString());
    }


    var isArray = (arg.arrayType === VariantArrayType.Array);

    if (argDefinition.valueRank > 0) {

        return isArray;

    } else if (argDefinition.valueRank === -1 ) { // SCALAR
        if (isArray) {
            return false;
        }
    }

    if (argDataType.nodeId.value === argDefDataType.nodeId.value) {
        return true;
    }

    // check that dataType is of the same type (derived )
    return argDefDataType.isSupertypeOf(argDataType);

}

/**
 *
 * @param addressSpace {AddressSpace}
 * @param methodInputArguments {Argument[]}
 * @param inputArguments       {Variant[]}
 * @return statusCode,inputArgumentResults
 */
function verifyArguments_ArgumentList(addressSpace,methodInputArguments, inputArguments) {

    var inputArgumentResults = [];

    if (methodInputArguments.length > inputArguments.length) {
        // istanbul ignore next
        if (doDebug) {
            console.log("xxxxxxxx verifyArguments_ArgumentList " +
                "\n       The client did  specify too many input arguments for the method.  " +
                "\n        expected : " +methodInputArguments.length + "" +
                "\n        actual   : " + inputArguments.length );
        }
        return {statusCode: StatusCodes.BadInvalidArgument};
    }

    if (methodInputArguments.length < inputArguments.length) {
        // istanbul ignore next
        if (doDebug) {
            console.log("xxxxxxxx verifyArguments_ArgumentList " +
                "\n        The client did not specify all of the input arguments for the method. " +
                "\n        expected : " + methodInputArguments.length + "" +
                "\n        actual   : " + inputArguments.length);
        }
        return {statusCode: StatusCodes.BadArgumentsMissing};
    }

    var errorCount = 0;
    for (var i = 0; i < methodInputArguments.length; i++) {

        var argDefinition = methodInputArguments[i];

        var arg = inputArguments[i];

        // istanbul ignore next
        if (doDebug) {
            console.log("xxxxxxxx verifyArguments_ArgumentList checking argument " + i +
                "\n        expected : " + JSON.stringify(argDefinition) +
                "\n        actual:    " + JSON.stringify(arg));
        }
        if (!isArgumentValid(addressSpace,argDefinition, arg)) {
            // istanbul ignore next
            if (doDebug) {
                console.log("xxxxxxxx verifyArguments_ArgumentList \n" +
                            "         The client did specify a argument with the wrong data type.\n" +
                            "          expected : ".white + argDefinition.dataType + "\n" +
                            "          actual   :".cyan + arg.dataType);
            }
            inputArgumentResults.push(StatusCodes.BadTypeMismatch);
            errorCount += 1;
        } else {
            inputArgumentResults.push(StatusCodes.Good);
        }
    }
    assert(inputArgumentResults.length === methodInputArguments.length);

    var ret = {
        statusCode: errorCount === 0 ? StatusCodes.Good : StatusCodes.BadInvalidArgument,
        inputArgumentResults: inputArgumentResults
    };

    return ret;
}


exports.verifyArguments_ArgumentList = verifyArguments_ArgumentList;


function build_retrieveInputArgumentsDefinition(addressSpace) {
    var the_address_space = addressSpace;
    return function (objectId, methodId) {
        var response = getMethodDeclaration_ArgumentList(the_address_space, objectId, methodId);

        /* istanbul ignore next */
        if (response.statusCode !== StatusCodes.Good) {
            console.log(" StatusCode  = " + response.statusCode.toString());
            throw new Error("Invalid Method " + response.statusCode.toString() + "ObjectId= " + objectId.toString() + "Method Id =" + methodId.toString());
        }
        var methodDeclaration = response.methodDeclaration;
        // verify input Parameters
        var methodInputArguments = methodDeclaration.getInputArguments();
        assert(_.isArray(methodInputArguments));
        return methodInputArguments;
    };
}
exports.build_retrieveInputArgumentsDefinition = build_retrieveInputArgumentsDefinition;

function convertJavaScriptToVariant(argumentDefinition, values) {

    assert(argumentDefinition.length === values.length);
    assert(_.isArray(argumentDefinition));
    assert(_.isArray(values));

    return _.zip(values, argumentDefinition).map(function (pair) {

        var value = pair[0];
        var arg = pair[1];
        var variant = _.extend({}, arg);
        variant.value = value;
        return new Variant(variant);
    });
}
exports.convertJavaScriptToVariant = convertJavaScriptToVariant;
