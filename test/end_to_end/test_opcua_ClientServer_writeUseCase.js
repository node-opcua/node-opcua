require("requirish")._(module);

var assert = require("better-assert");
var async = require("async");
var should = require("should");
var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var s = require("lib/datamodel/structures");

var opcua = require("index");
var makeNodeId = opcua.makeNodeId;
var DataValue = opcua.DataValue;
var DataType = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var OPCUAClient = opcua.OPCUAClient;

var address_space_for_conformance_testing  = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

describe("end-to-end testing of a write operation between a client and a server (session#write)",function() {
    var server , client,temperatureVariableId,endpointUrl ;

    var port = 2555;

    before(function(done){
        server = build_server_with_temperature_device({ port:port},function(err) {

            build_address_space_for_conformance_testing(server.engine,{ mass_variables: false});

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done){
        client = null;
        done();
    });

    after(function(done){
        server.shutdown(done);
    });
    it("should return BadNodeIdUnknown if nodeId is unknown ",function(done){

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            var unknown_nodeid = makeNodeId(7777,8788);
            var nodesToWrite = [
                {
                    nodeId: unknown_nodeid,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: { /* Variant */dataType: DataType.Double, value: 10.0  }
                    }
                }
            ];

            session.write(nodesToWrite,function(err,statusCodes){
                if (!err) {
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.BadNodeIdUnknown);
                }
                done(err);
            });

        },done);
    });

    it("should return Good if nodeId is known but not writeable ",function(done) {

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";

            var nodesToWrite = [
                {
                    nodeId: pumpSpeedId,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: { /* Variant */dataType: DataType.Double, value: 10.0  }
                    }
                }
            ];

            session.write(nodesToWrite,function(err,statusCodes){
                if (!err) {
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.BadNotWritable);
                }
                done(err);
            });

        },done);

    });

    it("should return Good if nodeId is known and writeable ",function(done){

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            var setPointTemperatureId = "ns=4;s=SetPointTemperature";

            var nodesToWrite = [
                {
                    nodeId: setPointTemperatureId,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: { /* Variant */dataType: DataType.Double, value: 10.0  }
                    }
                }
            ];

            session.write(nodesToWrite,function(err,statusCodes){
                if(!err) {
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.Good);
                }
                done(err);
            });

        },done);
    });


    it("should return an error if value to write has a wrong dataType",function(done){

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            var setPointTemperatureId = "ns=4;s=SetPointTemperature";

            var nodesToWrite = [
                {
                    nodeId: setPointTemperatureId,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: { /* Variant */dataType: DataType.String, value:"This is a string, but should be a Float"  }
                    }
                }
            ];

            session.write(nodesToWrite,function(err,statusCodes){
                if(!err) {
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.BadTypeMismatch);
                }
                done(err);
            });

        },done);

    });

    it("should return an error if value to write has a wrong dataType ( Double  instead of Float)",function(done){

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            var float_Node = "ns=411;s=Scalar_Simulation_Float";

            var nodesToWrite = [
                {
                    nodeId: float_Node,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: { /* Variant */dataType: DataType.Double, value: 2  }
                    }
                }
            ];

            session.write(nodesToWrite,function(err,statusCodes){
                if (!err) {
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.BadTypeMismatch);
                }
                done(err);
            });

        },done);

    });

    it("server should return Good_CompletesAsynchronously if the  variable write operation happens asynchronously",function(done){

        // The value was successfully written to an intermediate system but the Server does not know if
        // the data source was updated properly.


        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            var asyncNodeId = "ns=4;s=AsynchronousVariable";

            var nodesToWrite = [
                {
                    nodeId: asyncNodeId,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: { /* Variant */dataType: DataType.Double, value: 23.0 }
                    }
                }
            ];

            session.write(nodesToWrite,function(err,statusCodes){
                if (!err) {
                    console.log(statusCodes);
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.GoodCompletesAsynchronously);
                }
                done(err);
            });

        },done);

    });

});
