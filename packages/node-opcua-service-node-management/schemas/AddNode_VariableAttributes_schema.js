var AddNodes_VariableAttributes_Schema = {
    name: "VariableAttributes",
    fields: [
        {
            name: "specifiedAttributes",
            fieldType: "UInt32",
            documentation: "A bit mask that indicates which fields contain valid values.A field shall be ignored if the corresponding bit is set to 0."
        },
        {name: "displayName",               fieldType: "LocalizedText"},
        {name: "description",               fieldType: "LocalizedText"},
        {name: "value",                     fieldType: "Any", description: "defined by the dataType Attribute"},
        {name: "dataType",                  fieldType: "NodeId"},
        {name: "valueRank",                 fieldType: "Int32"},
        {name: "arrayDimensions",           fieldType: "UInt32", isArray:true },
        {name: "accessLevel",               fieldType: "Byte"},
        {name: "userAccessLevel",           fieldType: "Byte"},
        {name: "minimumSamplingInterval",   fieldType: "Duration"},
        {name: "historizing",               fieldType: "Boolean"},
        {name: "writeMask",                 fieldType: "UInt32"},
        {name: "userWriteMask",             fieldType: "UInt32"},
    ]
};
exports.AddNodes_VariableAttributes_Schema = AddNodes_VariableAttributes_Schema;
