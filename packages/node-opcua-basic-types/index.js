"use strict";
var boolean = require("./src/boolean");
var integers = require("./src/integers");
var floats = require("./src/floats");
var string = require("./src/string");
var date_time = require("./src/date_time");
var byte_string = require("./src/byte_string");
var node_id = require("./src/nodeid");
var status_code= require("./src/status_code");
var guid = require("./src/guid");

module.exports = {

    // ----------------------------------------------
    encodeBoolean:boolean.encodeBoolean,
    decodeBoolean:boolean.decodeBoolean,
    coerceBoolean:boolean.coerceBoolean,

    encodeInt8:integers.encodeInt8,
    decodeInt8:integers.decodeInt8,
    coerceInt8:integers.coerceInt8,

    encodeInt16:integers.encodeInt16,
    decodeInt16:integers.decodeInt16,
    coerceInt16:integers.coerceInt16,

    encodeInt32:integers.encodeInt32,
    decodeInt32:integers.decodeInt32,
    coerceInt32:integers.coerceInt32,

    encodeInt64:integers.encodeInt64,
    decodeInt64:integers.decodeInt64,
    coerceInt64:integers.coerceInt64,

    //-------------------------
    encodeUInt8:integers.encodeUInt8,
    decodeUInt8:integers.decodeUInt8,
    coerceUInt8:integers.coerceUInt8,


    encodeByte:integers.encodeByte,
    decodeByte:integers.decodeByte,
    coerceByte:integers.coerceByte,

    encodeSByte:integers.encodeSByte,
    decodeSByte:integers.decodeSByte,
    coerceSByte:integers.coerceSByte,

    encodeUInt16:integers.encodeUInt16,
    decodeUInt16:integers.decodeUInt16,
    coerceUInt16:integers.coerceUInt16,

    encodeUInt32:integers.encodeUInt32,
    decodeUInt32:integers.decodeUInt32,
    coerceUInt32:integers.coerceUInt32,

    encodeUInt64:integers.encodeUInt64,
    decodeUInt64:integers.decodeUInt64,
    coerceUInt64:integers.coerceUInt64,
    //-------------------------
    encodeFloat:floats.encodeFloat,
    decodeFloat:floats.decodeFloat,
    coerceFloat:floats.coerceFloat,
    //-------------------------
    encodeDouble:floats.encodeDouble,
    decodeDouble:floats.decodeDouble,
    coerceDouble:floats.coerceDouble,

    //-------------------------
    encodeString:string.encodeString,
    decodeString:string.decodeString,
    //xx unused coerceString:string.coerceString,

    //-------------------------
    encodeByteString:byte_string.encodeByteString,
    decodeByteString:byte_string.decodeByteString,
    coerceByteString:byte_string.coerceByteString,

    encodeDateTime: date_time.encodeDateTime,
    decodeDateTime: date_time.decodeDateTime,
    coerceDateTime: date_time.coerceDateTime,

    encodeNodeId: node_id.encodeNodeId,
    decodeNodeId: node_id.decodeNodeId,
    coerceNodeId: node_id.coerceNodeId,

    encodeExpandedNodeId:node_id.encodeExpandedNodeId,
    decodeExpandedNodeId:node_id.decodeExpandedNodeId,
    coerceExpandedNodeId:node_id.coerceExpandedNodeId,

    encodeStatusCode: status_code.encodeStatusCode,
    decodeStatusCode: status_code.decodeStatusCode,
    coerceStatusCode: status_code.coerceStatusCode,

    encodeGuid: guid.encodeGuid,
    decodeGuid: guid.decodeGuid,
    emptyGuid: guid.emptyGuid,
    //xx coerceGuid: guid.coerceGuid,


    randomByte: integers.randomByte,
    randomSByte: integers.randomSByte,
    randomInt8: integers.randomInt8,
    randomUInt8: integers.randomUInt8,
    randomInt16: integers.randomInt16,
    randomUInt16: integers.randomUInt16,
    randomInt32: integers.randomInt32,
    randomUInt32: integers.randomUInt32,
    randomInt64: integers.randomInt64,
    randomUInt64: integers.randomUInt64,

    randomFloat: floats.randomFloat,
    randomDouble: floats.randomDouble,

    randomDateTime: date_time.randomDateTime,
    randomUtcTime: date_time.randomDateTime,
    randomString: string.randomString,
    randomBoolean: boolean.randomBoolean,
    randomGuid: guid.randomGuid,
    randomNodeId: node_id.randomNodeId,
    randomExpandedNodeId: node_id.randomNodeId,
    randomByteString: byte_string.randomByteString,

    isValidFloat: floats.isValidFloat,
    isValidDouble: floats.isValidDouble,
    isValidDateTime: date_time.isValidDateTime,
    isValidString: string.isValidString,
    isValidBoolean: boolean.isValidBoolean,
    isValidGuid: guid.isValidGuid,
    isValidNodeId: node_id.isValidNodeId,
    isValidByteString: byte_string.isValidByteString,

    isValidUInt64: integers.isValidUInt64,
    isValidUInt32: integers.isValidUInt32,
    isValidUInt16: integers.isValidUInt16,
    isValidUInt8: integers.isValidUInt8,
    isValidInt64: integers.isValidInt64,
    isValidInt32: integers.isValidInt32,
    isValidInt16: integers.isValidInt16,
    isValidInt8: integers.isValidInt8,
    isValidByte: integers.isValidByte,
    isValidSByte: integers.isValidSByte,

    encodeArray: require("./src/array").encodeArray,
    decodeArray: require("./src/array").decodeArray,

    encodeLocaleId: require("./src/localeid").encodeLocaleId,
    decodeLocaleId: require("./src/localeid").decodeLocaleId,
    validateLocaleId:  require("./src/localeid").validateLocaleId,
};

Object.keys(module.exports).map(function(x) { if (!module.exports[x]){ throw new Error("Invalid method : " + x); } });