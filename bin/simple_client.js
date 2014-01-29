var argv = require('optimist')
    .usage('Usage: $0 --port [num] --hostname <hostname>')
    .argv;

var OPCUAClient = require("../lib/opcua-client.js").OPCUAClient;
var async = require("async");

var client = new OPCUAClient();

var port = argv.port  || 4841
var hostname = argv.hostname || "localhost";

async.series([
    function(callback) {
        client.connect(hostname,port,callback);
    },
    function(callback) {
        client.disconnect(callback);
    }
],function(err){
    if (err) {
        console.log(" process terminated with an error");
        console.log(" error" , err) ;
    } else {
        console.log("success !!   ");
    }
});


