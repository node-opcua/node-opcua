"use strict";

var factories = require("node-opcua-factory");
var DataValueEncodingByte_Schema = {
    name:"DataValue_EncodingByte",
    enumValues: {
        Value:              0x01,
        StatusCode:         0x02,
        SourceTimestamp:    0x04,
        ServerTimestamp:    0x08,
        SourcePicoseconds:  0x10,
        ServerPicoseconds:  0x20
    }
};
exports.DataValueEncodingByte_Schema = DataValueEncodingByte_Schema;
exports.DataValueEncodingByte = factories.registerEnumeration(DataValueEncodingByte_Schema);
