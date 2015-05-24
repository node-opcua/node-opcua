"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var BrowseResult_Schema = {
    name: "BrowseResult",
    id: factories.next_available_id(),
    documentation: "The result of a browse operation.",
    fields: [
        { name: "statusCode", fieldType: "StatusCode", documentation: "A code indicating any error during the operation."},
        { name: "continuationPoint", fieldType: "ContinuationPoint", defaultValue: null, documentation: "A value that indicates the operation is incomplete and can be continued by calling BrowseNext."},
        { name: "references", isArray: true, fieldType: "ReferenceDescription", documentation: "A list of references that meet the criteria specified in the request."}
    ]
};
exports.BrowseResult_Schema = BrowseResult_Schema;


