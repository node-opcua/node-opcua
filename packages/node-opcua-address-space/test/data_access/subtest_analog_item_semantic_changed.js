"use strict";
var sinon = require("sinon");
var should = require("should");


var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var AttributeIds = require("node-opcua-data-model").AttributeIds;

var write_service = require("node-opcua-service-write");
var WriteValue = write_service.WriteValue;

var Range = require("node-opcua-data-access").Range;
var standardUnits = require("node-opcua-data-access").standardUnits;

var SessionContext = require("../../").SessionContext;
var context = SessionContext.defaultContext;
var AddressSpace = require("../../").AddressSpace;


module.exports = function (maintest) {

    describe("AnalogDataItem and semantic changes", function () {

        var addressSpace ;
        var analogItem ;
        beforeEach(function() {

            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);

            var objectsFolder = addressSpace.findNode("ObjectsFolder");
            objectsFolder.browseName.toString().should.eql("Objects");

            var fakeValue = 1;

            analogItem = addressSpace.addAnalogDataItem({

                organizedBy: objectsFolder,

                browseName: "TemperatureSensor1",
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

        });

        function modifyEURange(analogItem,done) {

            var dataValueOrg = analogItem.readAttribute(context, AttributeIds.Value);

            var dataValue = {
                value : {
                    dataType: DataType.ExtensionObject,
                    value: new Range({
                        low: dataValueOrg.value.value.low+1,
                        high: dataValueOrg.value.value.high+1
                    })
                }
            };

            var writeValue = new WriteValue({
                attributeId: AttributeIds.Value,
                value: dataValue
            });
            analogItem.euRange.writeAttribute(context, writeValue, done);
        }

        it("should emit a 'semantic_changed' event when EURange changes", function (done) {

            analogItem.semantic_version.should.eql(0);

            var spy_on_semantic_changed = new sinon.spy();
            analogItem.on("semantic_changed",spy_on_semantic_changed);

            var original_semantic_version = analogItem.semantic_version;

            modifyEURange(analogItem,function() {
                spy_on_semantic_changed.callCount.should.eql(1);
                analogItem.semantic_version.should.eql(original_semantic_version+1);
                done();
            });

        });
        it("should not emit a 'semantic_changed' event when value changes", function (done) {

            analogItem.semantic_version.should.eql(0);
            var original_semantic_version = analogItem.semantic_version;

            var spy_on_semantic_changed = new sinon.spy();
            analogItem.on("semantic_changed",spy_on_semantic_changed);

            var dataValue = analogItem.readValue();
            analogItem.writeValue(context, dataValue, function (err) {
                analogItem.semantic_version.should.eql(original_semantic_version);
                spy_on_semantic_changed.callCount.should.eql(0);

                done();
            });


        });

    });
};
