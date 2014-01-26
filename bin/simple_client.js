var OPCUAClient = require("../lib/opcua-client.js").OPCUAClient;
var async = require("async");

var client = new OPCUAClient();

async.series([
    function(callback) {
        client.connect("localhost",4841,callback);
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

console.log("initialization done");

