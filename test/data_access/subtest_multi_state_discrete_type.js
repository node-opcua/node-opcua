require("requirish")._(module);
var _ = require("underscore");
var should = require("should");
import ServerEngine from "lib/server/ServerEngine";

var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;

var async = require("async");

var path = require("path");


module.exports = function(engine) {

    describe("MultiStateDiscreteType", function () {

        it("MultiStateDiscreteType should not be abstract",function() {

            var addressSpace = engine.addressSpace;
            var multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
            multiStateDiscreteType.isAbstract.should.eql(false);

        });

        it("should add a MultiStateDiscreteType variable",function() {

            var addressSpace = engine.addressSpace;
            var objectsFolder = addressSpace.findNode("ObjectsFolder");
            objectsFolder.browseName.toString().should.eql("Objects");

            var prop = addressSpace.addMultiStateDiscrete({
                organizedBy: objectsFolder,
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
                var addressSpace = engine.addressSpace;
                var objectsFolder = addressSpace.findNode("ObjectsFolder");
                objectsFolder.browseName.toString().should.eql("Objects");
                multiState = addressSpace.addMultiStateDiscrete({
                    organizedBy: objectsFolder,
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
