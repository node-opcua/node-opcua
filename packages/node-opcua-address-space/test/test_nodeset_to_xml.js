"use strict";
/*global describe,it,before*/

var should = require("should");

var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;

var _ = require("underscore");

var dumpXml = require("../src/nodeset_to_xml").dumpXml;
var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var doDebug = false;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing nodeset to xml", function () {
    var addressSpace;
    beforeEach(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });

    });
    afterEach(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });
    var createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

    it("should output a standard extension object datatype to xml (Argument)", function () {

        var argumentDataType = addressSpace.findDataType("Argument");
        if (doDebug) {
            console.log(argumentDataType.toString());
        }
        var str = dumpXml(argumentDataType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/Argument/);
    });

    it("should output a standard Enum node to xml (ServerState)", function () {
        // TemperatureSensorType
        var serverStateType = addressSpace.findDataType("ServerState");
        var str = dumpXml(serverStateType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/CommunicationFault/);
    });

    it("€€€ should output a custom Enum node to xml (MyEnumType) - Form1( with EnumStrings )", function () {

        var myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumTypeForm1",
            enumeration: ["RUNNING", "STOPPED"]
        });

        myEnumType.browseName.toString().should.eql("MyEnumTypeForm1");
        var str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name=\"RUNNING\" Value=\"0\"\/>/);
        str.should.match(/<Field Name=\"STOPPED\" Value=\"1\"\/>/);

    });
    it("€€ should output a custom Enum node to xml (MyEnumType) - Form2 ( with EnumValues )", function () {


        var myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumType",
            enumeration: [
                {displayName: "RUNNING", value: 10, description: "the device is running"},
                {displayName: "STOPPED", value: 20, description: "the device is stopped"}
            ]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType");
        var str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name=\"RUNNING\" Value=\"10\"\/>/);
        str.should.match(/<Field Name=\"STOPPED\" Value=\"20\"\/>/);

    });

    it("should output a simple objectType node to xml", function () {
        // TemperatureSensorType
        var temperatureSensorType = createTemperatureSensorType(addressSpace);

        var str = dumpXml(temperatureSensorType, {});
        //xx console.log(str);
        str.should.match(/UAObjectType/);
    });


    it("should output a instance of a new ObjectType  to xml", function () {

        // TemperatureSensorType
        var temperatureSensorType = addressSpace.addObjectType({browseName: "TemperatureSensorType"});
        addressSpace.addVariable({
            componentOf: temperatureSensorType,
            browseName: "Temperature",
            description: "the temperature value of the sensor in Celsius <�C>",
            dataType: "Double",
            modellingRule: "Mandatory",
            value: new Variant({dataType: DataType.Double, value: 19.5})
        });

        var parentFolder = addressSpace.findNode("RootFolder");
        parentFolder.browseName.toString().should.eql("Root");

        // variation 1
        var temperatureSensor = temperatureSensorType.instantiate({
            organizedBy: parentFolder,
            browseName: "MyTemperatureSensor"
        });

        // variation 2
        var temperatureSensor2 = temperatureSensorType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyTemperatureSensor"
        });


        var str = dumpXml(temperatureSensor, {});
        if (doDebug) {
            //xx console.log(str);
        }
        str.should.match(/UAObjectType/g);

    });
    it("should output a instance of object with method  to xml", function () {

        var createCameraType = require("./fixture_camera_type").createCameraType;

        var cameraType = createCameraType(addressSpace);

        var camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            browseName: "Camera1"
        });
        var str = dumpXml(camera1, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAObjectType/g);
        str.should.match(/UAObjectType/g);
    });

    it("should output an instance of variable type to xml", function () {

        var variableType = addressSpace.addVariableType({browseName: 'MyCustomVariableType'});

        var str = dumpXml(variableType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAVariableType/g);
    });
});


