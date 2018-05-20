require("node-opcua-service-secure-channel");
require("node-opcua-data-model");

const FindServersOnNetworkResponse_Schema = {
    documentation:" A standard header included in all responses returned by servers.",
    name: "FindServersOnNetworkResponse",
    fields: [
        { name:"responseHeader",                           fieldType:"ResponseHeader",                 documentation: "A standard header included in all responses returned by servers."},
        { name:"lastCounterResetTime" , fieldType:"UtcTime", documentation:"The last time the counters were reset."},
        { name:"servers",    isArray:true,                 fieldType:"ServerOnNetwork",         documentation: "The servers that met the criteria specified in the request."}
    ]
};
exports.FindServersOnNetworkResponse_Schema = FindServersOnNetworkResponse_Schema;
