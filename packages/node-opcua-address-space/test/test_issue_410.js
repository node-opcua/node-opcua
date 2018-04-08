"use strict";
/* global describe,it,before*/
const should = require("should");
const nodesets = require("node-opcua-nodesets");
const generateAddressSpace = require("..").generate_address_space;
const AddressSpace = require("..").AddressSpace;
const SessionContext = require("..").SessionContext;

const NodeId = require("node-opcua-nodeid").NodeId;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const standardUnits = require("node-opcua-data-access").standardUnits;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const DataValue = require("node-opcua-data-value").DataValue;
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataTypeIds = require("node-opcua-constants").DataTypeIds;

describe("AnalogDataItem ValuePrecision issue #410", function () {


    const nodesetFilename = nodesets.standard_nodeset_file;


    let addressSpace = null;
    let analogItem;

    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function () {

            const objectsFolder = addressSpace.findNode("ObjectsFolder");

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

        const dataValue = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 0.25})
        });
        const context = SessionContext.defaultContext;
        analogItem.valuePrecision.writeValue(context, dataValue, null, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });
    });

});
