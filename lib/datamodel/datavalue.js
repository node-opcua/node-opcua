"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var _ =require("underscore");

var registerSpecialVariantEncoder = require("lib/datamodel/variant").registerSpecialVariantEncoder;
var DataValue = exports.DataValue = require("_generated_/_auto_generated_DataValue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var TimestampsToReturn = require("schemas/TimestampsToReturn_enum").TimestampsToReturn;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

registerSpecialVariantEncoder(exports.DataValue);

DataValue.prototype.toString = function () {
    var Variant = require("lib/datamodel/variant").Variant;
    var str = "DataValue:";
    if (this.value) {
        str += "\n   value:           " + Variant.prototype.toString.apply(this.value);//this.value.toString();
    } else {
        str += "\n   value:            <null>";
    }
    str += "\n   statusCode:      " + (this.statusCode ? this.statusCode.toString() : "null");
    str += "\n   serverTimestamp: " + (this.serverTimestamp ? this.serverTimestamp.toISOString() + " $ " + this.serverPicoseconds : "null");//+ "  " + (this.serverTimestamp ? this.serverTimestamp.getTime() :"-");
    str += "\n   sourceTimestamp: " + (this.sourceTimestamp ? this.sourceTimestamp.toISOString() + " $ " + this.sourcePicoseconds : "null");// + "  " + (this.sourceTimestamp ? this.sourceTimestamp.getTime() :"-");
    return str;
};

DataValue.prototype.clone = function () {
    var self = this;
    var tmp = new DataValue({
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

    assert(attributeId > 0);
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
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            if (true || !cloneDataValue.serverTimestamp ) {
                cloneDataValue.serverTimestamp = new Date();
            }
            break;
        case TimestampsToReturn.Source:
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
        case TimestampsToReturn.Both:
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            if (true || !cloneDataValue.serverTimestamp ) {
                cloneDataValue.serverTimestamp = new Date();
            }

            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
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
 * @method _clone_with_array_replacement
 * @param dataValue
 * @param result
 * @return {DataValue}
 * @private
 * @static
 */
function _clone_with_array_replacement(dataValue, result) {

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
        dataValue = _clone_with_array_replacement(dataValue, result);
        //xx console.log("         dataValue =",dataValue.toString());
    } else {
        // clone the whole data Value
        dataValue =new DataValue(dataValue);
    }
    return dataValue;
}
exports.extractRange = extractRange;


function sameDate(date1,date2) {

    if (date1 === date2) {
        return true;
    }
    if (date1 && !date2) {
        return false;
    }
    if (!date1 && date2) {
        return false;
    }
    return date1.getTime() === date2.getTime();
}

function sourceTimestampHasChanged(dataValue1, dataValue2) {

    assert(dataValue1,"expecting valid dataValue1");
    assert(dataValue2,"expecting valid dataValue2");
    var hasChanged =
        !sameDate(dataValue1.sourceTimestamp, dataValue2.sourceTimestamp )||
        (dataValue1.sourcePicoseconds !== dataValue2.sourcePicoseconds);
    return hasChanged;
}
exports.sourceTimestampHasChanged = sourceTimestampHasChanged;

function serverTimestampHasChanged(dataValue1, dataValue2) {
    assert(dataValue1,"expecting valid dataValue1");
    assert(dataValue2,"expecting valid dataValue2");
    var hasChanged =
        !sameDate(dataValue1.serverTimestamp ,dataValue2.serverTimestamp) ||
        (dataValue1.serverPicoseconds !== dataValue2.serverPicoseconds);
    return hasChanged;
}
exports.serverTimestampHasChanged = serverTimestampHasChanged;

function timestampHasChanged(dataValue1, dataValue2,timestampsToReturn) {

//TODO:    timestampsToReturn = timestampsToReturn || { key: "Neither"};
    if (!timestampsToReturn) {
        return sourceTimestampHasChanged(dataValue1,dataValue2) || serverTimestampHasChanged(dataValue1,dataValue2);
    }
    switch(timestampsToReturn.key) {
        case "Neither":
            return false;
        case "Both":
            return sourceTimestampHasChanged(dataValue1,dataValue2) || serverTimestampHasChanged(dataValue1,dataValue2);
            break;
        case "Source":
            return sourceTimestampHasChanged(dataValue1,dataValue2);
        default:
            assert(timestampsToReturn.key === "Server");
            return serverTimestampHasChanged(dataValue1,dataValue2);
    }
//    return sourceTimestampHasChanged(dataValue1,dataValue2) || serverTimestampHasChanged(dataValue1,dataValue2);
}
exports.timestampHasChanged = timestampHasChanged;


var sameVariant = require("./variant_tools").sameVariant;
/**
 *
 * @param v1 {DataValue}
 * @param v2 {DataValue}
 * @param [timestampsToReturn {TimestampsToReturn}]
 * @return {boolean} true if data values are identical
 */
function sameDataValue(v1, v2,timestampsToReturn) {

    if (v1 === v2) {
        return true;
    }
    if (v1 && !v2) {
        return false;
    }
    if (v2 && !v1) {
        return false;
    }
    if (timestampHasChanged(v1,v2,timestampsToReturn)) {
        return false;
    }
    if (v1.statusCode !== v2.statusCode) {
        return false;
    }
    return sameVariant(v1.value, v2.value);
}
exports.sameDataValue = sameDataValue;
