require("requirish")._(module);
const factories = require("lib/misc/factories");
const AxisScaleEnumeration_Schema = {
  name:"AxisScaleEnumeration",
  enumValues: {
    Linear: 0,
    Log:    1,
    Ln:     2
  }
};
exports.AxisScaleEnumeration_Schema = AxisScaleEnumeration_Schema;
exports.AxisScale = factories.registerEnumeration(AxisScaleEnumeration_Schema);
