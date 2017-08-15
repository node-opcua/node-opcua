"use strict";
var opcua  = require("node-opcua");
var async  = require("async");
var fs     = require("fs");
var should = require("should");
var path   = require("path");

var start_simple_server = require("../../test_helpers/external_server_fixture").start_simple_server;
var stop_simple_server = require("../../test_helpers/external_server_fixture").stop_simple_server;
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


var AttributeIds = opcua.AttributeIds;
var StatusCodes = opcua.StatusCodes;

describe("testing extension object with client residing on a different process than the server process", function () {

    this.timeout(Math.max(600000,this._timeout));

    var serverHandle = null;

    var options = {
        server_sourcefile: path.join(__dirname,"../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        port: 23232
    };
    fs.existsSync(options.server_sourcefile).should.eql(true,"cannot find simple_server_with_custom_extension_objects script");

    before(function(done) {
        start_simple_server(options,function (err, data) {
            if (!err) {
                serverHandle = data;
            }
            done(err);
        });
    });
    after(function(done) {
        stop_simple_server(serverHandle, function (err) {
            done(err);
        });
    });

    it("should read the MyStructureDataType definition", function (done) {

        var client = new opcua.OPCUAClient();
        var endpointUrl = "opc.tcp://127.0.0.1:23232";

        var nodeId = "ns=2;i=6001";
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {


            async.series([

                function(callback) {

                    var nodesToRead = [
                        new opcua.read_service.ReadValueId({nodeId: nodeId, attributeId: AttributeIds.Value})
                    ];

                    session.read(nodesToRead, function (err, nodesToRead, results) {

                        should.not.exist(err);
                        results.length.should.eql(1);
                        console.log(results[0]);

                        if (!err) {

                            results[0].statusCode.should.eql(StatusCodes.Good);

                            //xx console.log(" input,",nodesToRead[0].toString());
                            //xx console.log(" result,",results[0].toString());
                            var xmlData = results[0].value.value.toString("ascii");
                            xmlData.should.match(/opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType\"/);
                        }
                        callback(err);
                    });

                },

                function(callback) {

                    var nodesToRead = [
                        new opcua.read_service.ReadValueId({
                            nodeId:  nodeId,
                            attributeId: 13,
                            indexRange: new opcua.NumericRange() // "0:16777235"
                        })
                    ];
                    session.read(nodesToRead,function(err,nodesToRead,results){

                        if (!err) {
                            //xx console.log(" input,",nodesToRead[0].toString());
                            //xx console.log(" result,",results[0].toString());
                            var xmlData = results[0].value.value.toString("ascii");
                            xmlData.should.match(/opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/);
                        }
                        callback(err);
                    });

                }

            ],inner_done);
        },done);
    });

});
