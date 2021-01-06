const opcua = require("node-opcua");
const path = require("path");

const server = new opcua.OPCUAServer({
    certificateFile: path.join(__dirname,"../../node-opcua-samples/certificates/server_cert_2048.pem"),
    privateKey: path.join(__dirname,"../../node-opcua-samples/certificates/server_key_2018.pem")
});

const { addAggregateSupport } = require("..");

server.start(function(err){

    addAggregateSupport(server.engine.addressSpace);

    console.log("err= ",err);

});