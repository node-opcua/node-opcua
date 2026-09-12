const opcua = require("node-opcua");


const commandLineArgs = require("command-line-args");

const argv = commandLineArgs([
    { name: "capabilities", alias: "c", type: String, defaultValue: "DA" },
    { name: "discoveryServerURI", alias: "d", type: String, defaultValue: "opc.tcp://localhost:4840" }
]);

const capabilities = argv.capabilities || "LDS";

const discovery_server_endpointUrl = argv.discoveryServerURI || "opc.tcp://localhost:4840";

opcua.findServersOnNetwork(discovery_server_endpointUrl, function (err, servers) {
    if(err) {
        console.log("Error : ", err.message);
        return;
    }

    for (const s of servers) {
        console.log(s.toString());
    }
});
