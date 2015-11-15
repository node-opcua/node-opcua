var AddNodesItem_Schema = {
    name:"AddNodesItem",
    fields: [
        { name: "parentNodeId" ,       fieldType: "ExpandedNodeId", documentation: "ExpandedNodeId of the parent Node for the Reference."},
        { name: "referenceTypeId" ,    fieldType: "NodeId"        , documentation: "NodeId of the hierarchical ReferenceType to use for the Reference from the parent Node to the new Node."},

    /**
     * Client requested expanded NodeId of the Node to add. The serverIndex in the expanded NodeId shall be 0.
     * If the Server cannot use this NodeId, it rejects this Node and returns the appropriate error code.
     * If the Client does not want to request a NodeId, then it sets the value of this parameter to the null
     * expanded NodeId.
     * If the Node to add is a ReferenceType Node, its NodeId should be a numeric id.
     *
     */
        { name: "requestedNewNodeId" , fieldType: "ExpandedNodeId"},
        { name: "browseName",          fieldType: "QualifiedName"},
        { name: "nodeClass",           fieldType: "NodeClass"},
        { name: "nodeAttributes",      fieldType: "ExtensionObject"},
        { name: "typeDefinition",      fieldType: "ExpandedNodeId"}

    ]
};
exports.AddNodesItem_Schema =AddNodesItem_Schema;
