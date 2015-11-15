var AddReferencesItem_Schema = {
    name:"AddReferencesItem",
    fields: [
        { name: "sourceNodeId",      fieldType: "NodeId"},
        { name: "referenceTypeId",   fieldType: "NodeId"},
        { name: "isForward",         fieldType: "Boolean"},
        { name: "targetServerUri",   fieldType: "String"},
        { name: "targetNodeId",      fieldType: "ExpandedNodeId"},
        { name: "targetNodeClass",   fieldType: "NodeClass"}

    ]
};
exports.AddReferencesItem_Schema =AddReferencesItem_Schema;
