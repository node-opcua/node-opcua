var OPCUAServer = require("../../lib/server/opcua_server").OPCUAServer;
var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;
var opcua = require("../../lib/nodeopcua");
var debugLog  = require("../../lib/misc/utils").make_debugLog(__filename);
var Variant = require("../../lib/datamodel/variant").Variant;
var DataType = require("../../lib/datamodel/variant").DataType;

var _ = require("underscore");
var assert = require('better-assert');
var should = require('should');

/**
 * create and start a fake OPCUA Server that exposes a temperature set point variable.
 *
 *    the SetPoint temperature can be set on the server side by accessing the
 *    'set_point_temperature'  of the return server object.
 *
 *    the SetPoint temperature can be accessed as a Read/Write variable by a opcua client
 *    as "Root/MyDevices/SetPointTemperature". The node id of this variable is stored into
 *    the 'temperatureVariableId' of the server object.
 *
 * @param options {options}
 * @param done {callback}
 * @return {OPCUAServer}
 */
function build_server_with_temperature_device(options,done) {

    assert(_.isFunction(done));

    var server = new OPCUAServer(options);
    // we will connect to first server end point

    server.set_point_temperature = 20.0;

    function start(done) {
        server.start(function() {
            server.engine.createFolder("RootFolder",{ browseName: "MyDevices"});

            // install a Read/Write variable representing a temperature set point of a temperature controler.
            server.temperatureVariableId = server.engine.addVariableInFolder("MyDevices",
               {
                    browseName: "SetPointTemperature",
                    value: {
                        get: function(){
                            return new Variant({dataType: DataType.Double , value: server.set_point_temperature});
                        },
                        set: function(variant){
                            // to do : test if variant can be coerce to Float or Double
                            server.set_point_temperature = parseFloat(variant.value);
                            return StatusCodes.Good;
                        }
                    }
                });

            // install a Read-Only variable defined with a fancy Opaque nodeid
            var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";

            server.pumpSpeed = server.engine.addVariableInFolder("MyDevices",
                {
                    browseName: "PumpSpeed",
                    nodeId: pumpSpeedId,
                    value: {
                        get: function(){
                            var pump_speed = 200 + Math.rnd();
                            return new Variant({dataType: DataType.Double ,value: pump_speed});
                        },
                        set: function(variant){
                            return StatusCodes.Bad_NotWritable
                        }
                    }
                });
            assert(server.pumpSpeed.nodeId.toString() === pumpSpeedId);

            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            debugLog("endpointUrl",endpointUrl);
            opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);
            done();

        });
    }
    start(done);
    return server;
}

exports.build_server_with_temperature_device = build_server_with_temperature_device;