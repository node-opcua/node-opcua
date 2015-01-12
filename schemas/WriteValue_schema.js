require("requirish")._(module);
require("lib/datamodel/numeric_range");

var WriteValue_Schema = {
    name: "WriteValue",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId"}, // see AttributeIds
        { name: "indexRange" ,   fieldType: "NumericRange"},
        { name: "value",         fieldType: "DataValue"}
    ]
};
exports.WriteValue_Schema = WriteValue_Schema;
