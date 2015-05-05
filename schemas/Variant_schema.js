"use strict";
var factories = require("../lib/misc/factories");
var ec = require("../lib/misc/encode_decode");
var assert = require("better-assert");
var _ = require("underscore");

var QualifiedName   = require("../lib/datamodel/qualified_name").QualifiedName;
var LocalizedText   = require("../lib/datamodel/localized_text").LocalizedText;

var DataType         = require("./DataType_enum").DataType;
var VariantArrayType = require("./VariantArrayType_enum").VariantArrayType;

var Variant_ArrayMask            = 0x80;
var Variant_ArrayDimensionsMask  = 0x40;
var Variant_TypeMask             = 0x3F;


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
function isValidSArrayVariant(dataType,value) {

    if (dataType === DataType.Float && value instanceof Float32Array ) {
        return true;
    } else if (dataType === DataType.Double && value instanceof Float64Array ) {
        return true;
    } else if (dataType === DataType.SByte && ( value instanceof Uint8Array )) {
        return true;
    } else if (dataType === DataType.Byte && ( value instanceof Buffer || value instanceof Int8Array )) {
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
function isValidVariant(arrayType,dataType,value) {

    switch(arrayType) {
        case VariantArrayType.Scalar:
            return isValidScalarVariant(dataType,value);
        case VariantArrayType.Array:
            return isValidSArrayVariant(dataType,value);
        default:
            assert(arrayType ===  VariantArrayType.Matrix);
            return isValidMatrixVariant(dataType,value);
    }
}

function convertTo(dataType,ArrayType,value) {

    if (value instanceof ArrayType) { return value; }

    var coerceFunc = coerceVariantType.bind(null, dataType);
    var newArr = new ArrayType(value.length);
    var n =  value.length;
    for (var i=0;i<n;i++) {
        newArr[i] = coerceFunc(value[i]);
    }
    return newArr;
}

function coerceVariantArray(dataType,value) {

    switch(dataType) {
        case DataType.Float:   return convertTo(dataType,Float32Array,value);
        case DataType.Double:  return convertTo(dataType,Float64Array,value);
        case DataType.SByte:   return convertTo(dataType,Uint8Array  ,value);
        case DataType.Byte:    return convertTo(dataType,Int8Array   ,value);
        case DataType.Int16:   return convertTo(dataType,Int16Array  ,value);
        case DataType.Int32:   return convertTo(dataType,Int32Array  ,value);
        case DataType.UInt16:  return convertTo(dataType,Uint16Array ,value);
        case DataType.UInt32:  return convertTo(dataType,Uint32Array ,value);
    }
    assert(_.isArray(value));
    return value.map(coerceVariantType.bind(null, dataType));
}

function encodeTypedArray(ArrayType,stream,value) {

    assert(value instanceof ArrayType);
    assert(value.buffer instanceof ArrayBuffer);

    ec.encodeUInt32(value.length,stream);

    var arr = new Uint8Array(value.buffer);
    assert(arr.length === value.length*ArrayType.BYTES_PER_ELEMENT);
    var i,n = arr.length;
    for (i=0;i<n;i++) {
        stream.writeUInt8(arr[i]);
    }
}

function encodeGeneralArray(dataType,stream,value) {

    var arr = value || [];

    ec.encodeUInt32(arr.length,stream);

    var encode = get_encoder(dataType);
    var i,n= arr.length;
    for (i=0;i<n;i++) { encode(arr[i],stream); }
}

function encodeVariantArray(dataType,stream,value)  {

    if (value.buffer) {
        switch(dataType) {
            case DataType.Float:   return encodeTypedArray(Float32Array,stream,value);
            case DataType.Double:  return encodeTypedArray(Float64Array,stream,value);
            case DataType.SByte:   return encodeTypedArray(Uint8Array,  stream,value);
            case DataType.Byte:    return encodeTypedArray(Int8Array,   stream,value);
            case DataType.Int16:   return encodeTypedArray(Int16Array,  stream,value);
            case DataType.Int32:   return encodeTypedArray(Int32Array,  stream,value);
            case DataType.UInt16:  return encodeTypedArray(Uint16Array, stream,value);
            case DataType.UInt32:  return encodeTypedArray(Uint32Array, stream,value);
        }
    }
    return encodeGeneralArray(dataType,stream,value);
}

function decodeTypedArray(ArrayType,stream) {

    var length = ec.decodeUInt32(stream);
    if (length === 0xFFFFFFFF) { return null; }

    var arr = new Uint8Array(length*ArrayType.BYTES_PER_ELEMENT);

    var n = arr.length;
    for (var i=0;i<n;i++) {
        arr[i] = stream.readUInt8();

    }
    var value= new ArrayType(arr.buffer);
    assert(value.length === length);
    return value;
}

function decodeGeneralArray(dataType,stream) {

    var length = ec.decodeUInt32(stream);

    if (length === 0xFFFFFFFF) { return null; }

    var decode = get_decoder(dataType);

    var arr = [];
    for (var i = 0; i< length ; i++ ) {
        arr.push(decode(stream));
    }
    return arr;
}

function decodeVariantArray(dataType,stream) {

    switch(dataType) {
        case DataType.Float:   return decodeTypedArray(Float32Array,stream);
        case DataType.Double:  return decodeTypedArray(Float64Array,stream);
        case DataType.SByte:   return decodeTypedArray(Uint8Array,  stream);
        case DataType.Byte:    return decodeTypedArray(Int8Array,   stream);
        case DataType.Int16:   return decodeTypedArray(Int16Array,  stream);
        case DataType.Int32:   return decodeTypedArray(Int32Array,  stream);
        case DataType.UInt16:  return decodeTypedArray(Uint16Array, stream);
        case DataType.UInt32:  return decodeTypedArray(Uint32Array, stream);
    }
    return decodeGeneralArray(dataType,stream);
}

exports.isValidVariant = isValidVariant;

function get_encoder(dataType) {
    var encode = factories.findBuiltInType(dataType.key).encode;
    /* istanbul ignore next */
    if (!encode) {
        throw new Error("Cannot find encode function for dataType "+variant.dataType.key);
    }
    return encode;
}

function get_decoder(dataType) {
    var decode = factories.findBuiltInType(dataType.key).decode;
    /* istanbul ignore next */
    if(!decode ) {
        throw new Error("Variant.decode : cannot find decoder for type " + self.dataType.key);
    }
    return decode;
}

var Variant_Schema = {
    name: "Variant",
    id: factories.next_available_id(),
    fields:[
        { name: "dataType" ,  fieldType:"DataType" ,        defaultValue: DataType.Null , documentation:"the variant type."},
        { name: "arrayType" , fieldType:"VariantArrayType", defaultValue: VariantArrayType.Scalar },
        { name: "value",      fieldType:"Any"             , defaultValue: null        }
    ],
    encode: function(variant,stream){

        var encodingByte = variant.dataType.value;

        if (variant.arrayType ===  VariantArrayType.Array ) {
            encodingByte = encodingByte | Variant_ArrayMask;
        }
        ec.encodeUInt8(encodingByte,stream);

        if (variant.arrayType ===  VariantArrayType.Array ) {
            encodeVariantArray(variant.dataType,stream,variant.value);
        } else {
            var encode = get_encoder(variant.dataType);
            encode(variant.value,stream);
        }
    },
    decode_debug: function(self,stream,options) {

        var tracer = options.tracer;

        var encodingByte = ec.decodeUInt8(stream);

        var isArray      = (( encodingByte & Variant_ArrayMask  ) === Variant_ArrayMask);
        var dimension    = (( encodingByte & Variant_ArrayDimensionsMask  ) === Variant_ArrayDimensionsMask);

        self.dataType = DataType.get(encodingByte & Variant_TypeMask);

        tracer.dump( "dataType:  ",self.dataType);
        tracer.dump( "isArray:   "  ,isArray?"true":"false");
        tracer.dump( "dimension: ",dimension);

        var decode = factories.findBuiltInType(self.dataType.key).decode;

        /* istanbul ignore next */
        if(!decode ) {
            throw new Error("Variant.decode : cannot find decoder for type " + self.dataType.key);
        }

        var cursor_before = stream.length;

        if (isArray) {
            self.arrayType =VariantArrayType.Array ;

            var length = ec.decodeUInt32(stream);
            var arr = [];

            tracer.trace("start_array", "Variant", length, cursor_before, stream.length);

            var n1 = Math.min(10,length);
            // display a maximum of 10 elements
            for (var i = 0; i< n1 ; i++ ) {
                tracer.trace("start_element", "", i);
                cursor_before = stream.length;
                var element = decode(stream);
                // arr.push(element);
                tracer.trace("member", "Variant",  element , cursor_before, stream.length,self.dataType.key);
                tracer.trace("end_element", "", i);
            }
            // keep reading
            if (length>=n1) {
                for (var i = n1; i< length ; i++ ) {
                    var element = decode(stream);
                }
                tracer.trace("start_element", "", n1);
                tracer.trace("member", "Variant",  "..." , cursor_before, stream.length,self.dataType.key);
                tracer.trace("end_element", "", n1);
            }
            self.value = arr;

            tracer.trace("end_array", "Variant", stream.length );


        } else {
            self.arrayType =VariantArrayType.Scalar ;
            self.value = decode(stream);
            tracer.trace("member", "Variant",  self.value , cursor_before, stream.length,self.dataType.key);
        }

    },
    decode: function(self,stream){

        var encodingByte = ec.decodeUInt8(stream);

        var isArray      = (( encodingByte & Variant_ArrayMask  ) === Variant_ArrayMask);

        var dimension    = (( encodingByte & Variant_ArrayDimensionsMask  ) === Variant_ArrayDimensionsMask);

        self.dataType = DataType.get(encodingByte & Variant_TypeMask);

        if (isArray) {
            self.arrayType =VariantArrayType.Array ;
            self.value = decodeVariantArray(self.dataType,stream);
        } else {
            self.arrayType =VariantArrayType.Scalar ;
            var decode = get_decoder(self.dataType);
            self.value = decode(stream);
        }
    },

    construct_hook: function( options) {

        assert(options);

        if ( options.arrayType && options.arrayType !== VariantArrayType.Scalar) {
            /* istanbul ignore else */
            if (options.arrayType === VariantArrayType.Array) {

                options.value =  options.value || [];
                options.value = coerceVariantArray(options.dataType,options.value);
            } else { throw new Error("Not implemented Yet"); }
        } else {
            options.arrayType = VariantArrayType.Scalar;
            // scalar
            options.value = coerceVariantType(options.dataType,options.value);

            /* istanbul ignore next */
            if (!isValidVariant(options.arrayType,options.dataType,options.value)) {
                throw new Error("Invalid variant " +options.arrayType.toString() + "  " + options.dataType.toString() + " " + options.value);
            }
        }
        return options;
    },
    isValid: function(self) {
        return isValidVariant(self.arrayType,self.dataType,self.value);
    },
    toString: function() {

        var self = this;

        function f(value) {
            return (value === null)? "<null>" : value.toString();
        }

        var data = self.arrayType.toString();

        data += "<" + self.dataType.toString() + ">";
        if (self.arrayType === VariantArrayType.Scalar) {
            data += ", value: " + f(self.value);
        } else if (self.arrayType === VariantArrayType.Array) {
            assert(_.isArray(self.value) || (self.value.buffer instanceof ArrayBuffer ));
            var a=[];
            for( var i=0;i<Math.min(10,self.value.length);i++) {a[i]=self.value[i]; }
            if (self.value.length>10) {
                a.push("...");
            }
            data +=", l= "+ self.value.length + ", value=[" + a.map(f).join(",") + "]";
        }
        return "Variant(" + data + ")";
    }

};
exports.Variant_Schema = Variant_Schema;