var DeleteReferencesItem_Schema = {
    name:"DeleteReferencesItem",
    fields: [
        { name: "sourceNodeId" ,           fieldType: "NodeId", documentation: ""},
        { name: "referenceNodeId" ,        fieldType: "NodeId", documentation: ""},
        { name: "isForward" ,              fieldType: "Boolean", documentation: ""},
        { name: "targetNodeId" ,           fieldType: "ExpandedNodeId"        , documentation: ""},
        { name: "deleteBidirectional" ,    fieldType: "Boolean"        , documentation: ""},

    ]
};
exports.DeleteReferencesItem_Schema =DeleteReferencesItem_Schema;
