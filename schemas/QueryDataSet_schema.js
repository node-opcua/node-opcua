
var QueryDataSet_Schema = {
    documentation:"Data related to a Node returned in a Query response.",
    name:"QueryDataSet",
    fields: [

    /**
     * The NodeId for this Node description.
     */
     {name: "nodeId", fieldType:"ExpandedNodeId"},

    /**
     * The NodeId for the type definition for this Node description.
     */
     {name: "typeDefinitionNode", fieldType:"ExpandedNodeId"},
    /**
     * Values for the selected Attributes. The order of returned items matches the order of the requested items.
     * There is an entry for each requested item for the given TypeDefinitionNode that matches the selected instance,
     * this includes any related nodes that were specified using a relative path from the selected instance’s
     * TypeDefinitionNode. If no values where found for a given requested item a null value is returned for that item.
     * If a value has a bad status, the StatusCode is returned instead of the value. If multiple values exist for a requested
     * item then an array of values is returned. If the requested item is a reference then a ReferenceDescription or array of
     * ReferenceDescription is returned for that item.
     * If the QueryDataSet is returned in a QueryNext to continue a list of ReferenceDescription, the values array will have
     * the same size but the other values already returned are null.
     */
        {name: "values", isArray: true, fieldType:"Variant" },
    ]
};
exports.QueryDataSet_Schema = QueryDataSet_Schema;
