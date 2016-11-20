"use strict";
require("requirish")._(module);
//xx var sinon = require("sinon");
//xx var async = require("async");
var should = require("should");
var opcua = require("index");
var _ = require("underscore");

var OPCUAClient = opcua.OPCUAClient;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
var DataType = require("lib/datamodel/variant").DataType;


module.exports = function (test) {

    function doTest(nodeId,expectedDataType,done) {
        var client = new OPCUAClient();
        var endpointUrl = test.endpointUrl;

        perform_operation_on_client_session(client, endpointUrl,function(session,inner_done){

            session.getBuiltInDataType(nodeId,function(err,dataType){
                if (err) return inner_done(err);
                if (dataType != expectedDataType) {
                    return inner_done(new Error("Expecting "+ expectedDataType.toString()));
                }
                inner_done();
            });
        },done);

    }
    describe("Testing issue#273 ", function () {

        it("GDT1- should be possible to find the DataType of node - Double ",function(done) {
            var nodeId = coerceNodeId("ns=411;s=Scalar_Simulation_Double");
            doTest(nodeId,DataType.Double,done);
        });
        it("GDT2- should be possible to find the DataType of  node - ImageGIF",function(done) {
            var nodeId = coerceNodeId("ns=411;s=Scalar_Simulation_ImageGIF");
            doTest(nodeId,DataType.ByteString,done);
        });
        it("GDT3- should be possible to find the DataType of simple node - Int64",function(done) {
            var nodeId = coerceNodeId("ns=411;s=Scalar_Simulation_Int64");
            doTest(nodeId,DataType.Int64,done);
        });
        it("GDT4- should be possible to find the DataType of simple - QualifiedName",function(done) {
            var nodeId = coerceNodeId("ns=411;s=Scalar_Simulation_QualifiedName");
            doTest(nodeId,DataType.QualifiedName,done);
        });

        it("GDT5- should fail  to find the DataType on a Object ( Server Object for instance)",function(done) {
            var nodeId = coerceNodeId("ns=0;i=2253"); // Server Object
            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            perform_operation_on_client_session(client, endpointUrl,function(session,inner_done){

                session.getBuiltInDataType(nodeId,function(err,dataType){
                    if (!err) return inner_done(new Error("expecting a failure"));
                    inner_done();
                });
            },done);
        });
    });
};
