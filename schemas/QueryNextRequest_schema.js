

var QueryNextRequest_Schema = {
    name: "QueryNextRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
    /*=
     * A Boolean parameter with the following values:
     *      TRUE passed continuationPoint shall be reset to free resources for the continuation point in the Server.
     *      FALSE passed continuationPoint shall be used to get the next set of QueryDataSets.
     * A Client shall always use the continuation point returned by a QueryFirst or QueryNext response to free the
     * resources for the continuation point in the Server. If the Client does not want to get the next set of Query
     * information, QueryNext shall be called with this parameter set to TRUE
     * If the parameter is set to TRUE all array parameters in the response shall contain empty arrays.
     */
        { name:"releaseContinuationPoint",    fieldType:"Boolean"},
    /*=
     * Server defined opaque value that represents the continuation point. T
     * he value of the continuation point was returned to the Client in a previous QueryFirst or QueryNext response.
     * This value is used to identify the previously processed QueryFirst or QueryNext request that is being continued,
     * and the point in the result set from which the browse response is to continue.
     */
        { name:"continuationPoint",           fieldType:"ContinuationPoint"}
    ]
};
exports.QueryNextRequest_Schema = QueryNextRequest_Schema;
