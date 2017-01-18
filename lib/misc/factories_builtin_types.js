/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

import _ from "underscore";
import assert from "better-assert";
import util from "util";
import {
  encode,
  encodeBoolean,
  encodeByteString,
  encodeDateTime,
  encodeDouble,
  encodeExpandedNodeId,
  encodeFloat,
  encodeGuid,
  encodeInt16,
  encodeInt32,
  encodeInt64,
  encodeInt8,
  encodeNodeId,
  encodeString,
  encodeUInt16,
  encodeUInt32,
  encodeUInt64,
  encodeUInt8,
  decode,
  decodeBoolean,
  decodeByteString,
  decodeDateTime,
  decodeDouble,
  decodeExpandedNodeId,
  decodeFloat,
  decodeGuid,
  decodeInt16,
  decodeInt32,
  decodeInt64,
  decodeInt8,
  decodeNodeId,
  decodeString,
  decodeUInt16,
  decodeUInt32,
  decodeUInt64,
  decodeUInt8,
  coerceBoolean,
  coerceDouble,
  coerceFloat,
  coerceGuid,
  coerceSByte,
  coerceByte,
  coerceInt16,
  coerceInt32,
  coerceInt64,
  coerceInt8,
  coerceString,
  coerceUInt16,
  coerceUInt32,
  coerceUInt64,
  coerceUInt8,
  makeNodeId,
  makeExpandedNodeId
} from "lib/misc/encode_decode";
import  StatusCodes, { StatusCode, decodeStatusCode, encodeStatusCode }  from "lib/datamodel/opcua_status_code";

import { coerceNodeId } from "lib/datamodel/nodeid";
import { coerceExpandedNodeId } from "lib/datamodel/expanded_nodeid";
import { emptyGuid } from "lib/datamodel/guid";

function coerceByteString(value) {
  if (_.isArray(value)) {
    return new Buffer(value);
  }
  if (typeof value === "string") {
    return new Buffer(value, "base64");
  }
  return value;
}

function coerceDateTime(value) {
  return new Date(value);
}


function coerceStatusCode(statusCode) {
  if (statusCode instanceof StatusCode) {
    return statusCode;
  }
  assert(statusCode.hasOwnProperty("name"));
  return StatusCodes[statusCode.name];
}
export var minDate = new Date(Date.UTC(1601, 0, 1, 0, 0));


// there are 4 types of DataTypes in opcua:
//   Built-In DataType
//   Simple DataType
//   Complex DataType
//   Enumeration


const defaultXmlElement = "";

// Built-In Type
const _defaultType = [

  // Built-in DataTypes ( see OPCUA Part III v1.02 - $5.8.2 )

  {
    name: "Null",
    encode() {
    },
    decode() {
      return null;
    },
    defaultValue: null
  },
  {
    name: "Any",
    encode() {
      assert(false, "type 'Any' cannot be encoded");
    },
    decode() {
      assert(false, "type 'Any' cannot be decoded");
    }
  },
  {
    name: "Boolean",
    encode: encodeBoolean,
    decode: decodeBoolean,
    defaultValue: false,
    coerce: coerceBoolean
  },
  { name: "Int8", encode: encodeInt8, decode: decodeInt8, defaultValue: 0, coerce: coerceInt8 },
  { name: "UInt8", encode: encodeUInt8, decode: decodeUInt8, defaultValue: 0, coerce: coerceUInt8 },
  { name: "SByte", encode: encodeInt8, decode: decodeInt8, defaultValue: 0, coerce: coerceSByte },
  { name: "Byte", encode: encodeUInt8, decode: decodeUInt8, defaultValue: 0, coerce: coerceByte },
  { name: "Int16", encode: encodeInt16, decode: decodeInt16, defaultValue: 0, coerce: coerceInt16 },
  { name: "UInt16", encode: encodeUInt16, decode: decodeUInt16, defaultValue: 0, coerce: coerceUInt16 },
  { name: "Int32", encode: encodeInt32, decode: decodeInt32, defaultValue: 0, coerce: coerceInt32 },
  { name: "UInt32", encode: encodeUInt32, decode: decodeUInt32, defaultValue: 0, coerce: coerceUInt32 },
  {
    name: "Int64",
    encode: encodeInt64,
    decode: decodeInt64,
    defaultValue: coerceInt64(0),
    coerce: coerceInt64
  },
  {
    name: "UInt64",
    encode: encodeUInt64,
    decode: decodeUInt64,
    defaultValue: coerceUInt64(0),
    coerce: coerceUInt64
  },
  { name: "Float", encode: encodeFloat, decode: decodeFloat, defaultValue: 0.0, coerce: coerceFloat },
  { name: "Double", encode: encodeDouble, decode: decodeDouble, defaultValue: 0.0, coerce: coerceFloat },
  { name: "String", encode: encodeString, decode: decodeString, defaultValue: "" },
  // OPC Unified Architecture, part 3.0 $8.26 page 67
  {
    name: "DateTime",
    encode: encodeDateTime,
    decode: decodeDateTime,
    defaultValue: exports.minDate,
    coerce: coerceDateTime
  },
  { name: "Guid", encode: encodeGuid, decode: decodeGuid, defaultValue: emptyGuid },

  {
    name: "ByteString",
    encode: encodeByteString,
    decode: decodeByteString,

    defaultValue() {
      return new Buffer(0);
    },

    coerce: coerceByteString,

    toJSON(value) {
      if (typeof value === "string") {
        return value;
      }
      assert(value instanceof Buffer);
      return value.toString("base64");
    }
  },
  { name: "XmlElement", encode: encodeString, decode: decodeString, defaultValue: defaultXmlElement },

  // see OPCUA Part 3 - V1.02 $8.2.1
  {
    name: "NodeId",
    encode: encodeNodeId,
    decode: decodeNodeId,
    defaultValue: makeNodeId,
    coerce: coerceNodeId
  },

  {
    name: "ExpandedNodeId",
    encode: encodeExpandedNodeId,
    decode: decodeExpandedNodeId,
    defaultValue: makeExpandedNodeId,
    coerce: coerceExpandedNodeId
  },

  // ----------------------------------------------------------------------------------------
  // Simple  DataTypes
  // ( see OPCUA Part III v1.02 - $5.8.2 )
  // Simple DataTypes are subtypes of the Built-in DataTypes. They are handled on the wire like the
  // Built-in   DataType, i.e. they cannot be distinguished on the wire from their  Built-in supertypes.
  // Since they are handled like  Built-in   DataTypes  regarding the encoding they cannot have encodings
  // defined  in the  AddressSpace.  Clients  can read the  DataType  Attribute  of a  Variable  or  VariableType  to
  // identify the  Simple  DataType  of the  Value  Attribute. An example of a  Simple  DataType  is  Duration. It
  // is handled on the wire as a  Double   but the Client can read the  DataType  Attribute  and thus interpret
  // the value as defined by  Duration
  //


  // OPC Unified Architecture, part 4.0 $7.13
  // IntegerID: This primitive data type is an UInt32 that is used as an identifier, such as a handle. All values,
  // except for 0, are valid.
  { name: "IntegerId", encode: encodeUInt32, decode: decodeUInt32, defaultValue: 0xFFFFFFFF },


  // The StatusCode is a 32-bit unsigned integer. The top 16 bits represent the numeric value of the
  // code that shall be used for detecting specific errors or conditions. The bottom 16 bits are bit flags
  // that contain additional information but do not affect the meaning of the StatusCode.
  // 7.33 Part 4 - P 143
  {
    name: "StatusCode",
    encode: encodeStatusCode,
    decode: decodeStatusCode,
    defaultValue: StatusCodes.Good,
    coerce: coerceStatusCode,
  }

];


/**
 * @class TypeSchema
 * @param options {Object}
 * @constructor
 * create a new type Schema
 */
class TypeSchema {
  constructor(options) {
    for (const prop in options) {
      if (options.hasOwnProperty(prop)) {
        this[prop] = options[prop];
      }
    }
  }

  /**
   * @method  computer_default_value
   * @param defaultValue {*} the default value
   * @return {*}
   */
  computer_default_value(defaultValue) {
    const _t = this;
    // defaultValue === undefined means use standard default value specified by type
    // defaultValue === null      means 'null' can be a default value
    if (defaultValue === undefined) {
      defaultValue = _t.defaultValue;
    }
    if (_.isFunction(defaultValue)) {
      // be careful not to cache this value , it must be call each time to make sure
      // we do not end up with the same value/instance twice.
      defaultValue = defaultValue();
    }
    // xx    if (defaultValue !== null && _t.coerce) {
    // xx        defaultValue = _t.coerce(defaultValue);
    // xx    }
    return defaultValue;
  }

  /**
   * @method initialize_value
   * @param value
   * @param defaultValue
   * @return {*}
   */
  initialize_value(value, defaultValue) {
    assert(this instanceof TypeSchema);
    const _t = this;

    if (value === undefined) {
      return defaultValue;
    }
    if (defaultValue === null) {
      if (value === null) {
        return null;
      }
    }

    if (value === undefined) {
      return defaultValue;
    }
    if (_t.coerce) {
      value = _t.coerce(value);
    }
    return value;
  }
}


/**
 * @method registerType
 * @param schema {TypeSchema}
 */
function registerType(schema) {
  assert(_.isFunction(schema.encode));
  assert(_.isFunction(schema.decode));

  assert(typeof schema.name === "string");

  schema.category = "basic";
  _defaultTypeMap[schema.name] = new TypeSchema(schema);
}
export { registerType };

export function unregisterType(typeName) {
  delete _defaultTypeMap[typeName];
}

/**
 * @method findSimpleType
 * @param name
 * @return {TypeSchema|null}
 */
export function findSimpleType(name) {
  assert(name in _defaultTypeMap);
  const typeschema = _defaultTypeMap[name];
  assert(typeschema instanceof TypeSchema);
  return typeschema;
}


// populate the default type map
let _defaultTypeMap = {};
_defaultType.forEach(registerType);
export { _defaultTypeMap };


/**
 * @method findBuiltInType
 * find the Builtin Type that this
 * @param datatypeName
 * @return {*}
 */
function findBuiltInType(datatypeName) {
  // coerce string or Qualified Name to string
  if (datatypeName.name) {
    datatypeName = datatypeName.toString();
  }
  assert(typeof datatypeName === 'string', `findBuiltInType : expecting a string ${datatypeName}`);
  const t = _defaultTypeMap[datatypeName];
  if (!t) {
    throw new Error(`datatype ${datatypeName} must be registered`);
  }
  if (t.subType) {
    return findBuiltInType(t.subType);
  }
  return t;
}
export { findBuiltInType };


export { TypeSchema };
