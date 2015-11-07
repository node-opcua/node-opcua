"use strict";
require("requirish")._(module);
var factories   = require("lib/misc/factories");
var set_flag    = require("lib/misc/utils").set_flag;
var check_flag  = require("lib/misc/utils").check_flag;
var ec          = require("lib/misc/encode_decode");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var StatusCode  = require("lib/datamodel/opcua_status_code").StatusCode;
var Variant     = require("lib/datamodel/variant").Variant;
var DataValueEncodingByte = require("schemas/DataValueEncodingByte_enum").DataValueEncodingByte;

var _           = require("underscore");
var assert      = require("better-assert");

function getDataValue_EncodingByte(dataValue) {
    var encoding_mask = 0;

    if (dataValue.value) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.Value);
    }
    //  if (dataValue.statusCode !== null ) {
    if ( _.isObject(dataValue.statusCode)&& dataValue.statusCode.value !==0 ) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.StatusCode);
    }
    if (dataValue.sourceTimestamp && dataValue.sourceTimestamp !== "null") {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.SourceTimestamp);
    }
    if (dataValue.sourcePicoseconds) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.SourcePicoseconds);
    }
    if (dataValue.serverTimestamp && dataValue.serverTimestamp !== "null") {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.ServerTimestamp);
    }
    if (dataValue.serverPicoseconds) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.ServerPicoseconds);
    }
    return encoding_mask;
}

// OPC-UA part 4 -  $7.7
var DataValue_Schema = {
    name: "DataValue",
    id: factories.next_available_id(),
    fields: [
        { name:"value",             fieldType:"Variant"   , defaultValue: null  },
        { name:"statusCode",        fieldType:"StatusCode", defaultValue: StatusCodes.Good  },
        { name:"sourceTimestamp",   fieldType:"DateTime"  , defaultValue: null  },
        { name:"sourcePicoseconds", fieldType:"UInt16"    , defaultValue: 0     },
        { name:"serverTimestamp",   fieldType:"DateTime"  , defaultValue: null  },
        { name:"serverPicoseconds", fieldType:"UInt16"    , defaultValue: 0     }
    ],

    encode: function( dataValue, stream) {

        var encoding_mask = getDataValue_EncodingByte(dataValue);

        assert(_.isFinite(encoding_mask) && encoding_mask>=0 && encoding_mask<= 0x3F);

        // write encoding byte
        ec.encodeUInt8(encoding_mask,stream);

        // write value as Variant
        if (check_flag(encoding_mask, DataValueEncodingByte.Value)) {
            if (!dataValue.value) {
                dataValue.value = new Variant();
            }
            if (!dataValue.value.encode) {
                console.log(" CANNOT FIND ENCODE METHOD ON VARIANT !!! HELP",dataValue.toString());
            }
            dataValue.value.encode(stream);
        }

        // write statusCode
        if (check_flag(encoding_mask, DataValueEncodingByte.StatusCode)) {
            //ec.encodeUInt32(dataValue.statusCode.value,stream);
            ec.encodeStatusCode(dataValue.statusCode,stream);
        }
        // write sourceTimestamp
        if (check_flag(encoding_mask, DataValueEncodingByte.SourceTimestamp)) {
            ec.encodeDateTime(dataValue.sourceTimestamp,stream);
        }
        // write sourcePicoseconds
        if (check_flag(encoding_mask, DataValueEncodingByte.SourcePicoseconds)) {
            ec.encodeUInt16(dataValue.sourcePicoseconds,stream);
        }
        // write serverTimestamp
        if (check_flag(encoding_mask, DataValueEncodingByte.ServerTimestamp)) {
            ec.encodeDateTime(dataValue.serverTimestamp,stream);
        }
        // write serverPicoseconds
        if (check_flag(encoding_mask, DataValueEncodingByte.ServerPicoseconds)) {
            ec.encodeUInt16(dataValue.serverPicoseconds,stream);
        }
    },
    decode_debug: function(dataValue,stream,options) {

        var tracer = options.tracer;

        var cur = stream.length;
        var encoding_mask = ec.decodeUInt8(stream);
        assert(encoding_mask<=0x3F);

        tracer.trace("member", "encodingByte", "0x" + encoding_mask.toString(16), cur, stream.length, "Mask");
        tracer.encoding_byte(encoding_mask,DataValueEncodingByte,cur,stream.length);

        if( check_flag(encoding_mask,DataValueEncodingByte.Value)) {
            //xx var Variant = require("./variant").Variant;
            dataValue.value = new Variant();
            dataValue.value.decode_debug(stream,options);
            //xx if (tracer) { tracer.trace("member","statusCode", dataValue.value,cur,stream.length,"Variant"); }
        }
        // read statusCode
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.StatusCode)) {
            dataValue.statusCode  = ec.decodeStatusCode(stream);
            tracer.trace("member","statusCode", dataValue.statusCode,cur,stream.length,"StatusCode");
        }
        // read sourceTimestamp
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.SourceTimestamp)) {
            dataValue.sourceTimestamp  = ec.decodeDateTime(stream);
            tracer.trace("member","sourceTimestamp", dataValue.sourceTimestamp,cur,stream.length,"DateTime");
        }
        // read sourcePicoseconds
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.SourcePicoseconds)) {
            dataValue.sourcePicoseconds  = ec.decodeUInt16(stream);
            tracer.trace("member","sourcePicoseconds", dataValue.sourcePicoseconds,cur,stream.length,"UInt16");
        }
        // read serverTimestamp
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerTimestamp)) {
            dataValue.serverTimestamp  = ec.decodeDateTime(stream);
            tracer.trace("member","serverTimestamp", dataValue.serverTimestamp,cur,stream.length,"DateTime");
        }
        // read serverPicoseconds
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerPicoseconds)) {
            dataValue.serverPicoseconds  = ec.decodeUInt16(stream);
            tracer.trace("member","serverPicoseconds", dataValue.serverPicoseconds,cur,stream.length,"UInt16");
        }
    },

    decode: function(dataValue,stream,options) {

        var encoding_mask = ec.decodeUInt8(stream);

        if( check_flag(encoding_mask,DataValueEncodingByte.Value)) {
            //xx var Variant =
            // re("./variant").Variant;
            dataValue.value = new Variant();
            dataValue.value.decode(stream,options);
        }
        // read statusCode
        if (check_flag(encoding_mask,DataValueEncodingByte.StatusCode)) {
            dataValue.statusCode  = ec.decodeStatusCode(stream);
        } else {
            dataValue.statusCode = StatusCodes.Good;
        }
        // read sourceTimestamp
        if (check_flag(encoding_mask,DataValueEncodingByte.SourceTimestamp)) {
            dataValue.sourceTimestamp  = ec.decodeDateTime(stream);
        }
        // read sourcePicoseconds
        if (check_flag(encoding_mask,DataValueEncodingByte.SourcePicoseconds)) {
            dataValue.sourcePicoseconds  = ec.decodeUInt16(stream);
        }
        // read serverTimestamp
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerTimestamp)) {
            dataValue.serverTimestamp  = ec.decodeDateTime(stream);
        }
        // read serverPicoseconds
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerPicoseconds)) {
            dataValue.serverPicoseconds  = ec.decodeUInt16(stream);
        }
    },

    isValid: function(self) {
        assert(self.statusCode=== undefined || self.statusCode instanceof StatusCode);
        if (_.isObject(self.value)) {
            assert(self.value);
            assert(self.value instanceof Variant);
            assert(self.value.isValid());
        } else {
            assert(!self.value);
            // in this case StatusCode shall not be Good
            assert(self.statusCode !== StatusCodes.Good );
        }
        return true;
    }
};
exports.DataValue_Schema = DataValue_Schema;