"use strict";
/* global describe,it,before*/

var should = require("should");
var assert = require("node-opcua-assert");
var fs = require("fs");

var AddressSpace = require("..").AddressSpace;

var generate_address_space = require("..").generate_address_space;
var nodesets = require("node-opcua-nodesets");

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing add new DataType ", function () {

    this.timeout(Math.max(300000, this._timeout));

    var addressSpace;

    before(function (done) {
        addressSpace = new AddressSpace();

        var xml_file = nodesets.standard_nodeset_file;
        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            done(err);
        });

    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    var createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;


    function createCustomeType(addressSpace) {

        var baseObjectType = addressSpace.findObjectType("BaseObjectType");
        var baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");

        // -------------------------------------------- MachineType
        var customTypeNode = addressSpace.addObjectType({browseName: "CustomType"});

        var standardUnits = require("node-opcua-data-access").standardUnits;

        addressSpace.addAnalogDataItem({

            modellingRule: "Mandatory",

            componentOf: customTypeNode,
            browseName: "Temperature",
            valuePrecision: 0.01,
            instrumentRange: {low: -70, high: 120},
            engineeringUnitsRange: {low: -100, high: 200},
            engineeringUnits: standardUnits.degree_celsius,
            description: "Temperature",
            dataType: "Double"
        });

        customTypeNode.getComponentByName("Temperature").browseName.toString().should.eql("Temperature");

        assert(customTypeNode.temperature.browseName.toString() === "Temperature");
        return customTypeNode;
    }


    it("should instantiate an object whose type defines an analog item", function (done) {

        var customType = createCustomeType(addressSpace);
        customType.temperature.browseName.toString().should.eql("Temperature");
        customType.temperature.valuePrecision.browseName.toString().should.eql("ValuePrecision");
        customType.temperature.instrumentRange.browseName.toString().should.eql("InstrumentRange");
        customType.temperature.instrumentRange.readValue().value.value.low.should.eql(-70);
        customType.temperature.instrumentRange.readValue().value.value.high.should.eql(120);


        var customNode1 = customType.instantiate({
            browseName: "TestNode",
            organizedBy: "RootFolder"
        });

        customNode1.temperature.browseName.toString().should.eql("Temperature")

        customNode1.temperature.valuePrecision.browseName.toString().should.eql("ValuePrecision");
        customNode1.temperature.instrumentRange.browseName.toString().should.eql("InstrumentRange");
        customNode1.temperature.instrumentRange.readValue().value.value.low.should.eql(-70);
        customNode1.temperature.instrumentRange.readValue().value.value.high.should.eql(120);

        done();
    });

    it("should verify that UAObjectType.instantiate works for complex ObjectTypes like DI and ADI (issue 108)", function (done) {


        var addressSpace = new AddressSpace();

        var xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.constructNodesetFilename("1.02/Opc.Ua.Di.NodeSet2.xml"),
            nodesets.constructNodesetFilename("1.02/Opc.Ua.Adi.NodeSet2.xml"),
            nodesets.constructNodesetFilename("1.02/FTNIR.NodeSet2.xml")
        ];


        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);
        fs.existsSync(xml_files[2]).should.be.eql(true);
        fs.existsSync(xml_files[3]).should.be.eql(true);
        fs.existsSync(xml_files[0]).should.be.eql(true);

        generate_address_space(addressSpace, xml_files, function (err) {


            var deviceSet = addressSpace.findNode("RootFolder");

            //xx Object.keys(addressSpace._objectTypeMap).forEach(function(a) { console.log(a); });

            var ftnirType = addressSpace.findObjectType("3:FTNIRSimulatorDeviceType");

            //xx console.log(" ftnirType = ",ftnirType.toString());
            should.exist(ftnirType);

            var ftnirInstance = ftnirType.instantiate({browseName: "MyFTNIR", organizedBy: deviceSet});

            addressSpace.dispose();

            done(err);
        });

    });
});
