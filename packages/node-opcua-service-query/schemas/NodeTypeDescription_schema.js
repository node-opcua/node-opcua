var NodeTypeDescription_Schema = {
    name: "NodeTypeDescription",
    fields: [
        {name: "typeDefinitionNode",fieldType: "ExpandedNodeId",
            documentation: "NodeId of the originating TypeDefinitionNode of the instances for which data is to be returned."},
        {name: "includeSubtypes",fieldType: "Boolean",
            documentation: "A flag that indicates whether the Server should include instances of subtypes of the TypeDefinitionNode in the list of instances of the Node type."},
        {name: "dataToReturn", isArray:true,fieldType:"QueryDataDescription",
            documentation: "Specifies an Attribute or Reference from the originating typeDefinitionNode along a given relativePath for which to return data. This structure is defined in-line with the following indented items."},
    ]
};
exports.NodeTypeDescription_Schema = NodeTypeDescription_Schema;
