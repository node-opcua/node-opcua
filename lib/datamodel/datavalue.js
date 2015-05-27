"use strict";
require("requirish")._(module);

var registerSpecialVariantEncoder = require("lib/datamodel/variant").registerSpecialVariantEncoder;
var DataValue = exports.DataValue = require("_generated_/_auto_generated_DataValue").DataValue;
var TimestampsToReturn = require("schemas/TimestampsToReturn_enum").TimestampsToReturn;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

registerSpecialVariantEncoder(exports.DataValue);

exports.DataValue.prototype.toString = function()
{
    var Variant = require("lib/datamodel/variant").Variant;
    var str = "DataValue:";
    if (this.value) {
        str += "\n   value:           " + Variant.prototype.toString.apply(this.value);//this.value.toString();
    } else {
        str += "\n   value:            <null>";
    }
        str += "\n   statusCode:      " + (this.statusCode ? this.statusCode.toString() : "null");
        str += "\n   serverTimestamp: " + (this.serverTimestamp ? this.serverTimestamp.toISOString()  + " $ " + this.serverPicoseconds : "null");//+ "  " + (this.serverTimestamp ? this.serverTimestamp.getTime() :"-");
        str += "\n   sourceTimestamp: " + (this.sourceTimestamp ? this.sourceTimestamp.toISOString()  + " $ " + this.sourcePicoseconds : "null");// + "  " + (this.sourceTimestamp ? this.sourceTimestamp.getTime() :"-");
    return str;
};


function apply_timestamps(dataValue, timestampsToReturn, attributeId) {

    assert(attributeId >0);
    assert(timestampsToReturn.hasOwnProperty("key"));
    assert(dataValue instanceof DataValue);
    assert(dataValue.hasOwnProperty("serverTimestamp"));
    assert(dataValue.hasOwnProperty("sourceTimestamp"));

    var cloneDataValue = new DataValue({});
    cloneDataValue.value = dataValue.value;
    cloneDataValue.statusCode = dataValue.statusCode;

    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Server:
            cloneDataValue.serverTimestamp   = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            break;
        case TimestampsToReturn.Source:
            cloneDataValue.sourceTimestamp   = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
        case TimestampsToReturn.Both:
            cloneDataValue.serverTimestamp   = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;

            cloneDataValue.sourceTimestamp   = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
    }

    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== AttributeIds.Value) {
        cloneDataValue.sourceTimestamp = null;
    }
    return cloneDataValue;
}
exports.apply_timestamps = apply_timestamps;
