"use strict";
var should = require("should");


var DataValue =  require("node-opcua-data-value").DataValue;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var SessionContext = require("../..").SessionContext;
var context = SessionContext.defaultContext;

var AddressSpace = require("../../").AddressSpace;

module.exports = function(maintest) {

    describe("MultiStateDiscreteType", function () {

        var addressSpace;
        before(function() {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("MultiStateDiscreteType should not be abstract",function() {

            var multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
            multiStateDiscreteType.isAbstract.should.eql(false);

        });

        it("should add a MultiStateDiscreteType variable",function() {

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
                multiState.writeValue(context, dataValue, null, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.BadOutOfRange);
                    done(err);
                });

            });
            it("writing a value within EnumString length shall return Good",function(done) {

                var dataValue = new DataValue({
                    value: new Variant({dataType: DataType.UInt32, value: 2})// OK
                });
                multiState.writeValue(context, dataValue, null, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    done(err);
                });

            });

        });

    });

};
