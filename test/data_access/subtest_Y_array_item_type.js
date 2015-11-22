require("requirish")._(module);
var _ = require("underscore");
var should = require("should");
var server_engine = require("lib/server/server_engine");

var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;
var standardUnits = require("lib/data_access/EUInformation").standardUnits;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var async = require("async");

var path = require("path");
var addYArrayItem = require("lib/data_access/UAYArrayItem").addYArrayItem;


var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

var schema_helpers =  require("lib/misc/factories_schema_helpers");
schema_helpers.doDebug = true;

module.exports = function(engine) {

    describe("YArrayItemType", function () {

        var rootFolder;
        var address_space;
        before(function() {
            address_space = engine.address_space;
            rootFolder = address_space.findObject("ObjectsFolder");
            rootFolder.browseName.toString().should.eql("Objects");
        });

        it("YArrayItemType should not be abstract",function() {

            var YArrayItemType = address_space.findVariableType("YArrayItemType");
            YArrayItemType.isAbstract.should.eql(false);

        });
        it("should add a YArrayItem",function() {

            var yArrayItem = addYArrayItem(rootFolder,{
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

            var prop = addYArrayItem(rootFolder,{
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
