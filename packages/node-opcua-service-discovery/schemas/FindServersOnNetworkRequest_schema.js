require("node-opcua-service-secure-channel");
require("node-opcua-data-model");

const FindServersOnNetworkRequest_Schema = {
    documentation:"Finds the servers known to the discovery server.",
    name: "FindServersOnNetworkRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"startingRecordId",            fieldType:"Counter",          documentation: "Only records with an identifier greater than this number will be returned. Specify 0 to start with the first record in the cache."},
        { name:"maxRecordsToReturn",    fieldType:"UInt32",        documentation: "The maximum number of records to return in the response.\n" +
            "0 indicates that there is no limit."},
        { name:"serverCapabilityFilter",   isArray:true,  fieldType:"String",         documentation: "List of Server capability filters. The set of allowed server capabilities\n" +
            "are defined in Part 12.\n" +
            "Only records with all of the specified server capabilities are\n" +
            "returned.\n" +
            "The comparison is case insensitive.\n" +
            "If this list is empty then no filtering is performed."}
    ]
};
exports.FindServersOnNetworkRequest_Schema = FindServersOnNetworkRequest_Schema;