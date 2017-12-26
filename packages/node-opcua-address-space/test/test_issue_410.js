"use strict";
/* global describe,it,before*/
var should = require("should");
var nodesets = require("node-opcua-nodesets");
var generateAddressSpace = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var SessionContext = require("..").SessionContext;

var NodeId = require("node-opcua-nodeid").NodeId;
var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var standardUnits = require("node-opcua-data-access").standardUnits;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var DataValue = require("node-opcua-data-value").DataValue;
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataTypeIds = require("node-opcua-constants").DataTypeIds;

describe("AnalogDataItem ValuePrecision issue #410", function () {


    var nodesetFilename = nodesets.standard_nodeset_file;


    var addressSpace = null;
    var analogItem;

    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function () {

            var objectsFolder = addressSpace.findNode("ObjectsFolder");

            analogItem = addressSpace.addAnalogDataItem({
                organizedBy: objectsFolder,
                browseName: "TemperatureSensor",
                definition: "(tempA -25) + tempB",
                valuePrecision: 0.5,
                engineeringUnitsRange: {low: -2000, high: 2000},
                instrumentRange: {low: -100, high: 200},
                engineeringUnits: standardUnits.degree_celsius,
                dataType: "Double",
                value: new Variant({dataType: DataType.Double, value: 10.0})
            });


            done();
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("ValuePrecision should have a DataType Double", function (done) {


        analogItem.valuePrecision.dataType.should.be.instanceOf(NodeId);
        //analogItem.valuePrecision.dataType.toString().should.eql("ns=0;i=7");
        analogItem.valuePrecision.dataType.should.eql(resolveNodeId(DataTypeIds.Double));
        done();
    });
    it("ValuePrecision should be writable ", function (done) {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 0.25})
        });
        var context = SessionContext.defaultContext;
        analogItem.valuePrecision.writeValue(context, dataValue, null, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });
    });

});
