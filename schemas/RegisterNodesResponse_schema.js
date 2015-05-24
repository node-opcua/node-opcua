var RegisterNodesResponse_Schema = {
    documentation:" A standard header included in all responses returned by servers.",
    name: "RegisterNodesResponse",
    fields: [
        { name:"responseHeader",                          fieldType:"ResponseHeader",                 documentation: "A standard header included in all responses returned by servers."},

        // A list of NodeIds which the Client shall use for subsequent access operations. The
        // size and order of this list matches the size and order of the nodesToRegister
        // request parameter.
        // The Server may return the NodeId from the request or a new (an alias) NodeId. It
        // is recommended that the Server return a numeric NodeIds for aliasing.
        // In case no optimization is supported for a Node, the Server shall return the
        // NodeId from the request.
        { name:"registeredNodeIds",isArray:true,fieldType:"NodeId", documentation: "A list of NodeIds which the Client shall use for subsequent access operations. "}
    ]
};
exports.RegisterNodesResponse_Schema = RegisterNodesResponse_Schema;