import { registerEnumeration } from "lib/misc/factories";
const AxisScaleEnumeration_Schema = {
  name:"AxisScaleEnumeration",
  enumValues: {
    Linear: 0,
    Log:    1,
    Ln:     2
  }
};
const AxisScale = registerEnumeration(AxisScaleEnumeration_Schema);
export {
  AxisScaleEnumeration_Schema,
  AxisScale
};
