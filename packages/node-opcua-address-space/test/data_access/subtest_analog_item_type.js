"use strict";
var async = require("async");

var should = require("should");

var DataValue =  require("node-opcua-data-value").DataValue;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;


var Range = require("node-opcua-data-access").Range;
var standardUnits = require("node-opcua-data-access").standardUnits;

var SessionContext = require("../..").SessionContext;

var BrowseDescription = require("node-opcua-service-browse").BrowseDescription;
var BrowseDirection = require("node-opcua-data-model").BrowseDirection;

var AddressSpace = require("../../").AddressSpace;


module.exports = function (maintest) {

    describe("AnalogDataItem", function () {

        var addressSpace;
        before(function() {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        var context = SessionContext.defaultContext;

        it("should add an analog data item in the addresss_space", function (done) {

            var objectsFolder = addressSpace.findNode("ObjectsFolder");
            objectsFolder.browseName.toString().should.eql("Objects");

            var fakeValue = 1;

            var analogItem = addressSpace.addAnalogDataItem({

                organizedBy: objectsFolder,

                browseName: "TemperatureSensor",
                definition: "(tempA -25) + tempB",
                valuePrecision: 0.5,
                engineeringUnitsRange: {low: 100, high: 200},
                instrumentRange: {low: -100, high: +200},
                engineeringUnits: standardUnits.degree_celsius,

                dataType: "Double",
                value: {
                    get: function () {
                        return new Variant({
                            dataType: DataType.Double,
                            value: fakeValue
                        });
                    }
                }

            });

            //xx console.log(JSON.stringify(analogItem,null," "));
            // analogItem.dataType.should.eql(addressSpace.findVariableType("AnalogItemType").nodeId);

            analogItem.definition.browseName.toString().should.eql("Definition");
            analogItem.valuePrecision.browseName.toString().should.eql("ValuePrecision");
            analogItem.euRange.browseName.toString().should.eql("EURange");
            analogItem.instrumentRange.browseName.toString().should.eql("InstrumentRange");
            analogItem.engineeringUnits.browseName.toString().should.eql("EngineeringUnits");

            analogItem.euRange.readValue().value.value.low.should.eql(100);
            analogItem.euRange.readValue().value.value.high.should.eql(200);

            analogItem.instrumentRange.readValue().value.value.low.should.eql(-100);
            analogItem.instrumentRange.readValue().value.value.high.should.eql(200);

            // browsing variable
            var browseDescription = new BrowseDescription({
                nodeClassMask: 0, // 0 = all nodes
                referenceTypeId: 0,
                browseDirection: BrowseDirection.Forward,
                resultMask: 0x3F
            });
            //xx var browseResult = engine.browseSingleNode(analogItem.nodeId, browseDescription);
            var references = analogItem.browseNode(browseDescription);

            references.length.should.eql(6);

            async.series([

                function (callback) {
                    analogItem.instrumentRange.readValueAsync(context, function (err, dataValue) {
                        if (!err) {
                            dataValue.statusCode.should.eql(StatusCodes.Good);
                            dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                            dataValue.value.value.should.be.instanceOf(Range);
                            dataValue.value.value.low.should.eql(-100);
                            dataValue.value.value.high.should.eql(200);
                        }
                        callback(err);
                    });

                },

                function (callback) {
                    //xx console.log(analogItem._dataValue);
                    analogItem.readValueAsync(context, function (err, dataValue) {
                        if (!err) {
                            dataValue.statusCode.should.eql(StatusCodes.Good);
                            dataValue.value.dataType.should.eql(DataType.Double);
                            dataValue.value.value.should.eql(fakeValue);
                        }
                        callback(err);
                    });
                },
                function (callback) {

                    fakeValue = 2.0;

                    analogItem.readValueAsync(context, function (err, dataValue) {
                        //xx console.log(analogItem._dataValue);
                        if (!err) {
                            dataValue.statusCode.should.eql(StatusCodes.Good);
                            dataValue.value.dataType.should.eql(DataType.Double);
                            dataValue.value.value.should.eql(fakeValue);
                        }
                        callback(err);
                    });
                }

            ], done);
        });


        it("Writing a value exceeding InstrumentRange shall return BadOutOfRange", function (done) {



            var objectsFolder = addressSpace.findNode("ObjectsFolder");

            var analogItem = addressSpace.addAnalogDataItem({
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

            var dataValue = new DataValue({
                value: new Variant({dataType: DataType.Double, value: -1000.0})// out of range
            });

            analogItem.writeValue(context, dataValue, null, function (err, statusCode) {
                statusCode.should.eql(StatusCodes.BadOutOfRange);
                done(err);
            });

        });

        it("Writing a value within InstrumentRange shall return Good", function (done) {


            var objectsFolder = addressSpace.findNode("ObjectsFolder");

            var analogItem = addressSpace.addAnalogDataItem({
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

            var dataValue = new DataValue({
                value: new Variant({dataType: DataType.Double, value: 150})// in range
            });

            analogItem.writeValue(context, dataValue, null, function (err, statusCode) {
                statusCode.should.eql(StatusCodes.Good);
                done(err);
            });

        });
    });
};
