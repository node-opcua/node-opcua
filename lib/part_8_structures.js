var factories= require("./factories");

EUInformation_Schema = {
    name:"EUInformation",
    fields: [
        {   name:"NamespaceUri", fieldType:"String"        },
        {   name:"unitId",       fieldType:"Int32"         },
        {   name:"displayName",  fieldType:"LocalizedText" },
        {   name:"description",  fieldType:"LocalizedText" }
    ]
};

exports.EUInformation = factories.registerObject(EUInformation_Schema);

Range_Schema = {
    name:"Range",
    id: factories.next_available_id(),
    fields: [
        { name: "low",        fieldType: "Double" },
        { name: "high",        fieldType: "Double" }
    ]
};
exports.Range = factories.registerObject(Range_Schema);

AxisScaleEnumeration_Schema = {
    name:"AxisInformation",
    isEnum: true,
    enumValues: {
        Linear: 0,
        Log:    1,
        Ln:     2
    }
};
exports.AxisScaleEnumeration = factories.registerObject(AxisScaleEnumeration_Schema);


AxisInformation_Schema = {
    name:"AxisInformation",
    id: factories.next_available_id(),
    fields: [
        { name: "engineeringUnits",        fieldType: "EUInformation" },
        { name: "EURange",                 fieldType: "Range" },
        { name: "title",                   fieldType: "LocalizedText" },
        { name: "axisScaleType",           fieldType: "AxisScaleEnumeration" },
        { name: "axisSteps", isArray:true, fieldType: "Double" }
    ]
};
exports.AxisInformation = factories.registerObject(AxisInformation_Schema);

