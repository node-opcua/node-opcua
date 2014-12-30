require("requirish")._(module);

var factories = require("lib/misc/factories");

var Variant = require("lib/datamodel/variant").Variant;
var registerSpecialVariantEncoder = require("lib/datamodel/variant").registerSpecialVariantEncoder;

var assert = require("better-assert");
var _ = require("underscore");

exports.DataValue = require("_generated_/_auto_generated_DataValue").DataValue;
registerSpecialVariantEncoder(exports.DataValue);

exports.DataValue.prototype.toString = function()
{
    var Variant = require("lib/datamodel/variant").Variant;
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

