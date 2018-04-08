"use strict";

const factories = require("node-opcua-factory");
const AxisScaleEnumeration_Schema = {
    name:"AxisScaleEnumeration",
    enumValues: {
        Linear: 0,
        Log:    1,
        Ln:     2
    }
};
exports.AxisScaleEnumeration_Schema =AxisScaleEnumeration_Schema;
exports.AxisScale = factories.registerEnumeration(AxisScaleEnumeration_Schema);
