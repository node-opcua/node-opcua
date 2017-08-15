"use strict";
var should = require("should");

var AddressSpace = require("../../").AddressSpace;

module.exports = function(maintest) {

    describe("TwoStateDiscreteType", function () {

        var addressSpace;
        before(function() {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("should add a TwoStateDiscreteType variable",function() {

            var objectsFolder = addressSpace.findNode("ObjectsFolder");
            objectsFolder.browseName.toString().should.eql("Objects");

            var prop = addressSpace.addTwoStateDiscrete({
                organizedBy: objectsFolder,
                browseName: "MySwitch",
                trueState: "busy",
                falseState: "idle",
                value: false
            });
            prop.browseName.toString().should.eql("MySwitch");

            prop.getPropertyByName("TrueState").readValue().value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=busy)");

            prop.getPropertyByName("FalseState").readValue().value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=idle)");

            prop.readValue().value.toString().should.eql("Variant(Scalar<Boolean>, value: false)");
        });

    });

};
