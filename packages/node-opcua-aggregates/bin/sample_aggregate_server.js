const opcua = require("node-opcua");
const path = require("path");

const server = new opcua.OPCUAServer({
});

const { addAggregateSupport } = require("..");

server.start(function(err){

    addAggregateSupport(server.engine.addressSpace);

    console.log("err= ",err);

});