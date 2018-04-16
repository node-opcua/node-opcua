"use strict";

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");


const DataValue = exports.DataValue = require("../_generated_/_auto_generated_DataValue").DataValue;

const DataType = require("node-opcua-variant").DataType;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;


const TimestampsToReturn = require("../schemas/TimestampsToReturn_enum").TimestampsToReturn;


const registerSpecialVariantEncoder = require("node-opcua-factory").registerSpecialVariantEncoder;
registerSpecialVariantEncoder(exports.DataValue);

const getCurrentClock = require("node-opcua-date-time").getCurrentClock;

const Variant = require("node-opcua-variant").Variant;
const sameVariant = require("node-opcua-variant/src/variant_tools").sameVariant;

DataValue.prototype.toString = function () {
    let str = "DataValue:";
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
    const self = this;
    const tmp = new DataValue({
        serverTimestamp: self.serverTimestamp,
        sourceTimestamp: self.sourceTimestamp,
        serverPicoseconds: self.serverPicoseconds,
        sourcePicoseconds: self.sourcePicoseconds,
        statusCode: self.statusCode,
        value: self.value ? self.value.clone() : null
    });

    return tmp;
};


function _partial_clone(dataValue) {
    const cloneDataValue = new DataValue(null);
    cloneDataValue.value = dataValue.value;
    cloneDataValue.statusCode = dataValue.statusCode;
    return cloneDataValue;
}

function apply_timestamps(dataValue, timestampsToReturn, attributeId) {

    assert(attributeId > 0);
    assert(timestampsToReturn.hasOwnProperty("key"));
    assert(dataValue instanceof DataValue);
    assert(dataValue.hasOwnProperty("serverTimestamp"));
    assert(dataValue.hasOwnProperty("sourceTimestamp"));

    let cloneDataValue = null;
    let now = null;
    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Neither:
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            break;
        case TimestampsToReturn.Server:
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            if (!cloneDataValue.serverTimestamp) {
                now = now || getCurrentClock();
                cloneDataValue.serverTimestamp = now.timestamp;
                cloneDataValue.serverPicoseconds = now.picoseconds;
            }
            break;
        case TimestampsToReturn.Source:
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
        case TimestampsToReturn.Both:
            //xxif (false && attributeId !== 13 && dataValue.sourceTimestamp && dataValue.serverTimestamp) {
            //xx    return dataValue;
            //xx}
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            if (!cloneDataValue.serverTimestamp) {
                now = now || getCurrentClock();
                cloneDataValue.serverTimestamp = now.timestamp;
                cloneDataValue.serverPicoseconds = now.picoseconds;
            }
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
    }

    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== 13/*AttributeIds.Value*/) {
        cloneDataValue.sourceTimestamp = null;
    }
    return cloneDataValue;
}

function apply_timestamps2(dataValue, timestampsToReturn, attributeId) {

    assert(attributeId > 0);
    assert(timestampsToReturn.hasOwnProperty("key"));
    assert(dataValue instanceof DataValue);
    assert(dataValue.hasOwnProperty("serverTimestamp"));
    assert(dataValue.hasOwnProperty("sourceTimestamp"));

    const cloneDataValue = new DataValue({});
    cloneDataValue.value = dataValue.value;
    cloneDataValue.statusCode = dataValue.statusCode;

    const now = getCurrentClock();
    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Server:
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            //xxif (true || !cloneDataValue.serverTimestamp) {
                cloneDataValue.serverTimestamp = now.timestamp;
                cloneDataValue.serverPicoseconds = now.picoseconds;
            //xx}
            break;
        case TimestampsToReturn.Source:
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
        case TimestampsToReturn.Both:
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            //xxif (true || !cloneDataValue.serverTimestamp) {
                cloneDataValue.serverTimestamp = now.timestamp;
                cloneDataValue.serverPicoseconds = now.picoseconds;
            //xx}

            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
    }

    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== 13/*AttributeIds.Value*/) {
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

    const clonedDataValue = new DataValue({
        statusCode: result.statusCode,
        serverTimestamp: dataValue.serverTimestamp,
        serverPicoseconds: dataValue.serverPicoseconds,
        sourceTimestamp: dataValue.sourceTimestamp,
        sourcePicoseconds: dataValue.sourcePicoseconds,
        value: {
            dataType: DataType.Null
        }
    });
    clonedDataValue.value.dataType   = dataValue.value.dataType;
    clonedDataValue.value.arrayType  = dataValue.value.arrayType;
    clonedDataValue.value.dimensions = result.dimensions;
    clonedDataValue.value.value =result.array;
    return clonedDataValue;
}

function canRange(dataValue) {
    return dataValue.value && ((dataValue.value.arrayType !== VariantArrayType.Scalar) ||
        ((dataValue.value.arrayType === VariantArrayType.Scalar) && (dataValue.value.dataType === DataType.ByteString)) ||
        ((dataValue.value.arrayType === VariantArrayType.Scalar) && (dataValue.value.dataType === DataType.String)));
}


/**
 * return a deep copy of the dataValue by applying indexRange if necessary on  Array/Matrix
 * @param dataValue {DataValue}
 * @param indexRange {NumericalRange}
 * @return {DataValue}
 */
function extractRange(dataValue, indexRange) {

    const variant = dataValue.value;
    if (indexRange && canRange(dataValue)) {
        // let's extract an array of elements corresponding to the indexRange
        const result = indexRange.extract_values(variant.value, variant.dimensions);
        dataValue = _clone_with_array_replacement(dataValue, result);
        //xx console.log("         dataValue =",dataValue.toString());
    } else {
        // clone the whole data Value
        dataValue = dataValue.clone();
    }
    return dataValue;
}

exports.extractRange = extractRange;


function sameDate(date1, date2) {

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

    assert(dataValue1, "expecting valid dataValue1");
    assert(dataValue2, "expecting valid dataValue2");
    const hasChanged =
        !sameDate(dataValue1.sourceTimestamp, dataValue2.sourceTimestamp) ||
        (dataValue1.sourcePicoseconds !== dataValue2.sourcePicoseconds);
    return hasChanged;
}

exports.sourceTimestampHasChanged = sourceTimestampHasChanged;

function serverTimestampHasChanged(dataValue1, dataValue2) {
    assert(dataValue1, "expecting valid dataValue1");
    assert(dataValue2, "expecting valid dataValue2");
    const hasChanged =
        !sameDate(dataValue1.serverTimestamp, dataValue2.serverTimestamp) ||
        (dataValue1.serverPicoseconds !== dataValue2.serverPicoseconds);
    return hasChanged;
}

exports.serverTimestampHasChanged = serverTimestampHasChanged;

function timestampHasChanged(dataValue1, dataValue2, timestampsToReturn) {

//TODO:    timestampsToReturn = timestampsToReturn || { key: "Neither"};
    if (!timestampsToReturn) {
        return sourceTimestampHasChanged(dataValue1, dataValue2) || serverTimestampHasChanged(dataValue1, dataValue2);
    }
    switch (timestampsToReturn.key) {
        case "Neither":
            return false;
        case "Both":
            return sourceTimestampHasChanged(dataValue1, dataValue2) || serverTimestampHasChanged(dataValue1, dataValue2);
        case "Source":
            return sourceTimestampHasChanged(dataValue1, dataValue2);
        default:
            assert(timestampsToReturn.key === "Server");
            return serverTimestampHasChanged(dataValue1, dataValue2);
    }
//    return sourceTimestampHasChanged(dataValue1,dataValue2) || serverTimestampHasChanged(dataValue1,dataValue2);
}

exports.timestampHasChanged = timestampHasChanged;


/**
 * @method sameDataValue
 * @param v1 {DataValue}
 * @param v2 {DataValue}
 * @param [timestampsToReturn {TimestampsToReturn}]
 * @return {boolean} true if data values are identical
 */
function sameDataValue(v1, v2, timestampsToReturn) {

    if (v1 === v2) {
        return true;
    }
    if (v1 && !v2) {
        return false;
    }
    if (v2 && !v1) {
        return false;
    }
    if (v1.statusCode !== v2.statusCode) {
        return false;
    }
    //
    // For performance reason, sourceTimestamp is
    // used to determine if a dataValue has changed.
    // if sourceTimestamp and sourcePicoseconds are identical
    // then we make the assumption that Variant value is identical too.
    // This will prevent us to deep compare potential large arrays.
    // but before this is possible, we need to implement a mechanism
    // that ensure that date() is always strictly increasing
    if ((v1.sourceTimestamp && v2.sourceTimestamp) && !sourceTimestampHasChanged(v1, v2)) {
        return true;
    }
    if (timestampHasChanged(v1, v2, timestampsToReturn)) {
        return false;
    }

    return sameVariant(v1.value, v2.value);
}

exports.sameDataValue = sameDataValue;
