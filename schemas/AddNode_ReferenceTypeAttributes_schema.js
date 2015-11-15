var AddNodes_ReferenceTypeAttributes_Schema = {
    name: "ReferenceTypeAttributes",
    fields: [
        {
            name: "specifiedAttributes",
            fieldType: "UInt32",
            documentation: "A bit mask that indicates which fields contain valid values.A field shall be ignored if the corresponding bit is set to 0."
        },
        {name: "displayName",   fieldType: "LocalizedText"},
        {name: "description",   fieldType: "LocalizedText"},
        {name: "isAbstract",    fieldType: "Boolean"},
        {name: "symmetric" ,    fieldType: "Boolean"},
        {name: "inverseName",   fieldType: "LocalizedText"},
        {name: "writeMask",     fieldType: "UInt32"},
        {name: "userWriteMask", fieldType: "UInt32"}
    ]
};
exports.AddNodes_ReferenceTypeAttributes_Schema = AddNodes_ReferenceTypeAttributes_Schema;
