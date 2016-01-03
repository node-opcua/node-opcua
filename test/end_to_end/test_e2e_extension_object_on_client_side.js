require("requirish")._(module);
var start_simple_server = require("test/helpers/external_server_fixture").start_simple_server;
var stop_simple_server = require("test/helpers/external_server_fixture").stop_simple_server;
var path = require("path");

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var opcua = require("index");
var async = require("async");
var should= require("should");

describe("testing extension object with client residing on a different process than the server process", function () {

    this.timeout(Math.max(600000,this._timeout));

    var serverHandle = null;

    var options = {
        server_sourcefile: "./bin/simple_server_with_custom_extension_objects.js",
        port: 23232
    };

    before(function(done) {
        start_simple_server(options,function (err, data) {
            if (!err) {
                serverHandle = data;
            }
            done(err);
        })
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
                        new opcua.read_service.ReadValueId({ nodeId:  nodeId, attributeId: 13 })
                    ];
                    session.read(nodesToRead,function(err,nodesToRead,results){

                        if (!err) {
                            //xx console.log(" input,",nodesToRead[0].toString());
                            //xx console.log(" result,",results[0].toString());
                            var xmlData = results[0].value.value.toString("ascii");
                            xmlData.should.match(/opc:StructuredType BaseType=\"ua:ExtensionObject\" Name=\"MyStructureDataType\"/);
                        }
                        callback(err);
                    });

                },

                function(callback) {

                    var nodesToRead = [
                        new opcua.read_service.ReadValueId({
                            nodeId:  nodeId,
                            attributeId: 13,
                            indexRange: new opcua.NumericRange("0:16777235")
                        })
                    ];
                    session.read(nodesToRead,function(err,nodesToRead,results){

                        if (!err) {
                            //xx console.log(" input,",nodesToRead[0].toString());
                            //xx console.log(" result,",results[0].toString());
                            var xmlData = results[0].value.value.toString("ascii");
                            xmlData.should.match(/opc:StructuredType BaseType=\"ua:ExtensionObject\" Name=\"MyStructureDataType\"/);
                        }
                        callback(err);
                    });

                },

            ],inner_done);
        },done);
    });

});
