"use strict";
var should = require("should");

var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;

var standardUnits = require("node-opcua-data-access").standardUnits;

var AddressSpace = require("../../").AddressSpace;


module.exports = function(maintest) {

    describe("YArrayItemType", function () {

        var addressSpace;
        before(function() {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        var objectsFolder;
        before(function() {
            objectsFolder = addressSpace.findNode("ObjectsFolder");
            objectsFolder.browseName.toString().should.eql("Objects");
        });

        it("YArrayItemType should not be abstract",function() {

            var YArrayItemType = addressSpace.findVariableType("YArrayItemType");
            YArrayItemType.isAbstract.should.eql(false);

        });
        it("should add a YArrayItem",function() {

            var yArrayItem = addressSpace.addYArrayItem({

                organizedBy: objectsFolder,

                browseName: "MyYArrayItem",

                title: "My Little YArray Item",

                engineeringUnitsRange: {low: 100, high: 200},
                engineeringUnits: standardUnits.degree_celsius,

                axisScaleType: "Log",

                xAxisDefinition: {
                    engineeringUnits: standardUnits.second,
                    euRange: { low: -10, high: 100},
                    title:  coerceLocalizedText("the X axis legend"),
                    axisScaleType: "Linear",
                    axisSteps: [ 0, 25,50,75,100]
                },


                value: new Variant({
                    dataType: DataType.Float,
                    arrayType: VariantArrayType.Array,
                    value: [ 1,2,3,2]
                })
            });

            yArrayItem.browseName.toString().should.eql("MyYArrayItem");

            yArrayItem.dataType.should.eql(resolveNodeId("Float"));


            yArrayItem.readValue().value.value.length.should.eql(4);
            yArrayItem.readValue().value.value[0].should.eql(1);
            yArrayItem.readValue().value.value[1].should.eql(2);
            yArrayItem.readValue().value.value[2].should.eql(3);
            yArrayItem.readValue().value.value[3].should.eql(2);

            yArrayItem.hasOwnProperty("instrumentRange").should.eql(false,"optional instrument Range not expected");

            yArrayItem.euRange.readValue().value.value.low.should.eql(100);
            yArrayItem.euRange.readValue().value.value.high.should.eql(200);


            yArrayItem.title.readValue().value.value.text.should.eql("My Little YArray Item");


            // access xAxisDefinition from extension object
            var x = yArrayItem.xAxisDefinition.readValue().value.value;

            x.engineeringUnits.should.eql(standardUnits.second);
            x.title.text.should.eql("the X axis legend");
            x.euRange.low.should.eql(-10);
            x.euRange.high.should.eql(100);


            //xx console.log("xxxx ",yArrayItem.xAxisDefinition.toString())
            //xx yArrayItem.xAxisDefinition.euRange.readValue().value.value.should.eql(standardUnits.second);
            //xx yArrayItem.xAxisDefinition.engineeringUnits.readValue().value.value.should.eql(standardUnits.second);

        });
        it("should add a YArrayItem with optional instrument range",function() {

            var prop = addressSpace.addYArrayItem({

                organizedBy: objectsFolder,

                browseName: "MyYArrayItem",

                engineeringUnitsRange: {low: 100, high: 200},
                instrumentRange: {low: -100, high: +200},
                engineeringUnits: standardUnits.degree_celsius,

                axisScaleType: "Linear",

                xAxisDefinition: {
                    engineeringUnits: standardUnits.seconds,
                    euRange: { low: 0, high: 100},
                    title:  coerceLocalizedText("the X axis legend"),
                    axisScaleType: "Linear",
                    axisSteps: [ 0, 25,50,75,100]
                },

                value: new Variant({
                    dataType: DataType.Float,
                    arrayType: VariantArrayType.Array,
                    value: [ 1,2,3]
                }),

            });

            prop.browseName.toString().should.eql("MyYArrayItem");

            prop.dataType.should.eql(resolveNodeId("Float"));

            prop.instrumentRange.readValue().value.value.low.should.eql(-100);
            prop.instrumentRange.readValue().value.value.high.should.eql(200);

        });
    });
};
