var QueryDataDescription_Schema = {
    name: "QueryDataDescription",
    fields: [
        {name: "relativePath",fieldType: "RelativePath",
            documentation: "Browse path relative to the originating Node that identifies the Node which contains the data that is being requested, where the originating Node is an instance Node of the type defined by the type definition Node. The instance Nodes are further limited by the filter provided as part of this call. "},
        {name: "attributeId",fieldType: "IntegerId",
            documentation: "Id of the Attribute. This shall be a valid Attribute Id. The IntegerId is defined in 7.14. The IntegerId for Attributes are defined in Part 6. If the RelativePath ended in a Reference then this parameter is 0 and ignored by the server."},
        {name: "indexRange",fieldType: "NumericRange",
            documentation: "This parameter is used to identify a single element of a structure or an array, or a single range of indexes for arrays. If a range of elements are specified, the values are returned as a composite. The first element is identified by index 0 (zero)."}

    ]
};
exports.QueryDataDescription_Schema = QueryDataDescription_Schema;
