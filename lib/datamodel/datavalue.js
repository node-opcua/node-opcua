"use strict";
require("requirish")._(module);

var registerSpecialVariantEncoder = require("lib/datamodel/variant").registerSpecialVariantEncoder;
exports.DataValue = require("_generated_/_auto_generated_DataValue").DataValue;
registerSpecialVariantEncoder(exports.DataValue);

exports.DataValue.prototype.toString = function()
{
    var Variant = require("lib/datamodel/variant").Variant;
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

