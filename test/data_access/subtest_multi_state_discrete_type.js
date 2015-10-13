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

var async = require("async");

var path = require("path");

var addMultiStateDiscreteType = require("lib/data_access/UAMultiStateDiscreteType").addMultiStateDiscreteType;

module.exports = function(engine) {

    describe("MultiStateDiscreteType", function () {

        it("MultiStateDiscreteType should not be abstract",function() {

            var address_space = engine.address_space;
            var multiStateDiscreteType = address_space.findVariableType("MultiStateDiscreteType");
            multiStateDiscreteType.isAbstract.should.eql(false);

        });

        it("should add a MultiStateDiscreteType variable",function() {

            var address_space = engine.address_space;
            var rootFolder = address_space.findObject("ObjectsFolder");
            rootFolder.browseName.toString().should.eql("Objects");

            var prop = addMultiStateDiscreteType(rootFolder,{
                browseName: "MyMultiStateVariable",
                enumStrings: [ "Red","Orange","Green"],
                value: 1 // Orange
            });
            prop.browseName.toString().should.eql("MyMultiStateVariable");

            prop.valueRank.should.eql(-2);

            prop.getPropertyByName("EnumStrings").readValue().value.toString()
                .should.eql("Variant(Array<LocalizedText>, l= 3, value=[locale=null text=Red,locale=null text=Orange,locale=null text=Green])");

            prop.enumStrings.readValue().value.dataType.should.eql(DataType.LocalizedText);

            prop.readValue().value.toString().should.eql("Variant(Scalar<UInt32>, value: 1)");
            prop.readValue().value.dataType.should.eql(DataType.UInt32);
        });

        describe("edge case tests",function() {

            var multiState;
            before(function() {
                var address_space = engine.address_space;
                var rootFolder = address_space.findObject("ObjectsFolder");
                rootFolder.browseName.toString().should.eql("Objects");
                multiState = addMultiStateDiscreteType(rootFolder,{
                    browseName: "MyMultiStateVariable",
                    enumStrings: [ "Red","Orange","Green"],
                    value: 1 // Orange
                });

            });
            after(function() {

            });
            it("writing a value exceeding EnumString length shall return BadOutOfRange",function(done) {

                var dataValue = new DataValue({
                    value: new Variant({dataType: DataType.UInt32, value: 100})// out of range
                });
                multiState.writeValue(dataValue,null,function(err,statusCode){
                    statusCode.should.eql(StatusCodes.BadOutOfRange);
                    done(err);
                });

            });
            it("writing a value within EnumString length shall return Good",function(done) {

                var dataValue = new DataValue({
                    value: new Variant({dataType: DataType.UInt32, value: 2})// OK
                });
                multiState.writeValue(dataValue,null,function(err,statusCode){
                    statusCode.should.eql(StatusCodes.Good);
                    done(err);
                });

            });


        });

    });

};
