//see part 4 5.8.4 TranslateBrowsePathsToNodeIds
// Translates one or more paths in the server address space.
var TranslateBrowsePathsToNodeIdsRequest_Schema = {
    name: "TranslateBrowsePathsToNodeIdsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "browsePath", isArray: true, fieldType: "BrowsePath", documentation: "The list of paths to translate."}
    ]
};
exports.TranslateBrowsePathsToNodeIdsRequest_Schema = TranslateBrowsePathsToNodeIdsRequest_Schema
