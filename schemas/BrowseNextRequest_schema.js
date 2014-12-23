

var BrowseNextRequest_Schema = {
    name: "BrowseNextRequest",
    documentation: "Continues one or more browse operations.",
    fields: [
        {name: "requestHeader", fieldType: "RequestHeader", documentation: "A standard header included in all requests sent to a server."},
        {name: "releaseContinuationPoints", fieldType: "Boolean", documentation: "If TRUE the continuation points are released and no results are returned." },
        {name: "continuationPoints", isArray: true, fieldType: "ContinuationPoint", documentation: "The maximum number of references to return in the response."}
    ]
};
exports.BrowseNextRequest_Schema = BrowseNextRequest_Schema;
