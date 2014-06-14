/**
 * @module opcua.datamodel
 */

var factories = require("./../misc/factories");
var extension_object = require("./../misc/extension_object");

var s = require("./structures");
var ec = require("./../misc/encode_decode");
var assert = require('better-assert');
var _ = require("underscore");


var DataType_Schema = {
    name:"DataType",
    enumValues: {
        Null:              0,
        Boolean:           1,
        SByte:             2, // signed Byte = Int8
        Byte :             3, // unsigned Byte = UInt8
        Int16:             4,
        UInt16:            5,
        Int32:             6,
        UInt32:            7,
        Int64:             8,
        UInt64:            9,
        Float:            10,
        Double:           11,
        String:           12,
        DateTime:         13,
        Guid:             14,
        ByteString:       15,
        XmlElement:       16,
        NodeId:           17,
        ExpandedNodeId:   18,
        StatusCode:       19,
        QualifiedName:    20,
        LocalizedText:    21,
        ExtensionObject:  22,
        DataValue:        23,
        Variant:          24,
        DiagnosticInfo:   25
    }
};
var DataType = exports.DataType = factories.registerEnumeration(DataType_Schema);

var VariantArrayType_Schema = {
    name:"VariantArrayType",
    enumValues: {
        Scalar: 0x00,
        Array:  0x01,
        Matrix:  0x02
    }
};

var VariantArrayType = exports.VariantArrayType = factories.registerEnumeration(VariantArrayType_Schema);

var QualifiedName   = s.QualifiedName;
var LocalizedText   = s.LocalizedText;
var DiagnosticInfo = s.DiagnosticInfo;
var Variant;

function _self_encode(Type) {
    assert(_.isFunction(Type));
    return function(value,stream) {
        if (!value || !value.encode) {
            value = new Type(value);
        }
        value.encode(stream);
    }
}
function _self_decode(Type) {
    assert(_.isFunction(Type));

    return function(stream) {
        var value = new Type();
        value.decode(stream);
        return value;
    }
}



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
            if (value._schema !== s.LocalizedText.prototype._schema) {
                value = new s.LocalizedText(value);
            }
            break;
        case DataType.QualifiedName:
            if (value._schema !== s.QualifiedName.prototype._schema) {
                value = new s.QualifiedName(value);
            }
            break;
        case DataType.UInt32:
            assert( value!= undefined);
            value = parseInt(value,10);
            assert(_.isFinite(value));
            break;

        default:
            break;
    }
    return value;
}

function isValidVariant(dataType,value) {

    switch(dataType)  {
        case DataType.UInt32:
            return ec.isValidUInt32(value);
            break;
        case DataType.Int32:
            return ec.isValidInt32(value);
            break;
        case DataType.UInt16:
            return  ec.isValidUInt16(value);
            break;
        case DataType.Int16:
            return  ec.isValidInt16(value);
            break;
        case DataType.Byte:
            return  ec.isValidUInt8(value);
            break;
        case DataType.Int8:
            if ( value === undefined) {
                var display_trace_from_this_projet_only = require("../misc/utils").display_trace_from_this_projet_only;
                display_trace_from_this_projet_only();
            }
            return ec.isValidInt8(value);
            break;
        default:
            return true;
    }
}
exports.isValidVariant = isValidVariant;

var findBuiltInType = require("../misc/factories").findBuiltInType;

var Variant_Schema = {
    name: "Variant",
    id: factories.next_available_id(),
    fields:[
        { name: "dataType" ,  fieldType:"DataType" ,        defaultValue: DataType.Null , documentation:"the variant type."},
        { name: "arrayType" , fieldType:"VariantArrayType", defaultValue: VariantArrayType.Scalar },
        { name: "value",      fieldType:"UInt32" ,          defaultValue: null        }
    ],
    encode: function(variant,stream){

        assert(variant.isValid());

        var encodingByte = variant.dataType.value;

        if (variant.arrayType ===  VariantArrayType.Array ) {

            encodingByte = encodingByte | Variant_ArrayMask;
        }
        ec.encodeUInt8(encodingByte,stream);
        var encode = findBuiltInType(variant.dataType.key).encode;
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

    decode: function(self,stream,options){

        var tracer = options ? options.tracer : null;

        var cur = stream.length;
        var encodingByte = ec.decodeUInt8(stream);

        var isArray      = (( encodingByte & Variant_ArrayMask  ) === Variant_ArrayMask);
        var dimension    = (( encodingByte & Variant_ArrayDimensionsMask  ) === Variant_ArrayDimensionsMask);

        self.dataType = DataType.get(encodingByte & Variant_TypeMask);

        if (tracer) {
            tracer.dump( "dataType",self.dataType);
            tracer.dump( "isArray"  ,isArray?"true":"false");
            tracer.dump( "dimension",dimension);
        }

        var decode = findBuiltInType(self.dataType.key).decode;

        if (isArray) {
            self.arrayType =VariantArrayType.Array ;

            var cursor_before = stream.length;
            var length = ec.decodeUInt32(stream);
            var arr = [];

            if (tracer) { tracer.trace("start_array", "Variant", length, cursor_before, stream.length); }

            for (var i = 0; i< length ; i++ ) {
                if (tracer) {tracer.trace("start_element", "", i); }
                var element = decode(stream);
                arr.push(element);
                if (tracer) { tracer.trace("end_element", "", i);}
            }
            self.value = arr;

            if (tracer) { tracer.trace("end_array", "Variant", stream.length ); }


        } else {
            self.arrayType =VariantArrayType.Scalar ;
            var cursor_before = stream.length;
            self.value = decode(stream);
            if (tracer) {
                tracer.trace("member", "Variant",  self.value , cursor_before, stream.length,self.dataType.key);
            }
        }
    },

    construct_hook: function( options) {
        if (!options) return null;

        if ( options.arrayType && options.arrayType !== VariantArrayType.Scalar) {
            if (options.arrayType === VariantArrayType.Array) {
               options.value = options.value.map(function(e) { return coerceVariantType(options.dataType,e); });
            } else { throw new Error("Not implemented Yet"); }
        } else {
            // scalar
            options.value = coerceVariantType(options.dataType,options.value);
            assert(isValidVariant(options.dataType,options.value));
        }
        return options;
    },
    isValid: function(self) {
        assert(isValidVariant(self.dataType,self.value));
        return true;
    }

};


/**
 *
 * @class Variant
 *
 */
Variant = exports.Variant = factories.registerObject(Variant_Schema);
Variant.prototype.toString = function()
{
    var str = this.dataType.toString() + " = " + this.value;
    return str;
};

exports.registerSpecialVariantEncoder =  function(ConstructorFunc) {

    assert(_.isFunction(ConstructorFunc));

    var name = ConstructorFunc.prototype._schema.name;

    factories.registerBuiltInType(name,_self_encode(ConstructorFunc),_self_decode(ConstructorFunc),null);
};

exports.registerSpecialVariantEncoder(QualifiedName);
exports.registerSpecialVariantEncoder(LocalizedText);
exports.registerSpecialVariantEncoder(Variant);
exports.registerSpecialVariantEncoder(DiagnosticInfo);
