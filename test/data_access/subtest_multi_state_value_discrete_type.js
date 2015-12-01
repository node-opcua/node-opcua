require("requirish")._(module);
var _ = require("underscore");
var should = require("should");
var server_engine = require("lib/server/server_engine");

var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;

var async = require("async");

var path = require("path");


module.exports = function(engine) {

    describe("MultiStateValueDiscreteType", function () {

        it("MultiStateValueDiscreteType should not be abstract",function() {

            var addressSpace = engine.addressSpace;
            var multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType");
            multiStateValueDiscreteType.isAbstract.should.eql(false);

        });

        it("should add a MultiStateValueDiscreteType variable - form 1",function() {

            var addressSpace = engine.addressSpace;
            var rootFolder = addressSpace.findObject("ObjectsFolder");
            rootFolder.browseName.toString().should.eql("Objects");

            var prop = addressSpace.addMultiStateValueDiscreteType({
                componentOf: rootFolder,
                browseName: "MyMultiStateValueVariable",
                enumValues: { "Red": 0xFF0000,"Orange": 0xFF9933,"Green":0x00FF00,"Blue": 0x0000FF },
                value: 0xFF0000 // Red
            });
            prop.browseName.toString().should.eql("MyMultiStateValueVariable");

            prop.valueRank.should.eql(-1); //ValueRank=Scalar

            var v = prop.getPropertyByName("EnumValues").readValue().value;
            v.dataType.should.eql(DataType.ExtensionObject);
            v.arrayType.should.eql(VariantArrayType.Array);
            v.value.length.should.eql(4);
            v.value[0].constructor.name.should.eql("EnumValueType");
            //xx .should.eql("Variant(Array<LocalizedText>, l= 3, value=[locale=null text=Red,locale=null text=Orange,locale=null text=Green])");


            prop.readValue().value.toString().should.eql("Variant(Scalar<UInt32>, value: 16711680)");
            prop.readValue().value.dataType.should.eql(DataType.UInt32);

            prop.valueAsText.readValue().value.value.text.should.eql("Red");

        });
        it("should add a MultiStateValueDiscreteType variable - form 2",function() {

            var addressSpace = engine.addressSpace;
            var rootFolder = addressSpace.findObject("ObjectsFolder");
            rootFolder.browseName.toString().should.eql("Objects");

            var prop = addressSpace.addMultiStateValueDiscreteType({
                componentOf: rootFolder,
                browseName: "MyMultiStateValueVariable",
                enumValues: [
                    { displayName: "Red",    value: 0xFF0000},
                    { displayName: "Orange", value: 0xFF9933},
                    { displayName: "Green",  value: 0x00FF00},
                    { displayName: "Blue",   value: 0x0000FF}
                ],
                value: 0xFF0000 // Red
            });
        });
        describe("edge case tests",function() {

            var multiStateValue;
            before(function() {
                var addressSpace = engine.addressSpace;
                var rootFolder = addressSpace.findObject("ObjectsFolder");
                rootFolder.browseName.toString().should.eql("Objects");
                multiStateValue = addressSpace.addMultiStateValueDiscreteType({
                    componentOf: rootFolder,
                    browseName: "MyMultiStateValueVariable",
                    enumValues: { "Red": 0xFF0000,"Orange": 0xFF9933,"Green":0x00FF00,"Blue": 0x0000FF },
                    value: 0xFF0000 // Red
                });

            });
            after(function() {

            });

            it("writing a value not in the EnumValues mapshall return BadOutOfRange",function(done) {

                var dataValue = new DataValue({
                    value: new Variant({dataType: DataType.UInt32, value: 100})// out of range
                });
                multiStateValue.writeValue(dataValue,null,function(err,statusCode){
                    statusCode.should.eql(StatusCodes.BadOutOfRange);
                    done(err);
                });
            });

            it("writing a value within EnumValues shall return Good",function(done) {

                var dataValue = new DataValue({
                    value: new Variant({dataType: DataType.UInt32, value: 0x0000FF})// OK
                });

                multiStateValue.writeValue(dataValue,null,function(err,statusCode){

                    statusCode.should.eql(StatusCodes.Good);

                    console.log(  multiStateValue._dataValue.toString())
                    console.log(  multiStateValue.valueAsText._dataValue.toString())
                    multiStateValue.valueAsText.readValue().value.value.text.should.eql("Blue");
                    done(err);
                });
            });

            it("changing  MultiStateVariable value shall change valueAsText accordingly",function(done) {
                var dataValue = new DataValue({
                    value: new Variant({dataType: DataType.UInt32, value: 0x00FF00})// OK
                });
                multiStateValue.writeValue(dataValue,null,function(err,statusCode){

                    statusCode.should.eql(StatusCodes.Good);
                    multiStateValue.valueAsText.readValue().value.value.text.should.eql("Green");

                    done(err);
                });
            });
        });

        it("ZZ2 should instantiate a DataType containing a MultiStateValueDiscreteType",function(done) {

            var addressSpace = engine.addressSpace;
            // create a new DataType
            var myObjectType = addressSpace.addObjectType({
                browseName: "MyObjectWithMultiStateValueDiscreteType"
            });
            var multiStateValue = addressSpace.addMultiStateValueDiscreteType({
                componentOf: myObjectType,
                browseName:  "Color",
                enumValues:  { "Red": 0xFF0000,"Orange": 0xFF9933,"Green":0x00FF00,"Blue": 0x0000FF },
                value: 0xFF0000 // Red
            });

            myObjectType.color.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
            // add


            // instanciate  the type
            var obj = myObjectType.instantiate({
                browseName:"MyObject"
            });

            // verification
            obj.color.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
            obj.color.valueAsText.readValue().value.value.text.should.eql("Red");
            obj.color.readValue().value.value.should.eql(0xFF0000);

            obj.color.enumValues.readValue().value.value[0].displayName.text.should.eql("Red");
            obj.color.enumValues.readValue().value.value[1].displayName.text.should.eql("Orange");
            obj.color.enumValues.readValue().value.value[2].displayName.text.should.eql("Green");
            obj.color.enumValues.readValue().value.value[3].displayName.text.should.eql("Blue");


            var greenValue = obj.color.enumValues.readValue().value.value[2].value[1];
            // now change the value => verify that valueAsText will change accordingly
            var dataValue = new DataValue({
                value: new Variant({dataType: DataType.UInt32, value: greenValue})// OK
            });

            obj.color.writeValue(dataValue,null,function(err,statusCode){
                statusCode.should.eql(StatusCodes.Good);

                // now verify that valueAsText has been updated accordingly...
                obj.color.valueAsText.readValue().value.value.text.should.eql("Green");
                done(err);
            });


        })
    });

};
