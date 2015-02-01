var factories = require("../lib/misc/factories");
var ec = require("../lib/misc/encode_decode");
var assert = require('better-assert');
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
            if (!_.isFinite(value)) {
                assert(_.isFinite(value));
            }
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

    assert(_.isArray(value));
    var isValid = true;
    value.forEach(function(element,elementIndex){
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
exports.isValidVariant = isValidVariant;


var Variant_Schema = {
    name: "Variant",
    id: factories.next_available_id(),
    fields:[
        { name: "dataType" ,  fieldType:"DataType" ,        defaultValue: DataType.Null , documentation:"the variant type."},
        { name: "arrayType" , fieldType:"VariantArrayType", defaultValue: VariantArrayType.Scalar },
        { name: "value",      fieldType:"Any"             , defaultValue: null        }
    ],
    encode: function(variant,stream){

        assert(variant.isValid());

        var encodingByte = variant.dataType.value;

        if (variant.arrayType ===  VariantArrayType.Array ) {

            encodingByte = encodingByte | Variant_ArrayMask;
        }
        ec.encodeUInt8(encodingByte,stream);
        var encode = factories.findBuiltInType(variant.dataType.key).encode;
        if (!encode) {
            throw new Error("Cannot find encode function for dataType "+variant.dataType.key);
        }
        if (variant.arrayType ===  VariantArrayType.Array ) {
            var arr = variant.value || [];
            ec.encodeUInt32(arr.length,stream);
            arr.forEach(function(el){
                encode(el,stream);
            });
        } else {
            encode(variant.value,stream);
        }
    },
    decode_debug: function(self,stream,options) {

        var tracer = options.tracer;

        var cur = stream.length;
        var encodingByte = ec.decodeUInt8(stream);

        var isArray      = (( encodingByte & Variant_ArrayMask  ) === Variant_ArrayMask);
        var dimension    = (( encodingByte & Variant_ArrayDimensionsMask  ) === Variant_ArrayDimensionsMask);

        self.dataType = DataType.get(encodingByte & Variant_TypeMask);

        tracer.dump( "dataType",self.dataType);
        tracer.dump( "isArray"  ,isArray?"true":"false");
        tracer.dump( "dimension",dimension);

        var decode = factories.findBuiltInType(self.dataType.key).decode;

        if(!decode ) {
            throw new Error("Variant.decode : cannot find decoder for type " + self.dataType.key);
        }

        var cursor_before = stream.length;

        if (isArray) {
            self.arrayType =VariantArrayType.Array ;

            var length = ec.decodeUInt32(stream);
            var arr = [];

            tracer.trace("start_array", "Variant", length, cursor_before, stream.length);

            for (var i = 0; i< length ; i++ ) {
                tracer.trace("start_element", "", i);
                var element = decode(stream);
                arr.push(element);
                tracer.trace("end_element", "", i);
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

        var decode = factories.findBuiltInType(self.dataType.key).decode;
        if(!decode ) {
            throw new Error("Variant.decode : cannot find decoder for type " + self.dataType.key);
        }

        if (isArray) {

            self.arrayType =VariantArrayType.Array ;
            var length = ec.decodeUInt32(stream);
            var arr = [];
            for (var i = 0; i< length ; i++ ) {
                var element = decode(stream);
                arr.push(element);
            }
            self.value = arr;

        } else {

            self.arrayType =VariantArrayType.Scalar ;
            self.value = decode(stream);

        }
    },

    construct_hook: function( options) {
        if (!options) return null;

        if ( options.arrayType && options.arrayType !== VariantArrayType.Scalar) {
            if (options.arrayType === VariantArrayType.Array) {

                options.value =  options.value || [];
                assert(_.isArray( options.value));
                options.value = options.value.map(function(val) {
                    return coerceVariantType(options.dataType,val);
                });

            } else { throw new Error("Not implemented Yet"); }
        } else {
            options.arrayType = VariantArrayType.Scalar;
            // scalar
            options.value = coerceVariantType(options.dataType,options.value);
            if (!isValidVariant(options.arrayType,options.dataType,options.value)) {
                throw new Error("Invalid variant " +options.arrayType + "  " + options.dataType + " " + options.value);
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
        if (self.arrayType === VariantArrayType.Scalar) {
            data += ", value: " + f(self.value);
        } else if (self.arrayType === VariantArrayType.Array) {
            assert(_.isArray(self.value));
            data +=", l= "+ self.value.length + ", value=[" + self.value.map(f).join(",") + "]";
        } else {
        }
        return "Variant(" + data + ")";
    }

};
exports.Variant_Schema = Variant_Schema;