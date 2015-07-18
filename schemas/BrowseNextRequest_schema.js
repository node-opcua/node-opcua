

var BrowseNextRequest_Schema = {
    name: "BrowseNextRequest",
    documentation: "Continues one or more browse operations.",
    fields: [
        {name: "requestHeader", fieldType: "RequestHeader", documentation: "A standard header included in all requests sent to a server."},
        /*
         *
         * A Boolean parameter with the following values:
         *   TRUE:   passed continuationPoints shall be reset to free resources in the Server. The continuation points
         *           are released and the results and diagnosticInfos arrays are empty.
         *   FALSE:  passed continuationPoints shall be used to get the next set of browse information.
         *
         * A Client shall always use the continuation point returned by a Browse or
         * BrowseNext response to free the resources for the continuation point in the
         * Server. If the Client does not want to get the next set of browse information,
         * BrowseNext shall be called with this parameter set to TRUE.
         */
        {name: "releaseContinuationPoints", fieldType: "Boolean", documentation: "If TRUE the continuation points are released and no results are returned." },
        /*
         * A list of Server-defined opaque values that represent continuation points. The value for a continuation point
         * was returned to the Client in a previous Browse or BrowseNext response. These values are used to identify the
         * previously processed Browse or BrowseNext request that is being continued and the point in the result set
         * from which the browse response is to continue
         * Clients may mix continuation points from different Browse or BrowseNext responses.
         */
        {name: "continuationPoints", isArray: true, fieldType: "ContinuationPoint", documentation: "The maximum number of references to return in the response."}
    ]
};
exports.BrowseNextRequest_Schema = BrowseNextRequest_Schema;
