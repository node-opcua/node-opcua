/**
 * @module utilities
 */
var factories = require("./factories");


var s = require("./structures");
var ec = require("./encode_decode");
var DataValue = require("./datavalue").DataValue;
var assert = require('better-assert');
var _ = require("underscore");


var DataType_Schema = {
    name:"DataType",
    isEnum: true,
    enumValues: {
        Null:              0,
        Boolean:           1,
        SByte:             2,
        Byte :             3,
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
var DataType = exports.DataType = factories.registerObject(DataType_Schema);

var VariantArrayType_Schema = {
    name:"VariantArrayType",
    isEnum: true,
    enumValues: {
        Scalar: 0x00,
        Array:  0x01,
        Matrix:  0x02
    }
};

var VariantArrayType = exports.VariantArrayType = factories.registerObject(VariantArrayType_Schema);

var QualifiedName   = s.QualifiedName;
var LocalizedText   = s.LocalizedText;

var ExtensionObject = function()  {
};
ExtensionObject.prototype.encode = factories.encodeExtentionObject;
ExtensionObject.prototype.decode = factories.decodeExtensionObject;


var DiagnosticInfo = s.DiagnosticInfo;
var Variant;

function _self_encode(Type) {
    assert(_.isFunction(Type));
    return function(value,stream) {
        if (!value.encode) {
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


factories.registerObject({name:"DateTime"    ,subtype:"UtcTime"});

var _encoder_map = {
    Null:             { encoder : function(){} , decoder: function(){return null; } },
    Boolean:          { encoder : ec.encodeBoolean,   decoder: ec.decodeBoolean   },
    SByte:            { encoder : ec.encodeByte,      decoder: ec.decodeByte      },
    Byte :            { encoder : ec.encodeByte,      decoder: ec.decodeByte      },
    Int16:            { encoder : ec.encodeInt16,     decoder: ec.decodeInt16     },
    UInt16:           { encoder : ec.encodeUInt16,    decoder: ec.decodeUInt16    },
    Int32:            { encoder : ec.encodeInt32,     decoder: ec.decodeInt32     },
    UInt32:           { encoder : ec.encodeUInt32,    decoder: ec.decodeUInt32    },
    Int64:            { encoder : ec.encodeInt64,     decoder: ec.decodeInt64     },
    UInt64:           { encoder : ec.encodeUInt64,    decoder: ec.decodeUInt64    },
    Float:            { encoder : ec.encodeFloat,     decoder: ec.decodeFloat     },
    Double:           { encoder : ec.encodeDouble,    decoder: ec.decodeDouble    },
    String:           { encoder : ec.encodeUAString,  decoder: ec.decodeUAString  },
    DateTime:         { encoder : ec.encodeDateTime,  decoder: ec.decodeDateTime  },
    Guid:             { encoder : ec.encodeGUID,      decoder: ec.decodeGUID      },
    ByteString:       { encoder : ec.encodeByteString,decoder: ec.decodeByteString},
    XmlElement:       { encoder : ec.encodeXmlElement,decoder: ec.decodeXmlElement},
    NodeId:           { encoder : ec.encodeNodeId,           decoder: ec.decodeNodeId              },
    ExpandedNodeId:   { encoder : ec.encodeExpandedNodeId,   decoder: ec.encodeExpandedNodeId     },
    StatusCode:       { encoder : ec.encodeUInt32,           decoder: ec.decodeUInt32        },
    QualifiedName:    { encoder : _self_encode(QualifiedName),      decoder:  _self_decode(QualifiedName)    },
    LocalizedText:    { encoder : _self_encode(LocalizedText),      decoder:  _self_decode(LocalizedText)    },
    ExtensionObject:  { encoder : _self_encode(ExtensionObject),    decoder:  _self_decode(ExtensionObject)  },
    DataValue:        { encoder : _self_encode(DataValue),          decoder:  _self_decode(DataValue)        },
  //xx  Variant:          { encoder : _self_encode(Variant) ,           decoder:  _self_decode(Variant)          },
    DiagnosticInfo:   { encoder : _self_encode(DiagnosticInfo),     decoder:  _self_decode(DiagnosticInfo)   }
};



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


var Variant_Schema = {
    name: "Variant",
    id: factories.next_available_id(),
    fields:[
        { name: "dataType" ,  fieldType:"DataType" ,        defaultValue: DataType.Null , documentation:"the variant type."},
        { name: "arrayType" , fieldType:"VariantArrayType", defaultValue: VariantArrayType.Scalar },
        { name: "value",      fieldType:"UInt32" ,          defaultValue: null        }
    ],
    encode: function(variant,stream){

        assert(this.isValid());

        var encodingByte = variant.dataType.value;

        if (variant.arrayType ===  VariantArrayType.Array ) {

            encodingByte = encodingByte | Variant_ArrayMask;
        }
        ec.encodeUInt8(encodingByte,stream);
        var encoder = _encoder_map[variant.dataType.key].encoder;

        if (variant.arrayType ===  VariantArrayType.Array ) {
            var arr = variant.value || [];
            ec.encodeUInt32(arr.length,stream);
            arr.forEach(function(el){
                encoder(el,stream);
            });
        } else {
            encoder(variant.value,stream);
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

        var decoder = _encoder_map[self.dataType.key].decoder;

        if (isArray) {
            self.arrayType =VariantArrayType.Array ;

            var cursor_before = stream.length;
            var length = ec.decodeUInt32(stream);
            var arr = [];

            if (tracer) { tracer.trace("start_array", "Variant", length, cursor_before, stream.length); }

            for (var i = 0; i< length ; i++ ) {
                if (tracer) {tracer.trace("start_element", "", i); }
                var element = decoder(stream);
                arr.push(element);
                if (tracer) { tracer.trace("end_element", "", i);}
            }
            self.value = arr;

            if (tracer) { tracer.trace("end_array", "Variant", stream.length ); }


        } else {
            self.arrayType =VariantArrayType.Scalar ;
            var cursor_before = stream.length;
            self.value = decoder(stream);
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
            assert(options.value !== undefined);
            options.value = coerceVariantType(options.dataType,options.value);
        }
        return options;
    },
    isValid: function() {

        if (this.dataType === DataType.UInt32){
            assert(_.isFinite(this.value));
            assert(this.value >=0 && this.value < 0xFFFFFFFF );
        } else if (this.dataType === DataType.Int32){
            assert(_.isFinite(this.value));
            assert(this.value >=-0x7FFFFFFF && this.value < 0x7FFFFFFF );
        } else if (this.dataType === DataType.Int16){
            assert(_.isFinite(this.value));
            assert(this.value >=-0x7FFF && this.value < 0x7FFF );
        } else if (this.dataType === DataType.UInt16){
            assert(_.isFinite(this.value));
            assert(this.value >=-0x0 && this.value < 0xFFFF );
        }
        return true;
    }

};


/**
 *
 * @class Variant
 *
 */
Variant = exports.Variant = factories.registerObject(Variant_Schema);


