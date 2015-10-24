"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");
var AxisScaleEnumeration_Schema = {
    name:"AxisScaleEnumeration",
    enumValues: {
        Linear: 0,
        Log:    1,
        Ln:     2
    }
};
exports.AxisScaleEnumeration_Schema =AxisScaleEnumeration_Schema;
exports.AxisScale = factories.registerEnumeration(AxisScaleEnumeration_Schema);
