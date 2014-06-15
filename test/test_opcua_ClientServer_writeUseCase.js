
var assert = require('better-assert');
var async = require("async");
var should = require('should');
var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var s = require("../lib/datamodel/structures");

var opcua = require("../");
var makeNodeId = opcua.makeNodeId;
var DataValue = opcua.DataValue;
var DataType = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var OPCUAClient = opcua.OPCUAClient;

describe("end-to-end testing of a write operation between a client and a server",function() {
    var server , client,temperatureVariableId,endpointUrl ;

    var port = 2555;

    before(function(done){
        server = build_server_with_temperature_device({ port:port},function() {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
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
    it("should return Bad_NodeIdUnknown if nodeId is unknown ",function(done){

        perform_operation_on_client_session(client,function(session,done) {

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
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(opcua.StatusCodes.Bad_NodeIdUnknown);
            });
            done();

        },done);
    });

    it("should return Good if nodeId is known but not writeable ",function(done) {

        perform_operation_on_client_session(client,function(session,done) {

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
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(opcua.StatusCodes.Bad_NotWritable);
            });
            done();

        },done);

    });

    it("should return Good if nodeId is known and writeable ",function(done){

        perform_operation_on_client_session(client,function(session,done) {

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
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(opcua.StatusCodes.Good);
            });
            done();

        },done);
    });


});
