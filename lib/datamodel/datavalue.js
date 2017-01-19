import assert from "better-assert";
import _ from "underscore";
import { registerSpecialVariantEncoder } from "lib/datamodel/variant";
import { DataValue } from "_generated_/_auto_generated_DataValue";
import { DataType } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { TimestampsToReturn } from "schemas/TimestampsToReturn_enum";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { NumericRange } from "lib/datamodel/numeric_range";
import { sameVariant } from "./variant_tools";


registerSpecialVariantEncoder(DataValue);

DataValue.prototype.toString = function () {
  const Variant = require("lib/datamodel/variant").Variant;
  let str = "DataValue:";
  if (this.value) {
    str += `\n   value:           ${Variant.prototype.toString.apply(this.value)}`;// this.value.toString();
  } else {
    str += "\n   value:            <null>";
  }
  str += `\n   statusCode:      ${this.statusCode ? this.statusCode.toString() : "null"}`;
  str += `\n   serverTimestamp: ${this.serverTimestamp ? `${this.serverTimestamp.toISOString()} $ ${this.serverPicoseconds}` : "null"}`;// + "  " + (this.serverTimestamp ? this.serverTimestamp.getTime() :"-");
  str += `\n   sourceTimestamp: ${this.sourceTimestamp ? `${this.sourceTimestamp.toISOString()} $ ${this.sourcePicoseconds}` : "null"}`;// + "  " + (this.sourceTimestamp ? this.sourceTimestamp.getTime() :"-");
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

  const cloneDataValue = new DataValue({});
  cloneDataValue.value = dataValue.value;
  cloneDataValue.statusCode = dataValue.statusCode;

    // apply timestamps
  switch (timestampsToReturn) {
    case TimestampsToReturn.Server:
      cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
      cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
      if (!cloneDataValue.serverTimestamp) {
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
      if (!cloneDataValue.serverTimestamp) {
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

function canRange(dataValue) {
  return dataValue.value && ((dataValue.value.arrayType !== VariantArrayType.Scalar) ||
        ((dataValue.value.arrayType === VariantArrayType.Scalar) && (dataValue.value.dataType === DataType.ByteString)) ||
        ((dataValue.value.arrayType === VariantArrayType.Scalar) && (dataValue.value.dataType === DataType.String)));
}


function extractRange(dataValue, indexRange) {
    // xx console.log("xxxxxxx indexRange =".yellow,indexRange ? indexRange.toString():"<null>") ;
    // xx console.log("         dataValue =",dataValue.toString());
    // xx console.log("         can Range =", canRange(dataValue));
  const variant = dataValue.value;
  if (indexRange && canRange(dataValue)) {
    const result = indexRange.extract_values(variant.value);
    dataValue = _clone_with_array_replacement(dataValue, result);
        // xx console.log("         dataValue =",dataValue.toString());
  } else {
        // clone the whole data Value
    dataValue = new DataValue(dataValue);
  }
  return dataValue;
}


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
  const hasChanged =
        !sameDate(dataValue1.sourceTimestamp, dataValue2.sourceTimestamp) ||
        (dataValue1.sourcePicoseconds !== dataValue2.sourcePicoseconds);
  return hasChanged;
}

function serverTimestampHasChanged(dataValue1, dataValue2) {
  assert(dataValue1,"expecting valid dataValue1");
  assert(dataValue2,"expecting valid dataValue2");
  const hasChanged =
        !sameDate(dataValue1.serverTimestamp ,dataValue2.serverTimestamp) ||
        (dataValue1.serverPicoseconds !== dataValue2.serverPicoseconds);
  return hasChanged;
}

function timestampHasChanged(dataValue1, dataValue2,timestampsToReturn) {
// TODO:    timestampsToReturn = timestampsToReturn || { key: "Neither"};
  if (!timestampsToReturn) {
    return sourceTimestampHasChanged(dataValue1,dataValue2) || serverTimestampHasChanged(dataValue1,dataValue2);
  }
  switch (timestampsToReturn.key) {
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
export {
  sameDataValue,
  DataValue,
  apply_timestamps,
  extractRange,
  sourceTimestampHasChanged,
  serverTimestampHasChanged,
  timestampHasChanged
};
