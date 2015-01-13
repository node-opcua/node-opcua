require("requirish")._(module);

var factories = require("lib/misc/factories");
var ec = require("lib/misc/encode_decode");
var DataType = require("lib/datamodel/variant").DataType;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var _ = require("underscore");
var assert = require("better-assert");

var Argument = require("_generated_/_auto_generated_Argument").Argument;

exports.Argument = Argument;

function myfindBuiltInType(dataType) {

    if (dataType instanceof NodeId) {
        assert(dataType.namespace === 0);
        dataType =DataType.get(dataType.value);
    }
    return factories.findBuiltInType(dataType.key);
}

function ArgumentList_encode(definition,arguments,stream) {

    assert(definition.length === arguments.length);

    assert(_.isArray(definition));
    assert(_.isArray(arguments));
    assert(definition.length === arguments.length);
    assert(definition.length >=0);

    // we only encode arguments by following the definition

    for(var i=0;i<definition.length;i++) {

        var def   = definition[i];
        var value = arguments[i];

        var encodeFunc = myfindBuiltInType(def.dataType).encode;

        // xx console.log(" cxxxxxxxxxxc ",def);
        // assert((def.valueRank == -1) || (def.valueRank === 0));

        // todo : handle -3 -2
        var isArray = (def.valueRank && ( def.valueRank === 1 || def.valueRank !== -1)) ? true : false;

        if (isArray) {
            ec.encodeArray(value,stream,encodeFunc);
        } else {
            encodeFunc(value,stream);
        }
    }

}
exports.ArgumentList_encode = ArgumentList_encode;

var ArgumentList_decode = function(definition,stream) {

    if (!_.isArray(definition)) {
        throw new Error(
            "This BaseDataType cannot be decoded because it has no definition.\n" +
            "Please construct a BaseDataType({definition : [{dataType: DataType.UInt32 }]});"
        )
    }

    var args = [];
    var value;

    for(var i=0;i<definition.length;i++) {

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

exports.ArgumentList_decode = ArgumentList_decode;

var BinaryStreamSizeCalculator = require("lib/misc/binaryStream").BinaryStreamSizeCalculator;
var ArgumentList_binaryStoreSize = function(description,arguments) {

    assert(_.isArray(description));
    assert(_.isArray(arguments));
    assert(arguments.length === description.length);

    var stream = new BinaryStreamSizeCalculator();
    ArgumentList_encode(description,arguments,stream);
    return stream.length;
};
exports.ArgumentList_binaryStoreSize = ArgumentList_binaryStoreSize;



function ArgumentList_getMethodDeclaration(address_space,objectId, methodId) {

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);
    // find object in address space
    var obj = address_space.findObject(objectId);
    if (!obj) {
        console.log("xxxx Cannot find ".red,objectId.toString().yellow );
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

    console.log("xxxxxxxxxxx methodDeclarationId".yellow.bold, methodDeclarationId.toString());
    var methodDeclaration = address_space.findObject(methodDeclarationId);
    if (!methodDeclaration) {
        console.log("xxxxxxxxxxx cannot find methodDeclarationId".red.bold, methodDeclarationId.toString());
        return {statusCode: StatusCodes.BadMethodInvalid};
    }
    return {statusCode: StatusCodes.Good , methodDeclaration: methodDeclaration };
}
exports.ArgumentList_getMethodDeclaration = ArgumentList_getMethodDeclaration;

function isArgumentValid(argDefinition,arg) {

    assert(arg instanceof Variant);
    assert(argDefinition instanceof Argument);

    assert(argDefinition.hasOwnProperty("dataType"));
    assert(argDefinition.hasOwnProperty("valueRank"));

    if(argDefinition.valueRank > 0) {
        // arg is
        return _.isArray(arg.value);
    }

    // check that datatype is the same
    if (argDefinition.dataType.value !=arg.dataType.value) {
        return false;
    }
    return true;
}


function ArgumentList_verifyArguments(methodInputArguments,inputArguments) {


    if (methodInputArguments.length > inputArguments.length) {
        console.log("xxxxxxxx ArgumentList_verifyArguments The client did  specify too many input arguments for the method.   expected : " +methodInputArguments.length + " actual = " + inputArguments.length );
        return { statusCode: StatusCodes.BadInvalidArgument};
    }

    if (methodInputArguments.length < inputArguments.length) {
        console.log("xxxxxxxx ArgumentList_verifyArguments The client did not specify all of the input arguments for the method.   expected : " +methodInputArguments.length + " actual = " + inputArguments.length );
        return { statusCode: StatusCodes.BadArgumentsMissing};
    }

    for(var i = 0;i<methodInputArguments.length;i++) {
        var argDefinition = methodInputArguments[i];
        var arg =inputArguments[i];

        console.log("xxxxxxxx ArgumentList_verifyArguments checking argument " + i + "  expected : " + JSON.stringify(argDefinition)+ " actual = " + JSON.stringify(arg));

        if (!isArgumentValid(argDefinition,arg)) {
            console.log("xxxxxxxx ArgumentList_verifyArguments The client did specify a argument with the wrong data type.   expected : " +argDefinition.dataType+ " actual = " + arg.dataType);
            return { statusCode: StatusCodes.BadTypeMismatch};
        }
    }
    return { statusCode: StatusCodes.Good};
}


exports.ArgumentList_verifyArguments = ArgumentList_verifyArguments;


function build_retrieveInputArgumentsDefinition(address_space) {
    var the_address_space = address_space;
    return function (objectId, methodId) {
        var response =  ArgumentList_getMethodDeclaration(the_address_space,objectId,methodId);
        if (response.statusCode !== StatusCodes.Good) {
            console.log(" StatusCode  = " + response.statusCode.toString());
            throw new Error("Invalid Method "+ response.statusCode.toString() + "ObjectId= "+ objectId.toString() + "Method Id =" + methodId.toString() );
        }
        var methodDeclaration = response.methodDeclaration;
        // verify input Parameters
        var methodInputArguments = methodDeclaration.getInputArguments();
        assert(_.isArray(methodInputArguments));
        return methodInputArguments;
    }
}
exports.build_retrieveInputArgumentsDefinition = build_retrieveInputArgumentsDefinition;

function convertJavaScriptToVariant(argumentDefinition, values) {

    assert(argumentDefinition.length === values.length);
    assert(_.isArray(argumentDefinition));
    assert(_.isArray(values));

    var v = _.zip(values,argumentDefinition).map(function(pair){

        var value   = pair[0];
        var argument= pair[1];
        var variant = _.extend({},argument);
        variant.value = value;
        return new Variant(variant);
    });
    return v;
}
exports.convertJavaScriptToVariant = convertJavaScriptToVariant;
