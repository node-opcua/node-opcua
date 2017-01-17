/**
 * @module opcua.miscellaneous
 * @class EncodeDecode
 * @static
 */
require("requirish")._(module);

const assert = require("better-assert");
const Enum = require("lib/misc/enum");

const ec = exports;
const _ = require("underscore");

const isValidGuid = require("lib/datamodel/guid").isValidGuid;
const emptyGuid = require("lib/datamodel/guid").emptyGuid;

const NodeIdType = exports.NodeIdType = require("lib/datamodel/nodeid").NodeIdType;

const makeNodeId = exports.makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
exports.makeExpandedNodeId = require("lib/datamodel/expanded_nodeid").makeExpandedNodeId;
const ExpandedNodeId = require("lib/datamodel/expanded_nodeid").ExpandedNodeId;

const set_flag = require("lib/misc/utils").set_flag;
const check_flag = require("lib/misc/utils").check_flag;

const buffer_utils = require("lib/misc/buffer_utils");
const createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

/**
 * return a random integer value in the range of  min inclusive and  max exclusive
 * @method getRandomInt
 * @param min
 * @param max
 * @return {*}
 * @private
 */
function getRandomInt(min, max) {
    // note : Math.random() returns a random number between 0 (inclusive) and 1 (exclusive):
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * return a random float value in the range of  min inclusive and  max exclusive
 * @method getRandomInt
 * @param min
 * @param max
 * @return {*}
 * @private
 */
function getRandomDouble(min, max) {
  return Math.random() * (max - min) + min;
}

exports.isValidString = value => typeof value === "string";
exports.randomString = () => {
  const nbCar = getRandomInt(1, 20);
  const cars = [];
  for (let i = 0; i < nbCar; i++) {
    cars.push(String.fromCharCode(65 + getRandomInt(0, 26)));
  }
  return cars.join("");
};

exports.decodeString = stream => stream.readString();
exports.encodeString = (value, stream) => {
  stream.writeString(value);
};

exports.isValidUInt16 = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return value >= 0 && value <= 0xFFFF;
};
exports.randomUInt16 = () => getRandomInt(0, 0xFFFF);
exports.encodeUInt16 = (value, stream) => {
  stream.writeUInt16(value);
};
exports.decodeUInt16 = stream => stream.readUInt16();

exports.isValidInt16 = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return value >= -0x8000 && value <= 0x7FFF;
};
exports.randomInt16 = () => getRandomInt(-0x8000, 0x7FFF);
exports.encodeInt16 = (value, stream) => {
  assert(_.isFinite(value));
  stream.writeInt16(value);
};
exports.decodeInt16 = stream => stream.readInt16();

exports.isValidInt32 = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return value >= -0x80000000 && value <= 0x7fffffff;
};
exports.randomInt32 = () => getRandomInt(-0x80000000, 0x7fffffff);
exports.encodeInt32 = (value, stream) => {
  assert(_.isFinite(value));
  stream.writeInteger(value);
};
exports.decodeInt32 = stream => stream.readInteger();

exports.isValidUInt32 = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return value >= 0 && value <= 0xFFFFFFFF;
};
exports.randomUInt32 = () => getRandomInt(0, 0xFFFFFFFF);
exports.encodeUInt32 = (value, stream) => {
  stream.writeUInt32(value);
};
exports.decodeUInt32 = stream => stream.readUInt32();

const isValidBoolean = exports.isValidBoolean = value => typeof value === "boolean";

exports.randomBoolean = () => Math.random() > 0.5;

exports.encodeBoolean = (value, stream) => {
  assert(isValidBoolean(value));
  stream.writeUInt8(value ? 1 : 0);
};
exports.decodeBoolean = stream => !!stream.readUInt8();

function isValidInt8(value) {
  if (!_.isFinite(value)) {
    return false;
  }
  return value >= -0x80 && value <= 0x7F;
}
exports.isValidInt8 = isValidInt8;

exports.randomInt8 = () => getRandomInt(-0x7F, 0x7E);
exports.encodeInt8 = (value, stream) => {
  assert(isValidInt8(value));
  stream.writeInt8(value);
};
exports.decodeInt8 = stream => stream.readInt8();


exports.isValidSByte = exports.isValidInt8;
exports.randomSByte = exports.randomInt8;
exports.encodeSByte = exports.encodeInt8;
exports.decodeSByte = exports.decodeInt8;


exports.isValidUInt8 = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return value >= -0x00 && value <= 0xFF;
};
exports.randomUInt8 = () => getRandomInt(0x00, 0xFF);
exports.encodeUInt8 = (value, stream) => {
  stream.writeUInt8(value);
};
exports.decodeUInt8 = stream => stream.readUInt8();

exports.isValidByte = exports.isValidUInt8;
exports.randomByte = exports.randomUInt8;
exports.encodeByte = exports.encodeUInt8;
exports.decodeByte = exports.decodeUInt8;

const minFloat = -3.40 * (10 ** 38);
const maxFloat = 3.40 * (10 ** 38);

exports.isValidFloat = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return value > minFloat && value < maxFloat;
};

function roundToFloat2(float) {
  if (float === 0) {
    return float;
  }
    // this method artificially rounds a float to 7 significant digit in base 10
    // Note:
    //   this is to overcome the that that Javascript doesn't  provide  single precision float values (32 bits)
    //   but only double precision float values

    // wikipedia:(http://en.wikipedia.org/wiki/Floating_point)
    //
    // * Single precision, usually used to represent the "float" type in the C language family
    //   (though this is not guaranteed). This is a binary format that occupies 32 bits (4 bytes) and its
    //   significand has a precision of 24 bits (about 7 decimal digits).
    // * Double precision, usually used to represent the "double" type in the C language family
    //   (though this is not guaranteed). This is a binary format that occupies 64 bits (8 bytes) and its
    //   significand has a precision of 53 bits (about 16 decimal digits).
    //
  const nbDigits = Math.ceil(Math.log(Math.abs(float)) / Math.log(10));
  const r = 10 ** (-nbDigits + 2);
  return Math.round(float * r) / r;
}

const r = new Float32Array(1);
function roundToFloat(float) {
  r[0] = float;
  const float_r = r[0];
  return float_r;
}

exports.randomFloat = () => roundToFloat(getRandomDouble(-1000, 1000));

exports.encodeFloat = (value, stream) => {
  stream.writeFloat(value);
};

exports.decodeFloat = (stream) => {
  const float = stream.readFloat();
  return float;
    // xx return roundToFloat(float);
};

exports.isValidDouble = (value) => {
  if (!_.isFinite(value)) {
    return false;
  }
  return true;
};

exports.randomDouble = () => getRandomDouble(-1000000, 1000000);

exports.encodeDouble = (value, stream) => {
  stream.writeDouble(value);
};

exports.decodeDouble = stream => stream.readDouble();

const date_time = require("lib/misc/date_time");
const bn_dateToHundredNanoSecondFrom1601 = date_time.bn_dateToHundredNanoSecondFrom1601;
const bn_hundredNanoSecondFrom1601ToDate = date_time.bn_hundredNanoSecondFrom1601ToDate;

//  Date(year, month [, day, hours, minutes, seconds, ms])
exports.isValidDateTime = value => value instanceof Date;
exports.randomDateTime = () => {
  const r = getRandomInt;
  return new Date(
        1900 + r(0, 200), r(0, 11), r(0, 28),
        r(0, 24), r(0, 59), r(0, 59), r(0, 1000));
};
exports.encodeDateTime = (date, stream) => {
  if (!date) {
    stream.writeUInt32(0);
    stream.writeUInt32(0);
    return;
  }
  if (!(date instanceof Date)) {
    throw new Error(`Expecting a Date : but got a ${typeof (date)} ${date.toString()}`);
  }
  assert(date instanceof Date);
  const hl = bn_dateToHundredNanoSecondFrom1601(date);
  const hi = hl[0];
  const lo = hl[1];
  stream.writeUInt32(lo);
  stream.writeUInt32(hi);
    // xx assert(date.toString() === bn_hundredNanoSecondFrom1601ToDate(hi, lo).toString());
};

exports.decodeDateTime = (stream) => {
  const lo = stream.readUInt32();
  const hi = stream.readUInt32();
  return bn_hundredNanoSecondFrom1601ToDate(hi, lo);
};


exports.emptyGuid = emptyGuid;
exports.isValidGuid = isValidGuid;
exports.randomGuid = () => {
  const BinaryStream = require("lib/misc/binaryStream").BinaryStream;

  const b = new BinaryStream(20);
  for (let i = 0; i < 20; i++) {
    b.writeUInt8(getRandomInt(0, 255));
  }
  b.rewind();
  const value = exports.decodeGuid(b);
  return value;
};
exports.encodeGuid = (guid, stream) => {
  if (!isValidGuid(guid)) {
    throw new Error(` Invalid GUID ${JSON.stringify(guid)}`);
  }
    //           1         2         3
    // 012345678901234567890123456789012345
    // |        |    |    | |  | | | | | |
    // 12345678-1234-1234-ABCD-0123456789AB
    // 00000000-0000-0000-0000-000000000000";
  function write_UInt32(starts) {
    let start;
    let i;
    const n = starts.length;
    for (i = 0; i < n; i++) {
      start = starts[i];
      stream.writeUInt32(parseInt(guid.substr(start, 8), 16));
    }
  }

  function write_UInt16(starts) {
    let start;
    let i;
    const n = starts.length;
    for (i = 0; i < n; i++) {
      start = starts[i];
      stream.writeUInt16(parseInt(guid.substr(start, 4), 16));
    }
  }

  function write_UInt8(starts) {
    let start;
    let i;
    const n = starts.length;
    for (i = 0; i < n; i++) {
      start = starts[i];
      stream.writeUInt8(parseInt(guid.substr(start, 2), 16));
    }
  }

  write_UInt32([0]);
  write_UInt16([9, 14]);
  write_UInt8([19, 21, 24, 26, 28, 30, 32, 34]);
};

const toHex = require("lib/misc/utils").toHex;

exports.decodeGuid = (stream) => {
  function read_UInt32() {
    return toHex(stream.readUInt32(), 8);
  }

  function read_UInt16() {
    return toHex(stream.readUInt16(), 4);
  }

  function read_UInt8() {
    return toHex(stream.readUInt8(), 2);
  }

  function read_many(func, nb) {
    let result = "";
    for (let i = 0; i < nb; i++) {
      result += func();
    }
    return result;
  }

  const data1 = read_UInt32();

  const data2 = read_UInt16();

  const data3 = read_UInt16();

  const data4_5 = read_many(read_UInt8, 2);

  const data6_B = read_many(read_UInt8, 6);

  const guid = `${data1}-${data2}-${data3}-${data4_5}-${data6_B}`;

  return guid.toUpperCase();
};


const EnumNodeIdEncoding = new Enum({
  TwoBytes: 0x00, // A numeric value that fits into the two byte representation.
  FourBytes: 0x01, // A numeric value that fits into the four byte representation.
  Numeric: 0x02, // A numeric value that does not fit into the two or four byte representations.
  String: 0x03, // A String value.
  Guid: 0x04, // A Guid value.
  ByteString: 0x05, // An opaque (ByteString) value.
  NamespaceUriFlag: 0x80, //  NamespaceUriFlag on  ExpandedNodeId is present
  ServerIndexFlag: 0x40  //  NamespaceUriFlag on  ExpandedNodeId is present
});


function is_uint8(value) {
  return value >= 0 && value <= 0xFF;
}
function is_uint16(value) {
  return value >= 0 && value <= 0xFFFF;
}

function nodeID_encodingByte(nodeId) {
  if (!nodeId) {
    return 0;
  }
  assert(nodeId.hasOwnProperty("identifierType"));

  let encodingByte = 0;

  if (nodeId.identifierType.is(NodeIdType.NUMERIC)) {
    if (is_uint8(nodeId.value) && (!nodeId.namespace) && !nodeId.namespaceUri && !nodeId.serverIndex) {
      encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.TwoBytes);
    } else if (is_uint16(nodeId.value) && is_uint8(nodeId.namespace) && !nodeId.namespaceUri && !nodeId.serverIndex) {
      encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.FourBytes);
    } else {
      encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.Numeric);
    }
  } else if (nodeId.identifierType.is(NodeIdType.STRING)) {
    encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.String);
  } else if (nodeId.identifierType.is(NodeIdType.BYTESTRING)) {
    encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.ByteString);
  } else if (nodeId.identifierType.is(NodeIdType.GUID)) {
    encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.Guid);
  }

  if (nodeId.hasOwnProperty("namespaceUri") && nodeId.namespaceUri) {
    encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.NamespaceUriFlag);
  }
  if (nodeId.hasOwnProperty("serverIndex") && nodeId.serverIndex) {
    encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.ServerIndexFlag);
  }
  return encodingByte;
}


exports.isValidNodeId = (nodeId) => {
  if (nodeId === null || nodeId === void 0) {
    return false;
  }
  return nodeId.hasOwnProperty("identifierType")
        ;
};
exports.randomNodeId = () => {
  const value = getRandomInt(0, 0xFFFFF);
  const namespace = getRandomInt(0, 3);
  return makeNodeId(value, namespace);
};


function _encodeNodeId(encoding_byte, nodeId, stream) {
  stream.writeUInt8(encoding_byte);// encoding byte

    /* jslint bitwise: true */
  encoding_byte &= 0x3F;

  switch (encoding_byte) {
    case EnumNodeIdEncoding.TwoBytes.value:
      stream.writeUInt8(nodeId.value);
      break;
    case EnumNodeIdEncoding.FourBytes.value:
      stream.writeUInt8(nodeId.namespace);
      stream.writeUInt16(nodeId.value);
      break;
    case EnumNodeIdEncoding.Numeric.value:
      stream.writeUInt16(nodeId.namespace);
      stream.writeUInt32(nodeId.value);
      break;
    case EnumNodeIdEncoding.String.value:
      stream.writeUInt16(nodeId.namespace);
      ec.encodeString(nodeId.value, stream);
      break;
    case EnumNodeIdEncoding.ByteString.value:
      stream.writeUInt16(nodeId.namespace);
      ec.encodeByteString(nodeId.value, stream);
      break;
    default:
      assert(encoding_byte === EnumNodeIdEncoding.Guid.value);
      stream.writeUInt16(nodeId.namespace);
      ec.encodeGuid(nodeId.value, stream);
      break;
  }
}

exports.encodeNodeId = (nodeId, stream) => {
  let encoding_byte = nodeID_encodingByte(nodeId);
    /* jslint bitwise: true */
  encoding_byte &= 0x3F;
  _encodeNodeId(encoding_byte, nodeId, stream);
};

exports.encodeExpandedNodeId = (expandedNodeId, stream) => {
  const encodingByte = nodeID_encodingByte(expandedNodeId);
  _encodeNodeId(encodingByte, expandedNodeId, stream);
  if (check_flag(encodingByte, EnumNodeIdEncoding.NamespaceUriFlag)) {
    exports.encodeString(expandedNodeId.namespaceUri, stream);
  }
  if (check_flag(encodingByte, EnumNodeIdEncoding.ServerIndexFlag)) {
    exports.encodeUInt32(expandedNodeId.serverIndex, stream);
  }
};

const _decodeNodeId = (encoding_byte, stream) => {
  let value;
  let namespace;
    /* jslint bitwise: true */
  encoding_byte &= 0x3F;
  switch (encoding_byte) {
    case EnumNodeIdEncoding.TwoBytes.value:
      value = stream.readUInt8();
      break;
    case EnumNodeIdEncoding.FourBytes.value:
      namespace = stream.readUInt8();
      value = stream.readUInt16();
      break;
    case EnumNodeIdEncoding.Numeric.value:
      namespace = stream.readUInt16();
      value = stream.readUInt32(stream);
      break;
    case EnumNodeIdEncoding.String.value:
      namespace = stream.readUInt16();
      value = ec.decodeString(stream);
      break;
    case EnumNodeIdEncoding.ByteString.value:
      namespace = stream.readUInt16();
      value = ec.decodeByteString(stream);
      break;
    default:
      if (encoding_byte !== EnumNodeIdEncoding.Guid.value) {
                /* jslint bitwise: true */
        console.log(` encoding_byte = ${encoding_byte.toString(16)}`, encoding_byte, encoding_byte & 0x3F);
                // xx var exit = require("exit");
                // xx exit(1);
        throw new Error(` encoding_byte = ${encoding_byte.toString(16)}`);
      }
      namespace = stream.readUInt16();
      value = ec.decodeGuid(stream);
      assert(isValidGuid(value));
      break;
  }
  return makeNodeId(value, namespace);
};
exports.decodeNodeId = (stream) => {
  const encoding_byte = stream.readUInt8();
  return _decodeNodeId(encoding_byte, stream);
};


exports.decodeExpandedNodeId = (stream) => {
  const encoding_byte = stream.readUInt8();
  const expandedNodeId = _decodeNodeId(encoding_byte, stream);
  expandedNodeId.namespaceUri = null;
  expandedNodeId.serverIndex = 0;

  if (check_flag(encoding_byte, EnumNodeIdEncoding.NamespaceUriFlag)) {
    expandedNodeId.namespaceUri = ec.decodeString(stream);
  }
  if (check_flag(encoding_byte, EnumNodeIdEncoding.ServerIndexFlag)) {
    expandedNodeId.serverIndex = ec.decodeUInt32(stream);
  }
  const e = expandedNodeId;
  return new ExpandedNodeId(e.identifierType, e.value,e.namespace, e.namespaceUri, e.serverIndex);
};
exports.encodeLocaleId = ec.encodeString;
exports.decodeLocaleId = ec.decodeString;

exports.validateLocaleId = () => // TODO : check that localeID is well-formed
// see part 3 $8.4 page 63

true;

exports.isValidByteString = value => value === null || value instanceof Buffer;
exports.randomByteString = (value, len) => {
  len = len || getRandomInt(1, 200);
  const b = createFastUninitializedBuffer(len);
  for (let i = 0; i < len; i++) {
    b.writeUInt8(getRandomInt(0, 255), i);
  }
  return b;
};
exports.encodeByteString = (byteString, stream) => {
  stream.writeByteStream(byteString);
};
exports.decodeByteString = stream => stream.readByteStream();

exports.decodeStatusCode = require("lib/datamodel/opcua_status_code").decodeStatusCode;
exports.encodeStatusCode = require("lib/datamodel/opcua_status_code").encodeStatusCode;


exports.isValidUInt64 = value => value instanceof Array && value.length === 2;
exports.randomUInt64 = () => [getRandomInt(0, 0xFFFFFFFF), getRandomInt(0, 0xFFFFFFFF)];
exports.encodeUInt64 = (value, stream) => {
  if (_.isNumber(value)) {
    value = exports.coerceUInt64(value);
  }
  stream.writeUInt32(value[1]);
  stream.writeUInt32(value[0]);
};

exports.decodeUInt64 = (stream) => {
  const low = stream.readUInt32();
  const high = stream.readUInt32();
  return exports.constructInt64(high, low);
};
exports.constructInt64 = (high, low) => {
  assert(low >= 0 && low <= 0xFFFFFFFF);
  assert(high >= 0 && high <= 0xFFFFFFFF);
  return [high, low];
};

exports.coerceUInt64 = (value) => {
  let high;
  let low;
  let v;
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Array) {
    assert(_.isNumber(value[0]));
    assert(_.isNumber(value[1]));
    return value;
  }
  if (typeof value === "string") {
    v = value.split(",");
    high = parseInt(v[0], 10);
    low = parseInt(v[1], 10);
    return exports.constructInt64(high, low);
  }
  if (value > 0xFFFFFFFF) {
        // beware : as per javascript, value is a double here !
        //          our conversion will suffer from some inacuracy

    high = Math.floor(value / 0x100000000);
    low = value - high * 0x100000000;
    return exports.constructInt64(high, low);
  }
  return exports.constructInt64(0, value);
};

exports.randomInt64 = () => // High, low
[getRandomInt(0, 0xFFFFFFFF), getRandomInt(0, 0xFFFFFFFF)];
exports.coerceInt64 = exports.coerceUInt64;
exports.isValidInt64 = exports.isValidUInt64;
exports.encodeInt64 = exports.encodeUInt64;
exports.decodeInt64 = exports.decodeUInt64;


const falsy = /^(?:f(?:alse)?|no?|0+)$/i;

exports.coerceBoolean = function coerceBoolean(value) {
  if (value === null || value === undefined) {
    return value;
  }

    // http://stackoverflow.com/a/24744599/406458
  return !falsy.test(value) && !!value;

    // return !!(+value||String(value).toLowerCase().replace(!!0,''));
};

exports.coerceInt8 = function coerceInt8(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceUInt8 = function coerceUInt8(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceByte = function coerceByte(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceSByte = function coerceSByte(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceUInt16 = function coerceUInt16(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceInt16 = function coerceInt16(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceUInt32 = function coerceUInt32(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceInt32 = function coerceInt32(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseInt(value, 10);
};
exports.coerceFloat = function coerceFloat(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseFloat(value);
};
exports.coerceDouble = function coerceDouble(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return parseFloat(value);
};


/**
 * @method encodeArray
 * @param arr {Array} the array to encode.
 * @param stream {BinaryStream}  the stream.
 * @param encode_element_func  {Function}  The  function to encode a single array element.
 * @param encode_element_func.element {object}
 * @param encode_element_func.stream  {BinaryStream}  the stream.
 */
exports.encodeArray = (arr, stream, encode_element_func) => {
  if (arr === null) {
    stream.writeUInt32(0xFFFFFFFF);
    return;
  }
  assert(_.isArray(arr));
  stream.writeUInt32(arr.length);
  for (let i = 0; i < arr.length; i++) {
    encode_element_func(arr[i], stream);
  }
};
/**
 * @method decodeArray
 * @param stream {BinaryStream}  the stream.
 * @param decode_element_func {Function}  The  function to decode a single array element. This function returns the element decoded from the stream
 * @param decode_element_func.stream {BinaryStream}  the stream.
 * @return {Array}
 */
exports.decodeArray = (stream, decode_element_func) => {
  const length = stream.readUInt32(stream);
  if (length === 0xFFFFFFFF) {
    return null;
  }

  const arr = [];
  for (let i = 0; i < length; i++) {
    arr.push(decode_element_func(stream));
  }

  return arr;
};

