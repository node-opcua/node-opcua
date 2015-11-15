var AddNodes_MethodAttributes_Schema = {
    name: "AddNodes_MethodAttributes",
    fields: [
        {
            name: "specifiedAttributes",
            fieldType: "UInt32",
            documentation: "A bit mask that indicates which fields contain valid values.A field shall be ignored if the corresponding bit is set to 0."
        },
        {name: "displayName",   fieldType: "LocalizedText"},
        {name: "description",   fieldType: "LocalizedText"},
        {name: "executable",    fieldType: "Boolean"},
        {name: "userExecutable",fieldType: "Boolean"},
        {name: "writeMask",     fieldType: "UInt32"},
        {name: "userWriteMask", fieldType: "UInt32"},
    ]
};
exports.AddNodes_MethodAttributes_Schema = AddNodes_MethodAttributes_Schema;
