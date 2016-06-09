"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var _ = require("underscore");
var assert = require("better-assert");
var util = require("util");


var ec = require("lib/misc/encode_decode");
var sc = require("lib/datamodel/opcua_status_code");

var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
var coerceExpandedNodeId = require("lib/datamodel/expanded_nodeid").coerceExpandedNodeId;
var emptyGuid = require("lib/datamodel/guid").emptyGuid;

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

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var StatusCode = require("lib/datamodel/opcua_status_code").StatusCode;

function coerceStatusCode(statusCode) {
    if (statusCode instanceof StatusCode) {
        return statusCode;
    }
    assert(statusCode.hasOwnProperty("name"));
    return StatusCodes[statusCode.name];
}
exports.minDate = new Date(Date.UTC(1601, 0, 1, 0, 0));


//there are 4 types of DataTypes in opcua:
//   Built-In DataType
//   Simple DataType
//   Complex DataType
//   Enumeration


var defaultXmlElement = "";

// Built-In Type
var _defaultType = [

    // Built-in DataTypes ( see OPCUA Part III v1.02 - $5.8.2 )

    {
        name: "Null", encode: function () {
    }, decode: function () {
        return null;
    }, defaultValue: null
    },
    {
        name: "Any",
        encode: function () {
            assert(false, "type 'Any' cannot be encoded");
        },
        decode: function () {
            assert(false, "type 'Any' cannot be decoded");
        }
    },
    {
        name: "Boolean",
        encode: ec.encodeBoolean,
        decode: ec.decodeBoolean,
        defaultValue: false,
        coerce: ec.coerceBoolean
    },
    {name: "Int8", encode: ec.encodeInt8, decode: ec.decodeInt8, defaultValue: 0, coerce: ec.coerceInt8},
    {name: "UInt8", encode: ec.encodeUInt8, decode: ec.decodeUInt8, defaultValue: 0, coerce: ec.coerceUInt8},
    {name: "SByte", encode: ec.encodeInt8, decode: ec.decodeInt8, defaultValue: 0, coerce: ec.coerceSByte},
    {name: "Byte", encode: ec.encodeUInt8, decode: ec.decodeUInt8, defaultValue: 0, coerce: ec.coerceByte},
    {name: "Int16", encode: ec.encodeInt16, decode: ec.decodeInt16, defaultValue: 0, coerce: ec.coerceInt16},
    {name: "UInt16", encode: ec.encodeUInt16, decode: ec.decodeUInt16, defaultValue: 0, coerce: ec.coerceUInt16},
    {name: "Int32", encode: ec.encodeInt32, decode: ec.decodeInt32, defaultValue: 0, coerce: ec.coerceInt32},
    {name: "UInt32", encode: ec.encodeUInt32, decode: ec.decodeUInt32, defaultValue: 0, coerce: ec.coerceUInt32},
    {
        name: "Int64",
        encode: ec.encodeInt64,
        decode: ec.decodeInt64,
        defaultValue: ec.coerceInt64(0),
        coerce: ec.coerceInt64
    },
    {
        name: "UInt64",
        encode: ec.encodeUInt64,
        decode: ec.decodeUInt64,
        defaultValue: ec.coerceUInt64(0),
        coerce: ec.coerceUInt64
    },
    {name: "Float", encode: ec.encodeFloat, decode: ec.decodeFloat, defaultValue: 0.0, coerce: ec.coerceFloat},
    {name: "Double", encode: ec.encodeDouble, decode: ec.decodeDouble, defaultValue: 0.0, coerce: ec.coerceFloat},
    {name: "String", encode: ec.encodeString, decode: ec.decodeString, defaultValue: ""},
    // OPC Unified Architecture, part 3.0 $8.26 page 67
    {
        name: "DateTime",
        encode: ec.encodeDateTime,
        decode: ec.decodeDateTime,
        defaultValue: exports.minDate,
        coerce: coerceDateTime
    },
    {name: "Guid", encode: ec.encodeGuid, decode: ec.decodeGuid, defaultValue: emptyGuid},

    {
        name: "ByteString", encode: ec.encodeByteString, decode: ec.decodeByteString,

        defaultValue: function () {
            return new Buffer(0);
        },

        coerce: coerceByteString,

        toJSON: function (value) {
            if (typeof value === "string") {
                return value;
            }
            assert(value instanceof Buffer);
            return value.toString("base64");
        }
    },
    {name: "XmlElement", encode: ec.encodeString, decode: ec.decodeString, defaultValue: defaultXmlElement},

    // see OPCUA Part 3 - V1.02 $8.2.1
    {
        name: "NodeId",
        encode: ec.encodeNodeId, decode: ec.decodeNodeId,
        defaultValue: ec.makeNodeId,
        coerce: coerceNodeId
    },

    {
        name: "ExpandedNodeId",
        encode: ec.encodeExpandedNodeId, decode: ec.decodeExpandedNodeId,
        defaultValue: ec.makeExpandedNodeId,
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
    {name: "IntegerId", encode: ec.encodeUInt32, decode: ec.decodeUInt32, defaultValue: 0xFFFFFFFF},


    //The StatusCode is a 32-bit unsigned integer. The top 16 bits represent the numeric value of the
    //code that shall be used for detecting specific errors or conditions. The bottom 16 bits are bit flags
    //that contain additional information but do not affect the meaning of the StatusCode.
    // 7.33 Part 4 - P 143
    {
        name: "StatusCode",
        encode: sc.encodeStatusCode,
        decode: sc.decodeStatusCode,
        defaultValue: sc.StatusCodes.Good,
        coerce: coerceStatusCode,
    }

];


/**
 * @class TypeSchema
 * @param options {Object}
 * @constructor
 * create a new type Schema
 */
function TypeSchema(options) {

    for (var prop in options) {
        if (options.hasOwnProperty(prop)) {
            this[prop] = options[prop];
        }
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
exports.registerType = registerType;

exports.unregisterType = function (typeName) {

    delete _defaultTypeMap[typeName];
};


/**
 * @method findSimpleType
 * @param name
 * @return {TypeSchema|null}
 */
exports.findSimpleType = function findSimpleType(name) {
    assert(name in _defaultTypeMap);
    var typeschema = _defaultTypeMap[name];
    assert(typeschema instanceof TypeSchema);
    return typeschema;
};


// populate the default type map
var _defaultTypeMap = {};
_defaultType.forEach(registerType);
exports._defaultTypeMap = _defaultTypeMap;


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
    assert(typeof datatypeName === 'string', "findBuiltInType : expecting a string " + datatypeName);
    var t = _defaultTypeMap[datatypeName];
    if (!t) {
        throw new Error("datatype " + datatypeName + " must be registered");
    }
    if (t.subType) {
        return findBuiltInType(t.subType);
    }
    return t;
}
exports.findBuiltInType = findBuiltInType;


/**
 * @method  computer_default_value
 * @param defaultValue {*} the default value
 * @return {*}
 */
TypeSchema.prototype.computer_default_value = function (defaultValue) {

    var _t = this;
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
//xx    if (defaultValue !== null && _t.coerce) {
//xx        defaultValue = _t.coerce(defaultValue);
//xx    }
    return defaultValue;
};

/**
 * @method initialize_value
 * @param value
 * @param defaultValue
 * @return {*}
 */
TypeSchema.prototype.initialize_value = function (value, defaultValue) {

    assert(this instanceof TypeSchema);
    var _t = this;

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

};

exports.TypeSchema = TypeSchema;
