var fs = require("fs");
var treeify = require('treeify');
var utils = require('../lib/utils');

var Table = require('easy-table');
var argv = require('optimist')
    .usage('Usage: $0 --port [num] --hostname <hostname>  -d')
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
        client.getEndPointRequest(function (err,endpoints) {


            endpoints = utils.replaceBufferWithHexDump(endpoints);

            if (argv.d) {
                var f = fs.writeFile("tmp/endpoints.log",JSON.stringify(endpoints,null," "));
                console.log(treeify.asTree(endpoints,true));

            }

            var table= new Table();
            if (!err) {
                endpoints.forEach(function(endpoint){
                    table.cell('endpoint', endpoint.endpointUrl);
                    table.cell('Application URI', endpoint.server.applicationUri);
                    table.cell('Security Mode', endpoint.securityMode);
                    table.cell('securityPolicyUri', endpoint.securityPolicyUri);
                    table.cell('Type', endpoint.server.applicationType.key);
                    table.cell('certificate', "..." /*endpoint.serverCertificate*/);
                    table.newRow();
                });
            }
            console.log(table.toString());
            callback(err);
        });
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


