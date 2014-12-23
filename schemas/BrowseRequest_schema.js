var BrowseRequest_Schema = {
    name: "BrowseRequest",
    documentation: "Browse the references for one or more nodes from the server address space.",
    fields: [
        {name: "requestHeader", fieldType: "RequestHeader", documentation: "A standard header included in all requests sent to a server."},
        {name: "view", fieldType: "ViewDescription", documentation: "The view to browse." },
        {name: "requestedMaxReferencesPerNode", fieldType: "Counter", documentation: "The maximum number of references to return in the response."},
        {name: "nodesToBrowse", isArray: true, fieldType: "BrowseDescription", documentation: "The list of nodes to browse."  }
    ]
};
exports.BrowseRequest_Schema = BrowseRequest_Schema;