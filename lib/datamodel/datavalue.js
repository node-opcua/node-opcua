
var factories = require("./../misc/factories");
var ec = require("./../misc/encode_decode");
var set_flag = require("./../misc/utils").set_flag;
var check_flag =  require("./../misc/utils").check_flag;
var StatusCodes = require("./opcua_status_code").StatusCodes;
var Variant = require("./variant").Variant;
var assert = require("better-assert");
var _ = require("underscore");

var DataValueEncodingByte_Schema = {
    name:"DataValue_EncodingByte",
    isEnum: true,
    enumValues: {
        Value:              0x01,
        StatusCode:         0x02,
        SourceTimestamp:    0x04,
        ServerTimestamp:    0x08,
        SourcePicoseconds:  0x10,
        ServerPicoseconds:  0x20
    }
};
var DataValueEncodingByte = factories.registerObject(DataValueEncodingByte_Schema);

function getDataValue_EncodingByte(dataValue) {
    var encoding_mask= 0;

    if (dataValue.value) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.Value);
    }
    //  if (dataValue.statusCode !== null ) {
    if (dataValue.statusCode.value !==0 ) {
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

    encode: function(dataValue,stream) {

        var encoding_mask= getDataValue_EncodingByte(dataValue);

        assert(_.isFinite(encoding_mask));

        // write encoding byte
        ec.encodeUInt8(encoding_mask,stream);

        // write value as Variant
        if (check_flag(encoding_mask,DataValueEncodingByte.Value)) {
            if (!dataValue.value)  {
                dataValue.value = new Variant();
            }
            if (!dataValue.value.encode) {
                console.log(" CANNOT FIND ENCODE METHOD ON VARIANT !!! HELOP",dataValue.toString());
            }
            dataValue.value.encode(stream);
        }

        // write statusCode
        if (check_flag(encoding_mask,DataValueEncodingByte.StatusCode)) {
            //ec.encodeUInt32(dataValue.statusCode.value,stream);
            ec.encodeStatusCode(dataValue.statusCode,stream);
        }
        // write sourceTimestamp
        if (check_flag(encoding_mask,DataValueEncodingByte.SourceTimestamp)) {
            ec.encodeDateTime(dataValue.sourceTimestamp,stream);
        }
        // write sourcePicoseconds
        if (check_flag(encoding_mask,DataValueEncodingByte.SourcePicoseconds)) {
            ec.encodeUInt16(dataValue.sourcePicoseconds,stream);
        }
        // write serverTimestamp
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerTimestamp)) {
            ec.encodeDateTime(dataValue.serverTimestamp,stream);
        }
        // write serverPicoseconds
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerPicoseconds)) {
            ec.encodeUInt16(dataValue.serverPicoseconds,stream);
        }
    },
    decode: function(dataValue,stream,options) {
        var tracer = options ? options.tracer : null;

        var cur = stream.length;
        var encoding_mask = ec.decodeUInt8(stream);

        if (tracer) { tracer.encoding_byte(encoding_mask,DataValueEncodingByte,cur,stream.length); }

        if( check_flag(encoding_mask,DataValueEncodingByte.Value)) {
            var Variant = require("./variant").Variant;
            dataValue.value = new Variant();
            dataValue.value.decode(stream,options);
            //xx if (tracer) { tracer.trace("member","statusCode", dataValue.value,cur,stream.length,"Variant"); }
        }
        // read statusCode
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.StatusCode)) {
            dataValue.statusCode  = ec.decodeStatusCode(stream);
            if (tracer) { tracer.trace("member","statusCode", dataValue.statusCode,cur,stream.length,"StatusCode"); }
        } else {
           dataValue.statusCode = StatusCodes.Good;
        }
        // read sourceTimestamp
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.SourceTimestamp)) {
            dataValue.sourceTimestamp  = ec.decodeDateTime(stream);
            if (tracer) { tracer.trace("member","sourceTimestamp", dataValue.sourceTimestamp,cur,stream.length,"DateTime"); }
        }
        // read sourcePicoseconds
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.SourcePicoseconds)) {
            dataValue.sourcePicoseconds  = ec.decodeUInt16(stream);
            if (tracer) { tracer.trace("member","sourcePicoseconds", dataValue.sourcePicoseconds,cur,stream.length,"UInt16"); }
        }
        // read serverTimestamp
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerTimestamp)) {
            dataValue.serverTimestamp  = ec.decodeDateTime(stream);
            if (tracer) { tracer.trace("member","serverTimestamp", dataValue.serverTimestamp,cur,stream.length,"DateTime"); }
        }
        // read serverPicoseconds
        cur = stream.length;
        if (check_flag(encoding_mask,DataValueEncodingByte.ServerPicoseconds)) {
            dataValue.serverPicoseconds  = ec.decodeUInt16(stream);
            if (tracer) { tracer.trace("member","sourcePicoseconds", dataValue.serverPicoseconds,cur,stream.length,"UInt16"); }
        }
    },
    isValid: function(self) {
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
var DataValue = exports.DataValue = factories.registerObject(DataValue_Schema);

require("./variant").registerSpecialVariantEncoder(DataValue);

DataValue.prototype.toString = function()
{
    var Variant = require("./variant").Variant;
    //xx assert(this.value instanceof Variant);
    var str = "DATAVALUE \n";

    if (this.value) {
        str += "\n   value = " + Variant.prototype.toString.apply(this.value);//this.value.toString();
    } else {
        str += "\n   value = <null>";
    }
    str += "\n   serverTimestamp  = " + this.serverTimestamp  + " $ " + this.serverPicoseconds;
    str += "\n   sourceTimestamp  = " + this.sourceTimestamp  + " $ " + this.sourcePicoseconds;
    return str;
};
exports.DataValue = DataValue;
