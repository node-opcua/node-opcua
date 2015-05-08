"use strict";
require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");

var QualifiedName   = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText   = require("lib/datamodel/localized_text").LocalizedText;

var ec = require("lib/misc/encode_decode");

var DataType = require("schemas/DataType_enum").DataType;
var VariantArrayType = require("schemas/VariantArrayType_enum").VariantArrayType;

function coerceVariantType(dataType, value)
{
    switch(dataType) {
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
            
        case DataType.UInt32:
            assert( value !== undefined);

            if (value instanceof Object && (value.value!==undefined) && value.key ) {
                // value is a enumeration of some sort
                value = value.value;
            } else {
                value = parseInt(value,10);
            }
            assert(_.isFinite(value));
            break;
        case DataType.ExtensionObject:
            break;
        default:
            break;
    }
    return value;
}
exports.coerceVariantType = coerceVariantType;


function isValidScalarVariant(dataType,value) {

    switch(dataType)  {
        case DataType.UInt32:
            return ec.isValidUInt32(value);
        case DataType.Int32:
            return ec.isValidInt32(value);
        case DataType.UInt16:
            return  ec.isValidUInt16(value);
        case DataType.Int16:
            return  ec.isValidInt16(value);
        case DataType.Byte:
            return  ec.isValidUInt8(value);
        case DataType.SByte:
            return ec.isValidInt8(value);
        default:
            return true;
    }
}

function isValidArrayVariant(dataType,value) {

    if (dataType === DataType.Float && value instanceof Float32Array ) {
        return true;
    } else if (dataType === DataType.Double && value instanceof Float64Array ) {
        return true;
    } else if (dataType === DataType.SByte && ( value instanceof Int8Array )) {
        return true;
    } else if (dataType === DataType.Byte && ( value instanceof Buffer || value instanceof Uint8Array )) {
        return true;
    } else if (dataType === DataType.Int16 && value instanceof Int16Array ) {
        return true;
    } else if (dataType === DataType.Int32 && value instanceof Int32Array ) {
        return true;
    } else if (dataType === DataType.UInt16 && value instanceof Uint16Array ) {
        return true;
    } else if (dataType === DataType.UInt32 && value instanceof Uint32Array ) {
        return true;
    }
    // array values can be store in Buffer, Float32Array
    assert(_.isArray(value));
    var isValid = true;
    value.forEach(function(element/*,elementIndex*/){
        if (!isValidScalarVariant(dataType,element)) {
            isValid = false;
        }
    });
    return isValid;
}

/*istanbul ignore next*/
function isValidMatrixVariant(/*dataType,value*/) {
    assert(false,"not implemented");
}

function isValidVariant(arrayType,dataType,value) {

    switch(arrayType) {
        case VariantArrayType.Scalar:
            return isValidScalarVariant(dataType,value);
        case VariantArrayType.Array:
            return isValidArrayVariant(dataType,value);
        default:
            assert(arrayType ===  VariantArrayType.Matrix);
            return isValidMatrixVariant(dataType,value);
    }
}
exports.isValidVariant = isValidVariant;
