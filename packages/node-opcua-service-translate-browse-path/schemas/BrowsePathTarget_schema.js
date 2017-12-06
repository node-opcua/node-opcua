
var BrowsePathTarget_Schema = {
    name: "BrowsePathTarget",
    documentation: "The target of the translated path.",
    fields: [
        { name: "targetId", fieldType: "ExpandedNodeId", documentation: "The id of the target node."},
        { name: "remainingPathIndex", fieldType: "UInt32", documentation: "The index of the target in the relative path. UInt32.MaxValue if the entire path was processed." }
    ]
};
exports.BrowsePathTarget_Schema = BrowsePathTarget_Schema;