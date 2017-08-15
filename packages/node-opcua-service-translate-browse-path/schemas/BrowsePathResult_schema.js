
var BrowsePathResult_Schema = {
    name: "BrowsePathResult",
    documentation: "The result of a translate operation.",
    fields: [
        { name: "statusCode", fieldType: "StatusCode", documentation: "A code indicating any error during the operation."},
        { name: "targets", isArray: true, fieldType: "BrowsePathTarget", documentation: "A list of nodes found. The first element matches the type definition." }
    ]
};
exports.BrowsePathResult_Schema = BrowsePathResult_Schema;
