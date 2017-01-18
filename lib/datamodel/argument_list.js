
import { findBuiltInType } from "lib/misc/factories";
import ec from "lib/misc/encode_decode";
import {Variant} from "lib/datamodel/variant";
import {NodeId} from "lib/datamodel/nodeid";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import {VariantArrayType} from "lib/datamodel/variant";
import {UADataType} from "lib/address_space/ua_data_type";
import {UAMethod} from "lib/address_space/ua_method";
import _ from "underscore";
import assert from "better-assert";
import {Argument} from "_generated_/_auto_generated_Argument";
import { 
  make_debugLog,
  checkDebugFlag
} from "lib/misc/utils";
import {BinaryStreamSizeCalculator} from "lib/misc/binaryStream";




function myfindBuiltInType(dataType) {
  return findBuiltInType(dataType.key);
}

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


function encode_ArgumentList(definition, args, stream) {
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

        // xx console.log(" cxxxxxxxxxxc ",def);
        // assert((def.valueRank === -1) || (def.valueRank === 0));

        // todo : handle -3 -2
    const isArray = !!((def.valueRank && (def.valueRank === 1 || def.valueRank !== -1)));

    if (isArray) {
      ec.encodeArray(value, stream, encodeFunc);
    } else {
      encodeFunc(value, stream);
    }
  }
}

const decode_ArgumentList = (definition, stream) => {
  if (!_.isArray(definition)) {
    throw new Error(
            "This BaseDataType cannot be decoded because it has no definition.\n" +
            "Please construct a BaseDataType({definition : [{dataType: DataType.UInt32 }]});"
        );
  }

  const args = [];
  let value;

  for (let i = 0; i < definition.length; i++) {
    const def = definition[i];

    const decodeFunc = myfindBuiltInType(def.dataType).decode;

        // xx assert(def.valueRank == -1 || def.valueRank==0);
    const isArray = !!((def.valueRank === 1 || def.valueRank === -1));

    if (isArray) {
      value = ec.decodeArray(stream, decodeFunc);
    } else {
      value = decodeFunc(stream);
    }
    args.push(value);
  }
  return args;
};

const binaryStoreSize_ArgumentList = (description, args) => {
  assert(_.isArray(description));
  assert(_.isArray(args));
  assert(args.length === description.length);

  const stream = new BinaryStreamSizeCalculator();
  encode_ArgumentList(description, args, stream);
  return stream.length;
};


function getMethodDeclaration_ArgumentList(addressSpace, objectId, methodId) {
  assert(objectId instanceof NodeId);
  assert(methodId instanceof NodeId);
    // find object in address space
  const obj = addressSpace.findNode(objectId);
  if (!obj) {
        // istanbul ignore next
    if (doDebug) {
      console.warn("cannot find node ",objectId.toString());
    }
    return { statusCode: StatusCodes.BadNodeIdUnknown };
  }
  if (!obj.hasMethods) {
    return { statusCode: StatusCodes.BadNodeIdInvalid };
  }
  let objectMethod = obj.getMethodById(methodId);
  if (!objectMethod) {
        // the method doesn't belong to the object, nevertheless
        // the method can be called
    objectMethod = addressSpace.findNode(methodId);
    if (!objectMethod || !(objectMethod instanceof UAMethod)) {
      return { statusCode: StatusCodes.BadMethodInvalid };
    }
  }

  const methodDeclarationId = objectMethod.methodDeclarationId;

  const methodDeclaration = addressSpace.findNode(methodDeclarationId);
  if (!methodDeclaration) {
        //  return {statusCode: StatusCodes.BadMethodInvalid};
    return { statusCode: StatusCodes.Good, methodDeclaration: objectMethod };
  }
  return { statusCode: StatusCodes.Good, methodDeclaration };
}

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

  const argDefDataType = addressSpace.findDataType(argDefinition.dataType);
  const argDataType = addressSpace.findDataType(arg.dataType);

  if (!argDataType) {
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


  const isArray = (arg.arrayType === VariantArrayType.Array);

  if (argDefinition.valueRank > 0) {
    return isArray;
  } else if (argDefinition.valueRank === -1) { // SCALAR
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
  const inputArgumentResults = [];

  if (methodInputArguments.length > inputArguments.length) {
        // istanbul ignore next
    if (doDebug) {
      console.log(`xxxxxxxx verifyArguments_ArgumentList \n       The client did  specify too many input arguments for the method.  \n        expected : ${methodInputArguments.length}\n        actual   : ${inputArguments.length}`);
    }
    return { statusCode: StatusCodes.BadInvalidArgument };
  }

  if (methodInputArguments.length < inputArguments.length) {
        // istanbul ignore next
    if (doDebug) {
      console.log(`xxxxxxxx verifyArguments_ArgumentList \n        The client did not specify all of the input arguments for the method. \n        expected : ${methodInputArguments.length}\n        actual   : ${inputArguments.length}`);
    }
    return { statusCode: StatusCodes.BadArgumentsMissing };
  }

  let errorCount = 0;
  for (let i = 0; i < methodInputArguments.length; i++) {
    const argDefinition = methodInputArguments[i];

    const arg = inputArguments[i];

        // istanbul ignore next
    if (doDebug) {
      console.log(`xxxxxxxx verifyArguments_ArgumentList checking argument ${i}\n        expected : ${JSON.stringify(argDefinition)}\n        actual:    ${JSON.stringify(arg)}`);
    }
    if (!isArgumentValid(addressSpace,argDefinition, arg)) {
            // istanbul ignore next
      if (doDebug) {
        console.log(`xxxxxxxx verifyArguments_ArgumentList \n         The client did specify a argument with the wrong data type.\n${"          expected : ".white}${argDefinition.dataType}\n${"          actual   :".cyan}${arg.dataType}`);
      }
      inputArgumentResults.push(StatusCodes.BadTypeMismatch);
      errorCount += 1;
    } else {
      inputArgumentResults.push(StatusCodes.Good);
    }
  }
  assert(inputArgumentResults.length === methodInputArguments.length);

  const ret = {
    statusCode: errorCount === 0 ? StatusCodes.Good : StatusCodes.BadInvalidArgument,
    inputArgumentResults
  };

  return ret;
}




function build_retrieveInputArgumentsDefinition(addressSpace) {
  const the_address_space = addressSpace;
  return (objectId, methodId) => {
    const response = getMethodDeclaration_ArgumentList(the_address_space, objectId, methodId);

        /* istanbul ignore next */
    if (response.statusCode !== StatusCodes.Good) {
      console.log(` StatusCode  = ${response.statusCode.toString()}`);
      throw new Error(`Invalid Method ${response.statusCode.toString()}ObjectId= ${objectId.toString()}Method Id =${methodId.toString()}`);
    }
    const methodDeclaration = response.methodDeclaration;
        // verify input Parameters
    const methodInputArguments = methodDeclaration.getInputArguments();
    assert(_.isArray(methodInputArguments));
    return methodInputArguments;
  };
}

function convertJavaScriptToVariant(argumentDefinition, values) {
  assert(argumentDefinition.length === values.length);
  assert(_.isArray(argumentDefinition));
  assert(_.isArray(values));

  return _.zip(values, argumentDefinition).map((pair) => {
    const value = pair[0];
    const arg = pair[1];
    const variant = _.extend({}, arg);
    variant.value = value;
    return new Variant(variant);
  });
}
export {
  convertJavaScriptToVariant,
  Argument,
  build_retrieveInputArgumentsDefinition,
  encode_ArgumentList,
  decode_ArgumentList,
  binaryStoreSize_ArgumentList,
  getMethodDeclaration_ArgumentList,
  verifyArguments_ArgumentList
};
