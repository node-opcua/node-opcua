const path = require("path");
const {OPCUAServer} = require("node-opcua-server");

const server = new OPCUAServer({
});

const { addAggregateSupport } = require("..");

server.start(function(err){

    addAggregateSupport(server.engine.addressSpace);

    console.log("err= ",err);

});