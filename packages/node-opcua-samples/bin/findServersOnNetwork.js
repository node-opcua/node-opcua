const opcua = require("node-opcua");


const yargs = require("yargs/yargs");

const argv = yargs(process.argv)
    .wrap(132)
    .string("capabilities")
    .default("capabilities","DA")
    .alias("c","capabilities")

    .string("discoveryServerURI")
    .default("discoveryServerURI","opc.tcp://localhost:4840")
    .alias("d","discoveryServerURI")

    .help(true)
    .argv;

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
