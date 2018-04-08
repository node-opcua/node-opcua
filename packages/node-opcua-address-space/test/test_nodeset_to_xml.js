"use strict";
/*global describe,it,before*/

const should = require("should");

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const _ = require("underscore");

const dumpXml = require("../src/nodeset_to_xml").dumpXml;
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const doDebug = false;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing nodeset to xml", function () {
    let addressSpace;
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
    const createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

    it("should output a standard extension object datatype to xml (Argument)", function () {

        const argumentDataType = addressSpace.findDataType("Argument");
        if (doDebug) {
            console.log(argumentDataType.toString());
        }
        const str = dumpXml(argumentDataType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/Argument/);
    });

    it("should output a standard Enum node to xml (ServerState)", function () {
        // TemperatureSensorType
        const serverStateType = addressSpace.findDataType("ServerState");
        const str = dumpXml(serverStateType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/CommunicationFault/);
    });

    it("€€€ should output a custom Enum node to xml (MyEnumType) - Form1( with EnumStrings )", function () {

        const myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumTypeForm1",
            enumeration: ["RUNNING", "STOPPED"]
        });

        myEnumType.browseName.toString().should.eql("MyEnumTypeForm1");
        const str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name=\"RUNNING\" Value=\"0\"\/>/);
        str.should.match(/<Field Name=\"STOPPED\" Value=\"1\"\/>/);

    });
    it("€€ should output a custom Enum node to xml (MyEnumType) - Form2 ( with EnumValues )", function () {


        const myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumType",
            enumeration: [
                {displayName: "RUNNING", value: 10, description: "the device is running"},
                {displayName: "STOPPED", value: 20, description: "the device is stopped"}
            ]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType");
        const str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name=\"RUNNING\" Value=\"10\"\/>/);
        str.should.match(/<Field Name=\"STOPPED\" Value=\"20\"\/>/);

    });

    it("should output a simple objectType node to xml", function () {
        // TemperatureSensorType
        const temperatureSensorType = createTemperatureSensorType(addressSpace);

        const str = dumpXml(temperatureSensorType, {});
        //xx console.log(str);
        str.should.match(/UAObjectType/);
    });


    it("should output a instance of a new ObjectType  to xml", function () {

        // TemperatureSensorType
        const temperatureSensorType = addressSpace.addObjectType({browseName: "TemperatureSensorType"});
        addressSpace.addVariable({
            componentOf: temperatureSensorType,
            browseName: "Temperature",
            description: "the temperature value of the sensor in Celsius <�C>",
            dataType: "Double",
            modellingRule: "Mandatory",
            value: new Variant({dataType: DataType.Double, value: 19.5})
        });

        const parentFolder = addressSpace.findNode("RootFolder");
        parentFolder.browseName.toString().should.eql("Root");

        // variation 1
        const temperatureSensor = temperatureSensorType.instantiate({
            organizedBy: parentFolder,
            browseName: "MyTemperatureSensor"
        });

        // variation 2
        const temperatureSensor2 = temperatureSensorType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyTemperatureSensor"
        });


        const str = dumpXml(temperatureSensor, {});
        if (doDebug) {
            //xx console.log(str);
        }
        str.should.match(/UAObjectType/g);

    });
    it("should output a instance of object with method  to xml", function () {

        const createCameraType = require("./fixture_camera_type").createCameraType;

        const cameraType = createCameraType(addressSpace);

        const camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            browseName: "Camera1"
        });
        const str = dumpXml(camera1, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAObjectType/g);
        str.should.match(/UAObjectType/g);
    });

    it("should output an instance of variable type to xml", function () {

        const variableType = addressSpace.addVariableType({browseName: 'MyCustomVariableType'});

        const str = dumpXml(variableType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAVariableType/g);
    });
});


