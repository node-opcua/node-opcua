"use strict";
require("requirish")._(module);

var factories = require("lib/misc/factories");
var ec = require("lib/misc/encode_decode");
var Variant = require("lib/datamodel/variant").Variant;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var _ = require("underscore");
var assert = require("better-assert");

var Argument = require("_generated_/_auto_generated_Argument").Argument;

exports.Argument = Argument;

function myfindBuiltInType(dataType) {
    return factories.findBuiltInType(dataType.key);
}

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
        return {statusCode: StatusCodes.BadNodeIdUnknown};
    }
    if (!obj.hasMethods) {
        return {statusCode: StatusCodes.BadNodeIdInvalid};
    }
    var objectMethod = obj.getMethodById(methodId);
    if (!objectMethod) {
        return {statusCode: StatusCodes.BadMethodInvalid};
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

function isArgumentValid(argDefinition, arg) {

    assert(arg instanceof Variant);
    assert(argDefinition instanceof Argument);

    assert(argDefinition.hasOwnProperty("dataType"));
    assert(argDefinition.hasOwnProperty("valueRank"));

    var isArray = (arg.arrayType === VariantArrayType.Array);

    if (argDefinition.valueRank > 0) {
        // arg is
        return isArray;
    } else if (argDefinition.valueRank === -1 ) { // SCALAR
        if (isArray) {
            return false;
        }
    }

    // check that datatype is the same
    return (argDefinition.dataType.value === arg.dataType.value);
}


function verifyArguments_ArgumentList(methodInputArguments, inputArguments) {

    var inputArgumentResults = [];

    if (methodInputArguments.length > inputArguments.length) {
        //xx console.log("xxxxxxxx verifyArguments_ArgumentList The client did  specify too many input arguments for the method.   expected : " +methodInputArguments.length + " actual = " + inputArguments.length );
        return {statusCode: StatusCodes.BadInvalidArgument};
    }

    if (methodInputArguments.length < inputArguments.length) {
        //xx console.log("xxxxxxxx verifyArguments_ArgumentList The client did not specify all of the input arguments for the method.   expected : " +methodInputArguments.length + " actual = " + inputArguments.length );
        return {statusCode: StatusCodes.BadArgumentsMissing};
    }

    var errorCount = 0;
    for (var i = 0; i < methodInputArguments.length; i++) {
        var argDefinition = methodInputArguments[i];
        var arg = inputArguments[i];
        //xx console.log("xxxxxxxx verifyArguments_ArgumentList checking argument " + i + "  expected : " + JSON.stringify(argDefinition)+ " actual = " + JSON.stringify(arg));
        if (!isArgumentValid(argDefinition, arg)) {
            //xx console.log("xxxxxxxx verifyArguments_ArgumentList The client did specify a argument with the wrong data type.   expected : " +argDefinition.dataType+ " actual = " + arg.dataType);
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
