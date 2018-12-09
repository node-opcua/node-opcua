const opcua = require("node-opcua");
const path = require("path");
// Create a new instance of vantage.
const Vorpal = require("vorpal");
const vorpal_repl = require("vorpal-repl");

const server_certificate_file = path.join(__dirname,"../certificates/discoveryServer_selfsigned_cert_2048.pem");
const server_certificate_privatekey_file  = path.join(__dirname,"../certificates/discoveryServer_key_2048.pem");

const discoveryServer = new opcua.OPCUADiscoveryServer({
    // register
    // port: 4840,
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

});
discoveryServer.start(function(err) {

    if (err) {
        console.log("Error , cannot start LDS ", err.message);
        console.log("Make sure that a LocalDiscoveryServer is not already running");
        return;

    }
    console.log("discovery server started on port ",discoveryServer.endpoints[0].port);
    console.log("CTRL+C to stop");


// Add the command "foo", which logs "bar".
    const vorpal = new Vorpal();
    vorpal
        .command("info")
        .description("display list of registered servers.")
        .action(function(args, callback) {

            this.log(discoveryServer.serverInfo);
            // xx this.log(discoveryServer.endpoints[0]);

            const servers = Object.keys(discoveryServer.registered_servers);
            this.log("number of registered servers : ", servers.length);

            for (const serverKey of servers) {
                const server = discoveryServer.registered_servers[serverKey];
                this.log("key =" , serverKey);
                this.log(server.toString());

            }
            callback();
        });
        vorpal.delimiter("local-discovery-server$").use(vorpal_repl).show();

});
