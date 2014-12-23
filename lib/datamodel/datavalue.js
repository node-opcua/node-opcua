
var factories = require("./../misc/factories");


var Variant = require("./variant").Variant;
var assert = require("better-assert");
var _ = require("underscore");


exports.DataValue = require("../../_generated_/_auto_generated_DataValue").DataValue;



require("./variant").registerSpecialVariantEncoder(exports.DataValue);

exports.DataValue.prototype.toString = function()
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

