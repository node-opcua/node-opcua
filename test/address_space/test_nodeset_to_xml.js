"use strict";
/*global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var path = require("path");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
//xx var UADataType = require("lib/address_space/ua_data_type").UADataType;
//xx var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
//xx var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;
//xx var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;

var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");

var dumpXml = require("lib/address_space/nodeset_to_xml").dumpXml;

describe("testing nodeset to xml", function () {
    var address_space;

    beforeEach(function (done) {
        address_space = new AddressSpace();
        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");

        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            done(err);
        });

    });
    afterEach(function () {
        console.log("---------------------");
    });
    var createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

    it("should output a standard extension object datatype to xml (Argument)", function () {

        var argumentDataType = address_space.findDataType("Argument");
        console.log(argumentDataType);
        var str = dumpXml(argumentDataType, {});
        console.log(str);
        str.should.match(/Argument/);
    });

    it("should output a standard Enum node to xml (ServerState)", function () {
        // TemperatureSensorType
        var serverStateType = address_space.findDataType("ServerState");
        var str = dumpXml(serverStateType, {});
        console.log(str);
        str.should.match(/CommunicationFault/);
    });

    it("should output a custom Enum node to xml (MyEnumType)", function () {

        require("lib/address_space/address_space_add_enumeration_type");

        var myEnumType = address_space.addEnumerationType({
            browseName: "MyEnumType",
            enumeration: [
                {name: "RUNNING", value: 1, description: "the device is running"},
                {name: "STOPPED", value: 2, description: "the device is stopped"}
            ]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType");
        var str = dumpXml(myEnumType, {});
        console.log(str);
        str.should.match(/RUNNING/);

    });

    it("should output a simple objecType node to xml", function () {
        // TemperatureSensorType
        var temperatureSensorType = createTemperatureSensorType(address_space);

        var str = dumpXml(temperatureSensorType, {});
        console.log(str);
        str.should.match(/UAObjectType/);
    });


    it("should output a instance of a new ObjectType  to xml", function () {

        // TemperatureSensorType
        var temperatureSensorType = address_space.addObjectType({browseName: "TemperatureSensorType"});
        address_space.addVariable(temperatureSensorType, {
            browseName: "Temperature",
            description: "the temperature value of the sensor in Celsius <°C>",
            dataType: "Double",
            modellingRule: "Mandatory",
            value: new Variant({dataType: DataType.Double, value: 19.5})
        });

        var parentFolder = address_space.findObject("RootFolder");
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
        console.log(str);
        str.should.match(/UAObjectType/g);

    });
    it("should output a instance of object with method  to xml", function () {

        var createCameraType = require("./fixture_camera_type").createCameraType;

        var cameraType = createCameraType(address_space);

        var camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            browseName: "Camera1"
        });
        var str = dumpXml(camera1, {});
        console.log(str);
        str.should.match(/UAObjectType/g);
        str.should.match(/UAObjectType/g);
    });
});


