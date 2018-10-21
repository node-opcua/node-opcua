// a simple client that is design to crash in the middle of a connection
// once a item has been monitored
"use strict";
if (process.argv.length !== 3) {
    console.log(" Invalid number of argument, please specify port number");
    return;
}
console.log("process.argv.length ",process.argv.length);

/*global require,console,setTimeout */
var opcua = require("node-opcua"); // node-opcua
var async = require("async");

var port = process.argv[2];


var endpointUrl = "opc.tcp://" + require("os").hostname() + ":" + port;
console.log("endpointUrl = ",endpointUrl);

var options = {
    endpoint_must_exist: false,
    requestedSessionTimeout: 101, // very short
    keepSessionAlive: true,
    connectionStrategy: {
        maxRetry: 0 // << NO RETRY !
    }
};

var client = opcua.OPCUAClient.create(options);

var the_session;

async.series([

        // step 1 : connect to
        function(callback)  {
            client.connect(endpointUrl,function (err) {
                if(err) {
                    console.log(" cannot connect to endpoint :" , endpointUrl );
                } else {
                    console.log("connected !");
                }
                callback(err);
            });
        },

        // step 2 : createSession
        function(callback) {
            client.createSession( function(err,session) {
                if(!err) {
                    the_session = session;
                }
                callback(err);
            });
        },

        // step 3 : browse
        function(callback) {
            console.log("About to CRASH !!!!");
            setTimeout(function(){
                console.log(" CRASHING !!!!");
                process.exit(-1);
            },3000);
        },
    ],
    function(err) {
        if (err) {
            console.log(" failure ",err);
        } else {
            console.log("done!");
        }
    }) ;
