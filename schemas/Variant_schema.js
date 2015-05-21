"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");
var ec = require("lib/misc/encode_decode");
var assert = require("better-assert");
var _ = require("underscore");


var DataType = require("./DataType_enum").DataType;
var VariantArrayType = require("./VariantArrayType_enum").VariantArrayType;

var Variant_ArrayMask = 0x80;
var Variant_ArrayDimensionsMask = 0x40;
var Variant_TypeMask = 0x3F;

var variant_tools = require("lib/datamodel/variant_tools");

var coerceVariantType = variant_tools.coerceVariantType;
var isValidVariant = variant_tools.isValidVariant;
exports.isValidVariant = isValidVariant;



function get_encoder(dataType) {
  var encode = factories.findBuiltInType(dataType.key).encode;
  /* istanbul ignore next */
  if (!encode) {
    throw new Error("Cannot find encode function for dataType " + dataType.key);
  }
  return encode;
}

function get_decoder(dataType) {
  var decode = factories.findBuiltInType(dataType.key).decode;
  /* istanbul ignore next */
  if (!decode) {
    throw new Error("Variant.decode : cannot find decoder for type " + dataType.key);
  }
  return decode;
}
var displayWarning = true;
function convertTo(dataType, ArrayType, value) {

  if (ArrayType && value instanceof ArrayType) {
    return value;
  }
  var coerceFunc = coerceVariantType.bind(null, dataType);
  var newArr = ArrayType ? new ArrayType(value.length) : [];
  var n = value.length;
  for (var i = 0; i < n; i++) {
    newArr[i] = coerceFunc(value[i]);
  }
  if (ArrayType && displayWarning && n > 10) {
    console.log("Warning ! a array containing  " + dataType.key + "elements has been provided as a generic array. ");
    console.log("          This is inefficient as every array value will have to be coerced and verified against the expected type");
    console.log("          It is highly recommended that you use a  typed array ", ArrayType.constructor.name, " instead");
  }
  return newArr;
}

var typedArrayHelpers = {};

function _getHelper(dataType) {
  return typedArrayHelpers[dataType.key];
}

function coerceVariantArray(dataType, value) {

  var helper = _getHelper(dataType);
  if (helper) {
    return helper.coerce(value);
  }
  else {
    return convertTo(dataType, null, value);
  }
}

function encodeTypedArray(ArrayType, stream, value) {

  assert(value instanceof ArrayType);

  ec.encodeUInt32(value.length, stream);

  stream.writeArrayBuffer(value.buffer,value.byteOffset,value.byteLength);

}

function encodeGeneralArray(dataType, stream, value) {

  var arr = value || [];

  ec.encodeUInt32(arr.length, stream);

  var encode = get_encoder(dataType);
  var i, n = arr.length;
  for (i = 0; i < n; i++) {
    encode(arr[i], stream);
  }
}

function encodeVariantArray(dataType, stream, value) {

  if (value.buffer) {
    return _getHelper(dataType).encode(stream, value);
  }
  return encodeGeneralArray(dataType, stream, value);
}

function decodeTypedArray(ArrayType, stream) {

  var length = ec.decodeUInt32(stream);
  if (length === 0xFFFFFFFF) {
    return null;
  }

  var arr = new Uint8Array(length * ArrayType.BYTES_PER_ELEMENT);

  var n = arr.length;
  for (var i = 0; i < n; i++) {
    arr[i] = stream.readUInt8();

  }
  var value = new ArrayType(arr.buffer);
  assert(value.length === length);
  return value;
}

function decodeGeneralArray(dataType, stream) {

  var length = ec.decodeUInt32(stream);

  if (length === 0xFFFFFFFF) {
    return null;
  }

  var decode = get_decoder(dataType);

  var arr = [];
  for (var i = 0; i < length; i++) {
    arr.push(decode(stream));
  }
  return arr;
}

function decodeVariantArray(dataType, stream) {

  var helper = _getHelper(dataType);
  if (helper) {
    return helper.decode(stream);
  }
  else {
    return decodeGeneralArray(dataType, stream);
  }
}





function _declareTypeArrayHelper(dataType, TypedArray) {
  typedArrayHelpers[dataType.key] = {
    coerce: convertTo.bind(null, dataType, TypedArray),
    encode: encodeTypedArray.bind(null, TypedArray),
    decode: decodeTypedArray.bind(null, TypedArray)
  };
}
_declareTypeArrayHelper(DataType.Float,   Float32Array);
_declareTypeArrayHelper(DataType.Double,  Float64Array);
_declareTypeArrayHelper(DataType.SByte,   Int8Array);
_declareTypeArrayHelper(DataType.Byte,    Uint8Array);
_declareTypeArrayHelper(DataType.Int16,   Int16Array);
_declareTypeArrayHelper(DataType.Int32,   Int32Array);
_declareTypeArrayHelper(DataType.UInt16,  Uint16Array);
_declareTypeArrayHelper(DataType.UInt32,  Uint32Array);


function _decodeVariantArrayDebug(stream, decode, tracer, dataType) {

  var cursor_before = stream.length;
  var length = ec.decodeUInt32(stream);
  var i, element;
  tracer.trace("start_array", "Variant", length, cursor_before, stream.length);

  var n1 = Math.min(10, length);
  // display a maximum of 10 elements
  for (i = 0; i < n1; i++) {
    tracer.trace("start_element", "", i);
    cursor_before = stream.length;
    element = decode(stream);
    // arr.push(element);
    tracer.trace("member", "Variant", element, cursor_before, stream.length, dataType.key);
    tracer.trace("end_element", "", i);
  }
  // keep reading
  if (length >= n1) {
    for (i = n1; i < length; i++) {
      decode(stream);
    }
    tracer.trace("start_element", "", n1);
    tracer.trace("member", "Variant", "...", cursor_before, stream.length, dataType.key);
    tracer.trace("end_element", "", n1);
  }
  tracer.trace("end_array", "Variant", stream.length);
}

var Variant_Schema = {
  name: "Variant",
  id: factories.next_available_id(),
  fields: [{
    name: "dataType",
    fieldType: "DataType",
    defaultValue: DataType.Null,
    documentation: "the variant type."
  }, {
    name: "arrayType",
    fieldType: "VariantArrayType",
    defaultValue: VariantArrayType.Scalar
  }, {
    name: "value",
    fieldType: "Any",
    defaultValue: null
  }],
  encode: function(variant, stream) {

    var encodingByte = variant.dataType.value;

    if (variant.arrayType === VariantArrayType.Array) {
      encodingByte = encodingByte | Variant_ArrayMask;
    }
    ec.encodeUInt8(encodingByte, stream);

    if (variant.arrayType === VariantArrayType.Array) {
      encodeVariantArray(variant.dataType, stream, variant.value);
    }
    else {
      var encode = get_encoder(variant.dataType);
      encode(variant.value, stream);
    }
  },
  decode_debug: function(self, stream, options) {

    var tracer = options.tracer;

    var encodingByte = ec.decodeUInt8(stream);

    var isArray = ((encodingByte & Variant_ArrayMask) === Variant_ArrayMask);
    var dimension = ((encodingByte & Variant_ArrayDimensionsMask) === Variant_ArrayDimensionsMask);

    self.dataType = DataType.get(encodingByte & Variant_TypeMask);

    tracer.dump("dataType:  ", self.dataType);
    tracer.dump("isArray:   ", isArray ? "true" : "false");
    tracer.dump("dimension: ", dimension);

    var decode = factories.findBuiltInType(self.dataType.key).decode;

    /* istanbul ignore next */
    if (!decode) {
      throw new Error("Variant.decode : cannot find decoder for type " + self.dataType.key);
    }

    var cursor_before = stream.length;

    if (isArray) {
      self.arrayType = VariantArrayType.Array;
      _decodeVariantArrayDebug(stream, decode, tracer, self.dataType);

    }
    else {
      self.arrayType = VariantArrayType.Scalar;
      self.value = decode(stream);
      tracer.trace("member", "Variant", self.value, cursor_before, stream.length, self.dataType.key);
    }

  },
  decode: function(self, stream) {

    var encodingByte = ec.decodeUInt8(stream);

    var isArray = ((encodingByte & Variant_ArrayMask) === Variant_ArrayMask);

    //xx var dimension    = (( encodingByte & Variant_ArrayDimensionsMask  ) === Variant_ArrayDimensionsMask);

    self.dataType = DataType.get(encodingByte & Variant_TypeMask);

    if (isArray) {
      self.arrayType = VariantArrayType.Array;
      self.value = decodeVariantArray(self.dataType, stream);
    }
    else {
      self.arrayType = VariantArrayType.Scalar;
      var decode = get_decoder(self.dataType);
      self.value = decode(stream);
    }
  },

  construct_hook: function(options) {

    assert(options);

    if (options.arrayType && options.arrayType !== VariantArrayType.Scalar) {
      /* istanbul ignore else */
      if (options.arrayType === VariantArrayType.Array) {

        options.value = options.value || [];
        options.value = coerceVariantArray(options.dataType, options.value);
      }
      else {
        throw new Error("Not implemented Yet");
      }
    }
    else {
      options.arrayType = VariantArrayType.Scalar;
      // scalar
      options.value = coerceVariantType(options.dataType, options.value);

      /* istanbul ignore next */
      if (!isValidVariant(options.arrayType, options.dataType, options.value)) {
        throw new Error("Invalid variant " + options.arrayType.toString() + "  " + options.dataType.toString() + " " + options.value);
      }
    }
    return options;
  },
  isValid: function(self) {
    return isValidVariant(self.arrayType, self.dataType, self.value);
  },
  toString: function() {

    var self = this;

    function f(value) {
      return (value === null) ? "<null>" : value.toString();
    }

    var data = self.arrayType.toString();

    data += "<" + self.dataType.toString() + ">";
    if (self.arrayType === VariantArrayType.Scalar) {
      data += ", value: " + f(self.value);
    }
    else if (self.arrayType === VariantArrayType.Array) {
      assert(_.isArray(self.value) || (self.value.buffer instanceof ArrayBuffer));
      var a = [];
      for (var i = 0; i < Math.min(10, self.value.length); i++) {
        a[i] = self.value[i];
      }
      if (self.value.length > 10) {
        a.push("...");
      }
      data += ", l= " + self.value.length + ", value=[" + a.map(f).join(",") + "]";
    }
    return "Variant(" + data + ")";
  }

};
exports.Variant_Schema = Variant_Schema;