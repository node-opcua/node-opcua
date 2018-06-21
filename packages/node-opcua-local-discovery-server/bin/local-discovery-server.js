const opcua = require("node-opcua");
const path = require("path");

const server_certificate_file = path.join(__dirname,"../certificates/discoveryServer_selfsigned_cert_2048.pem");
const server_certificate_privatekey_file  = path.join(__dirname,"../certificates/discoveryServer_key_2048.pem");

const discoveryServer = new opcua.OPCUADiscoveryServer({
    // reguster
    // port: 4840,
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

});
discoveryServer.start(function() {

    console.log("discovery server started on port ",discoveryServer.port);
    console.log("CTRL+C to stop");
});