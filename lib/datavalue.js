
var factories = require("./factories");
var ec = require("./encode_decode");
var set_flag = require("./utils").set_flag;
var check_flag =  require("./utils").check_flag;


var DataValueEncodingByte_Description = {
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
var DataValueEncodingByte = factories.UAObjectFactoryBuild(DataValueEncodingByte_Description);


function getDataValue_EncodingByte(dataValue) {
    var encoding_mask= 0;

    if (dataValue.value) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.Value);
    }
    if (dataValue.statusCode) {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.StatusCode);
    }
    if (dataValue.sourceTimestamp && dataValue.sourceTimestamp !== "null") {
        encoding_mask = set_flag(encoding_mask,DataValueEncodingByte.SourceTimestamp);
    }
    if (dataValue.sourcePicosecondst) {
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
var DataValue_Description = {
    name: "DataValue",
    id: factories.next_available_id(),
    fields: [
        { name:"value",             fieldType:"Variant"   , defaultValue: "null"  },
        { name:"statusCode",        fieldType:"StatusCode", defaultValue: 0x000   },
        { name:"sourceTimestamp",   fieldType:"DateTime"  , defaultValue: "null"  },
        { name:"sourcePicoseconds", fieldType:"UInt16"    , defaultValue: 0       },
        { name:"serverTimestamp",   fieldType:"DateTime"  , defaultValue: "null"  },
        { name:"serverPicoseconds", fieldType:"UInt16"    , defaultValue: 0       }
    ],

    encode: function(dataValue,stream) {
        var encoding_mask= getDataValue_EncodingByte(dataValue);

        // write encoding byte
        ec.encodeUInt8(encoding_mask,stream);

        // write value as Variant
        if (check_flag(encoding_mask,DataValueEncodingByte.Value)) {
            dataValue.value.encode(stream);
        }

        // write statusCode
        if (check_flag(encoding_mask,DataValueEncodingByte.StatusCode)) {
            ec.encodeUInt32(dataValue.statusCode,stream);
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
    decode: function(dataValue,stream) {
        var encoding_mask = ec.decodeUInt8(stream);
        if( check_flag(encoding_mask,DataValueEncodingByte.Value)) {
            var Variant = require("./variant").Variant;
            dataValue.value = new Variant();
            dataValue.value.decode(stream);
        }
        // read statusCode
        if (check_flag(encoding_mask,DataValueEncodingByte.StatusCode)) {
            dataValue.statusCode  = ec.decodeUInt32(stream);
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
    }
};
var DataValue = exports.DataValue = factories.UAObjectFactoryBuild(DataValue_Description);

exports.DataValue = DataValue;
