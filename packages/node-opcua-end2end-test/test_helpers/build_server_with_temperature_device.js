"use strict";
var _ = require("underscore");
var assert = require("node-opcua-assert");
require("should");

var opcua = require("node-opcua");

var OPCUAServer = opcua.OPCUAServer;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var is_valid_endpointUrl = opcua.is_valid_endpointUrl;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var address_space_for_conformance_testing = require("node-opcua-address-space-for-conformance-testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;




/**
 * add a fake analog data item for testing
 * @method addTestUAAnalogItem
 *
 * @param parentNode
 */
function addTestUAAnalogItem(parentNode) {

//xx    assert(parentNode instanceof opcua.BaseNode);

    var addressSpace = parentNode.addressSpace;

    // add a UAAnalogItem
    /* var node = */ addressSpace.addAnalogDataItem({
        componentOf: parentNode,
        nodeId: "ns=4;s=TemperatureAnalogItem",
        browseName: "TemperatureAnalogItem",
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange: {low: 100, high: 200},
        instrumentRange: {low: -100, high: +200},
        engineeringUnits: opcua.standardUnits.degree_celsius,
        dataType: "Double",
        value: {
            get: function () {
                return new Variant({dataType: DataType.Double, value: Math.random() + 19.0});
            }
        }
    });

}


var userManager = {
    isValidUser: function (userName, password) {

        if (userName === "user1" && password === "password1") {
            return true;
        }
        if (userName === "user2" && password === "password2") {
            return true;
        }
        return false;
    }
};

/**
 * @method build_server_with_temperature_device
 *
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
 * @param [options.add_simulation = false] {Boolean} add the simulation nodes in the server
 * @param done {callback}
 * @return {OPCUAServer}
 */
function build_server_with_temperature_device(options, done) {

    assert(_.isFunction(done, "expecting a callback function"));
    assert(typeof opcua.nodesets.standard_nodeset_file === "string");

    //xx console.log("xxx building server with temperature device");

    // use mini_nodeset_filename for speed up if not otherwise specified
    options.nodeset_filename = options.nodeset_filename ||
        [
            opcua.nodesets.standard_nodeset_file
        ];

    options.userManager = userManager;

    var server = new OPCUAServer(options);
    // we will connect to first server end point

    server.on("session_closed", function (session, reason) {
        //xx console.log(" server_with_temperature_device has closed a session :",reason);
        //xx console.log("              session name: ".cyan,session.sessionName.toString());
    });

    server.on("post_initialize", function () {

        var addressSpace = server.engine.addressSpace;

        var myDevices = addressSpace.addFolder("ObjectsFolder", {browseName: "MyDevices"});
        assert(myDevices.browseName.toString() === "MyDevices");

        var variable0 = addressSpace.addVariable({
            componentOf: myDevices,
            browseName: "FanSpeed",
            nodeId: "ns=2;s=FanSpeed",
            dataType: "Double",
            value: new Variant({dataType: DataType.Double, value: 1000.0})
        });

        var setPointTemperatureId = "ns=4;s=SetPointTemperature";
        // install a Read/Write variable representing a temperature set point of a temperature controller.
        server.temperatureVariableId = addressSpace.addVariable({
            componentOf: myDevices,
            browseName: "SetPointTemperature",
            nodeId: setPointTemperatureId,
            dataType: "Double",
            value: {
                get: function () {
                    return new Variant({dataType: DataType.Double, value: server.set_point_temperature});
                },
                set: function (variant) {
                    // to do : test if variant can be coerce to Float or Double
                    server.set_point_temperature = parseFloat(variant.value);
                    return StatusCodes.Good;
                }
            }
        });

        // install a Read-Only variable defined with a fancy Opaque nodeid
        var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";

        server.pumpSpeed = addressSpace.addVariable({
            componentOf: myDevices,
            browseName: "PumpSpeed",
            nodeId: pumpSpeedId,
            dataType: "Double",
            value: {
                get: function () {
                    var pump_speed = 200 + Math.random();
                    return new Variant({dataType: DataType.Double, value: pump_speed});
                },
                set: function (variant) {
                    return StatusCodes.BadNotWritable;
                }
            }
        });
        assert(server.pumpSpeed.nodeId.toString() === pumpSpeedId);

        var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        if (options.add_simulation) {
            build_address_space_for_conformance_testing(server.engine.addressSpace);
        }

        // add a Analog Data Item
        addTestUAAnalogItem(myDevices);


        // add a variable that can be written asynchronously
        var asyncWriteNodeId = "ns=4;s=AsynchronousVariable";
        var asyncValue = 46;

        server.asyncWriteNode = addressSpace.addVariable({
            componentOf: myDevices,
            browseName: "AsynchronousVariable",
            nodeId: asyncWriteNodeId,
            dataType: "Double",

            value: {
                // asynchronous read
                refreshFunc: function (callback) {

                    var dataValue = new DataValue({
                        value: {
                            dataType: DataType.Double,
                            value: asyncValue
                        },
                        sourceTimestamp: new Date()
                    });
                    // simulate a asynchronous behaviour
                    setTimeout(function () {
                        callback(null, dataValue);
                    }, 100);
                },
                set: function (variant) {
                    setTimeout(function () {
                        asyncValue = variant.value;
                    }, 1000);
                    return StatusCodes.GoodCompletesAsynchronously;
                }
            }

        });


        // add a variable that can be written asynchronously and that supports TimeStamps and StatusCodes
        var asyncWriteFullNodeId = "ns=4;s=AsynchronousFullVariable";
        var asyncWriteFull_dataValue = {
            statusCode: StatusCodes.BadWaitingForInitialData
        };

        server.asyncWriteNode = addressSpace.addVariable({
            componentOf: myDevices,
            browseName: "AsynchronousFullVariable",
            nodeId: asyncWriteFullNodeId,
            dataType: "Double",

            value: {
                // asynchronous read
                timestamped_get: function (callback) {
                    assert(_.isFunction(callback), "callback must be a function");
                    setTimeout(function () {
                        callback(null, asyncWriteFull_dataValue);
                    }, 100);
                },
                // asynchronous write
                // in this case, we are using timestamped_set and not set
                // as we want to control and deal with the dataValue provided by the client write
                // This will allow us to handle more specifically timestamps and statusCodes
                timestamped_set: function (dataValue, callback) {
                    assert(_.isFunction(callback), "callback must be a function");
                    //xxx console.log(" DATA VALUE !!!".cyan,dataValue.toString().yellow);
                    setTimeout(function () {
                        asyncWriteFull_dataValue = new DataValue(dataValue);
                        callback();
                    }, 500);
                }
            }

        });

    });

    server.set_point_temperature = 20.0;

    function start(done) {
        server.start(function (err) {

            if (err) {
                return done(err);
            }

            assert(server.engine.status === "initialized");

            done();

        });
    }

    start(done);
    return server;
}

exports.build_server_with_temperature_device = build_server_with_temperature_device;
