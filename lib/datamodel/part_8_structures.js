/**
 * @module opcua.datamodel
 */
var factories= require("./../misc/factories");

var EUInformation_Schema = {
    name:"EUInformation",
    fields: [
        {   name:"NamespaceUri", fieldType:"String"        },
        {   name:"unitId",       fieldType:"Int32"         },
        {   name:"displayName",  fieldType:"LocalizedText" },
        {   name:"description",  fieldType:"LocalizedText" }
    ]
};
exports.EUInformation_Schema = EUInformation_Schema;
exports.EUInformation = factories.registerObject(EUInformation_Schema);

var Range_Schema = {
    name:"Range",
    id: factories.next_available_id(),
    fields: [
        { name: "low",        fieldType: "Double" },
        { name: "high",        fieldType: "Double" }
    ]
};
exports.Range_Schema = Range_Schema;
exports.Range = factories.registerObject(Range_Schema);

var AxisScaleEnumeration_Schema = {
    name:"AxisScaleEnumeration",
    enumValues: {
        Linear: 0,
        Log:    1,
        Ln:     2
    }
};
exports.AxisScaleEnumeration_Schema =AxisScaleEnumeration_Schema;
exports.AxisScaleEnumeration = factories.registerEnumeration(AxisScaleEnumeration_Schema);


var AxisInformation_Schema = {
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
exports.AxisInformation_Schema =AxisInformation_Schema;
exports.AxisInformation = factories.registerObject(AxisInformation_Schema);

