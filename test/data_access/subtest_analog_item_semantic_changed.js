"use strict";
require("requirish")._(module);


var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var write_service = require("lib/services/write_service");
var WriteValue = write_service.WriteValue;

var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;
var standardUnits = require("lib/data_access/EUInformation").standardUnits;

var async = require("async");
var sinon = require("sinon");

module.exports = function (engine) {

    describe("AnalogDataItem and semantic changes", function () {

        var analogItem ;
        beforeEach(function() {

            var addressSpace = engine.addressSpace;

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

            var dataValueOrg = analogItem.readAttribute(AttributeIds.Value);

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
            analogItem.euRange.writeAttribute(writeValue,done);
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
            analogItem.writeValue(dataValue,function(err){
                analogItem.semantic_version.should.eql(original_semantic_version);
                spy_on_semantic_changed.callCount.should.eql(0);

                done();
            });


        });

    });
};
