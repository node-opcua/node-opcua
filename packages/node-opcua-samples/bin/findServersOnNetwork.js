const opcua = require("node-opcua");

const discovery_server_endpointUrl = "opc.tcp://localhost:4840";

opcua.perform_findServersOnNetwork(discovery_server_endpointUrl, function (err, servers) {
//opcua.perform_findServers(discovery_server_endpointUrl, function (err, servers) {
    for (const s of servers) {
        console.log(s.toString());
    }
});
