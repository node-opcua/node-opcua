"use strict";
require("requirish")._(module);

var registerSpecialVariantEncoder = require("lib/datamodel/variant").registerSpecialVariantEncoder;
var DataValue = exports.DataValue = require("_generated_/_auto_generated_DataValue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var TimestampsToReturn = require("schemas/TimestampsToReturn_enum").TimestampsToReturn;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

registerSpecialVariantEncoder(exports.DataValue);

DataValue.prototype.toString = function()
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

DataValue.prototype.clone = function()
{
    var self  = this;
    var tmp= new DataValue({
        serverTimestamp: self.serverTimestamp,
        sourceTimestamp: self.sourceTimestamp,
        serverPicoseconds: self.serverPicoseconds,
        sourcePicoseconds: self.sourcePicoseconds,
        statusCode: self.statusCode,
        value: {
            dataType: self.value.dataType,
            arrayType: self.value.arrayType,
            value: self.value.value
        }
    });

    return tmp;
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

/*
 * @method clone_with_array_replacement
 * @param dataValue
 * @param result
 * @return {DataValue}
 * @private
 * @static
 */
function clone_with_array_replacement(dataValue, result) {

    return new DataValue({
        statusCode: result.statusCode,
        serverTimestamp: dataValue.serverTimestamp,
        serverPicoseconds: dataValue.serverPicoseconds,
        sourceTimestamp: dataValue.sourceTimestamp,
        sourcePicoseconds: dataValue.sourcePicoseconds,
        value: {
            dataType: dataValue.value.dataType,
            arrayType: dataValue.value.arrayType,
            value: result.array
        }
    });
}
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

function canRange(dataValue) {
    return dataValue.value && (( dataValue.value.arrayType !== VariantArrayType.Scalar ) ||
        ( (dataValue.value.arrayType === VariantArrayType.Scalar) && (dataValue.value.dataType === DataType.ByteString) ) ||
        ( (dataValue.value.arrayType === VariantArrayType.Scalar) && (dataValue.value.dataType === DataType.String) ));
}
function extractRange(dataValue, indexRange) {

    //xx console.log("xxxxxxx indexRange =".yellow,indexRange ? indexRange.toString():"<null>") ;
    //xx console.log("         dataValue =",dataValue.toString());
    //xx console.log("         can Range =", canRange(dataValue));
    var variant = dataValue.value;
    if (indexRange && canRange(dataValue)) {
        var result = indexRange.extract_values(variant.value);
        dataValue = clone_with_array_replacement(dataValue, result);
        //xx console.log("         dataValue =",dataValue.toString());
    }
    return dataValue;
}
exports.extractRange = extractRange;