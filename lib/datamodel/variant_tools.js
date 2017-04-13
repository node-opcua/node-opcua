"use strict";
require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");
var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

var ec = require("lib/misc/encode_decode");

var DataType = require("schemas/DataType_enum").DataType;
var VariantArrayType = require("schemas/VariantArrayType_enum").VariantArrayType;

var encode_decode = require("lib/misc/encode_decode");

var utils = require("lib/misc/utils");


function isEnumerationItem(value) {
    return (value instanceof Object && (value.value !== undefined) && value.key);
}


function coerceVariantType(dataType, value) {


    if (isEnumerationItem(value)) {
        // OPCUA Specification 1.0.3 5.8.2 encoding rules for various dataType:
        // [...]Enumeration are always encoded as Int32 on the wire [...]

        // istanbul ignore next
        if (dataType !== DataType.Int32) {
            throw new Error("expecting DataType.Int32 for enumeration values ; got DataType." + dataType.toString() + " instead");
        }
    }

    switch (dataType) {
        case DataType.Null:
            value = null;
            break;

        case DataType.LocalizedText:
            if (!value || !value._schema || value._schema !== LocalizedText.prototype._schema) {
                value = new LocalizedText(value);
            }
            break;

        case DataType.QualifiedName:
            if (!value || !value._schema || value._schema !== QualifiedName.prototype._schema) {
                value = new QualifiedName(value);
            }
            break;
        case DataType.Int16:
        case DataType.UInt16:
        case DataType.UInt32:
        case DataType.Int32:
            assert(value !== undefined);
            if (isEnumerationItem(value)) {
                // value is a enumeration of some sort
                value = value.value;
            } else {
                value = parseInt(value, 10);
            }
            assert(_.isFinite(value));
            break;
        case DataType.UInt64:
            value = encode_decode.coerceUInt64(value);
            break;
        case DataType.Int64:
            value = encode_decode.coerceInt64(value);
            break;
        case DataType.ExtensionObject:
            break;
        case DataType.DateTime:
            assert(value === null || value instanceof Date);
            break;
        case DataType.String:
            assert(typeof value === "string" || value === null);
            break;
        default:
            assert(dataType !== undefined && dataType !== null, "Invalid DataType");
            break;
    }
    return value;
}
exports.coerceVariantType = coerceVariantType;


function isValidScalarVariant(dataType, value) {

    assert(value === null || DataType.Int64 === dataType || DataType.ByteString === dataType || DataType.UInt64 === dataType || !(value instanceof Array));
    assert(value === null || !(value instanceof Int32Array));
    assert(value === null || !(value instanceof Uint32Array));
    switch (dataType) {
        case DataType.NodeId:
            return ec.isValidNodeId(value);
        case DataType.String:
            return typeof value === "string" || utils.isNullOrUndefined(value);
        case DataType.Int64:
            return ec.isValidInt64(value);
        case DataType.UInt64:
            return ec.isValidUInt64(value);
        case DataType.UInt32:
            return ec.isValidUInt32(value);
        case DataType.Int32:
            return ec.isValidInt32(value);
        case DataType.UInt16:
            return ec.isValidUInt16(value);
        case DataType.Int16:
            return ec.isValidInt16(value);
        case DataType.Byte:
            return ec.isValidUInt8(value);
        case DataType.SByte:
            return ec.isValidInt8(value);
        case DataType.Boolean:
            return ec.isValidBoolean(value);
        default:
            return true;
    }
}

function isValidArrayVariant(dataType, value) {

    if (dataType === DataType.Float && value instanceof Float32Array) {
        return true;
    } else if (dataType === DataType.Double && value instanceof Float64Array) {
        return true;
    } else if (dataType === DataType.SByte && ( value instanceof Int8Array )) {
        return true;
    } else if (dataType === DataType.Byte && ( value instanceof Buffer || value instanceof Uint8Array )) {
        return true;
    } else if (dataType === DataType.Int16 && value instanceof Int16Array) {
        return true;
    } else if (dataType === DataType.Int32 && value instanceof Int32Array) {
        return true;
    } else if (dataType === DataType.UInt16 && value instanceof Uint16Array) {
        return true;
    } else if (dataType === DataType.UInt32 && value instanceof Uint32Array) {
        return true;
    }
    // array values can be store in Buffer, Float32Array
    assert(_.isArray(value));
    var isValid = true;
    value.forEach(function (element/*,elementIndex*/) {
        if (!isValidScalarVariant(dataType, element)) {
            isValid = false;
        }
    });
    return isValid;
}

/*istanbul ignore next*/
function isValidMatrixVariant(dataType,value,dimensions) {

    if(!dimensions) {
        return false;
    }
    if (!isValidArrayVariant(dataType,value)) {
        return false;
    }
    return true;
}

function isValidVariant(arrayType, dataType, value, dimensions) {

    assert(dataType);

    switch (arrayType) {
        case VariantArrayType.Scalar:
            return isValidScalarVariant(dataType, value);
        case VariantArrayType.Array:
            return isValidArrayVariant(dataType, value);
        default:
            assert(arrayType === VariantArrayType.Matrix);
            return isValidMatrixVariant(dataType, value, dimensions);
    }
}
exports.isValidVariant = isValidVariant;


function buildVariantArray(dataType, nbElements, defaultValue) {

    var value;
    switch (dataType) {
        case DataType.Float:
            value = new Float32Array(nbElements);
            break;
        case DataType.Double:
            value = new Float64Array(nbElements);
            break;
        case DataType.UInt32:
            value = new Uint32Array(nbElements);
            break;
        case DataType.Int32:
            value = new Int32Array(nbElements);
            break;
        case DataType.UInt16:
            value = new Uint16Array(nbElements);
            break;
        case DataType.Int16:
            value = new Int16Array(nbElements);
            break;
        case DataType.Byte:
            value = new Uint8Array(nbElements);
            break;
        case DataType.SByte:
            value = new Int8Array(nbElements);
            break;
        default:
            //xx console.log("xxxx DataType = ",dataType ? dataType.toString(): null,"nb Elements =",nbElements);
            value = new Array(nbElements);
            for (var i = 0; i < nbElements; i++) {
                value[i] = defaultValue;
            }
        //xx console.log("xxx done");
    }
    return value;
}
exports.buildVariantArray = buildVariantArray;


// old version of nodejs do not provide a Buffer#equals test
var oldNodeVersion =  (process.versions.node && process.versions.node.substring(0,1) === "0");


function __check_same_array(arr1,arr2) {

    if (!arr1 || !arr2) {
        return !arr1 && !arr2;
    }
    if (arr1.length !== arr2.length) {
        return false;
    }
    if (arr1.length == 0 && 0 == arr2.length) {
        return true;
    }
    if (!oldNodeVersion  && arr1.buffer) {

        // v1 and v2 are TypedArray (such as Int32Array...)
        // this is the most efficient way to compare 2 buffers but it doesn't work with node <= 0.12
        assert(arr2.buffer);
        // compare byte by byte
        var b1 = Buffer.from(arr1.buffer);
        var b2 = Buffer.from(arr2.buffer);
        return b1.equals(b2);
    }
    var n = arr1.length;
    for (var i = 0; i < n; i++) {
        if (!_.isEqual(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true;

}
exports.sameVariant = function sameVariant(v1, v2) {

    //xx assert(v1 && v1.constructor.name === "Variant");
    if (v1 === v2) {
        return true;
    }
    if  ( (!v1 && v2 ) || (v1 && !v2 )) {
        return false;
    }
    if (v1.arrayType !== v2.arrayType) {
        return false;
    }
    if (v1.dataType !== v2.dataType) {
        return false;
    }
    if (v1.value === v2.value) {
        return true;
    }
    if (v1.arrayType === VariantArrayType.Array) {
        return __check_same_array(v1.value,v2.value);

    } else if (v1.arrayType === VariantArrayType.Matrix) {
        if (!__check_same_array(v1.dimensions,v2.dimensions)) {
            return false;
        }
        return __check_same_array(v1.value,v2.value);
    }

    return false;
};
