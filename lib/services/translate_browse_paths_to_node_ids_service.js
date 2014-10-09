var factories = require("./../misc/factories");


var RelativePathElement_Schema = {
    name: "RelativePathElement",
    documentation: "An element in a relative path.",
    fields: [
        { name: "referenceTypeId", fieldType: "NodeId", documentation: "The type of reference to follow." },
        { name: "isInverse", fieldType: "Boolean", documentation: "If TRUE the reverse reference is followed." },
        { name: "includeSubtypes", fieldType: "Boolean", documentation: "If TRUE then subtypes of the reference type are followed." },
        { name: "targetName", fieldType: "QualifiedName", documentation: "The browse name of the target." }
    ]
};
exports.RelativePathElement_Schema = RelativePathElement_Schema;
exports.RelativePathElement = factories.registerObject(RelativePathElement_Schema);


var RelativePath_Schema = {
    name: "RelativePath",
    fields: [
        { name: "elements", isArray: true, fieldType: "RelativePathElement" }
    ]
};
exports.RelativePath_Schema = RelativePath_Schema;
exports.RelativePath = factories.registerObject(RelativePath_Schema);

var BrowsePath_Schema = {
    name: "BrowsePath",
    fields: [
        { name: "startingNode", fieldType: "NodeId" },
        { name: "relativePath", fieldType: "RelativePath" }
    ]
};
exports.BrowsePath_Schema = BrowsePath_Schema;
exports.BrowsePath = factories.registerObject(BrowsePath_Schema);

//see part 4 5.8.4 TranslateBrowsePathsToNodeIds
// Translates one or more paths in the server address space.
var TranslateBrowsePathsToNodeIdsRequest_Schema = {
    name: "TranslateBrowsePathsToNodeIdsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "browsePath", isArray: true, fieldType: "BrowsePath", documentation: "The list of paths to translate."}
    ]
};
exports.TranslateBrowsePathsToNodeIdsRequest_Schema = TranslateBrowsePathsToNodeIdsRequest_Schema;
exports.TranslateBrowsePathsToNodeIdsRequest = factories.registerObject(TranslateBrowsePathsToNodeIdsRequest_Schema);


var BrowsePathTarget_Schema = {
    name: "BrowsePathTarget",
    documentation: "The target of the translated path.",
    fields: [
        { name: "targetId", fieldType: "ExpandedNodeId", documentation: "The id of the target node."},
        { name: "remainingPathIndex", fieldType: "UInt32", documentation: "The index of the target in the relative path. UInt32.MaxValue if the entire path was processed." }
    ]
};
exports.BrowsePathTarget_Schema = BrowsePathTarget_Schema;
exports.BrowsePathTarget = factories.registerObject(BrowsePathTarget_Schema);

var BrowsePathResult_Schema = {
    name: "BrowsePathResult",
    documentation: "The result of a translate operation.",
    fields: [
        { name: "statusCode", fieldType: "StatusCode", documentation: "A code indicating any error during the operation."},
        { name: "targets", isArray: true, fieldType: "BrowsePathTarget", documentation: "A list of nodes found. The first element matches the type definition." }
    ]
};
exports.BrowsePathResult_Schema = BrowsePathResult_Schema;
exports.BrowsePathResult = factories.registerObject(BrowsePathResult_Schema);

var TranslateBrowsePathsToNodeIdsResponse_Schema = {
    name: "TranslateBrowsePathsToNodeIdsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "BrowsePathResult", documentation: "The results for the translate operations." },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo", documentation: "The diagnostics associated with the results." }
    ]
};
exports.TranslateBrowsePathsToNodeIdsResponse_Schema = TranslateBrowsePathsToNodeIdsResponse_Schema;
exports.TranslateBrowsePathsToNodeIdsResponse = factories.registerObject(TranslateBrowsePathsToNodeIdsResponse_Schema);
