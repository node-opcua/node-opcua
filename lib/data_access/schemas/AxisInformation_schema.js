//TODO
// OPC Unified Architecture, Part 8 18 Release 1.02

var AxisScale = require("./AxisScale_enum").AxisScale;

// engineeringUnits EUInformation           Holds the information about the engineering units for a given axis.
// euRange          Range                   Limits of the range of the axis
// title            LocalizedText           User readable axis title, useful when the units are %, the Title may be “Particle size distribution"
// axisScaleType    AxisScaleEnumeration    LINEAR, LOG, LN, defined by AxisSteps
// axisSteps        Double[]                Specific value of each axis steps, may be set to “Null” if not used
var AxisInformation_Schema = {
    name: "AxisInformation",
    fields: [
        {
            name: "engineeringUnits",
            fieldType: "EUInformation",
            documentation: "Holds the information about the engineering units for a given axis."
        },
        {
            name: "euRange",
            fieldType: "Range",
            documentation: "Limits of the range of the axis"
        },
        {
            name: "title",
            fieldType: "LocalizedText",
            documentation: "User readable axis title, useful when the units are %, the Title may be “Particle size"
        },
        {
            name: "axisScaleType",
            fieldType: "AxisScaleEnumeration",
            documentation: "LINEAR, LOG, LN, defined by AxisSteps"
        },
        {
            name: "axisSteps",
            fieldType: "Double",
            defaultValue: null,
            isArray: true,
            documentation: "Specific value of each axis steps, may be set to “Null” if not used"
        }
    ]
};
exports.AxisInformation_Schema = AxisInformation_Schema;
