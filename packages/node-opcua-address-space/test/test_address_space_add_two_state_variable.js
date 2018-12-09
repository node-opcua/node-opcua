"use strict";
/* global describe,it,before*/

const should = require("should");
const _ = require("underscore");
const fs = require("fs");
const path = require("path");
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const generate_address_space = require("..").generate_address_space;

const sinon = require("sinon");
const AddressSpace = require("..").AddressSpace;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add TwoStateVariable ", function () {

    this.timeout(Math.max(this._timeout, 10000));

    let addressSpace,namespace;

    before(function (done) {
        addressSpace = new AddressSpace();
        const xml_file = require("node-opcua-nodesets").standard_nodeset_file;
        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            namespace = addressSpace.registerNamespace("MyPrivateNamespace");
            namespace.namespaceUri.should.eql("MyPrivateNamespace");
            namespace.index.should.eql(1);


            done(err);
        });
    });
    after(function (done) {
        addressSpace.dispose();
        addressSpace = null;
        done();
    });
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        this.clock.restore();
    });

    it("should add a TwoStateVariableType", function () {

        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable1"
        });

        node.browseName.toString().should.eql("1:TwoStateVariable1");
        node.typeDefinitionObj.browseName.toString().should.eql("TwoStateVariableType");
        node.dataTypeObj.browseName.toString().should.eql("LocalizedText");
        node.valueRank.should.eql(-1);

        should.not.exist(node.transitionTime);

        node.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

        node.setValue(true);
        node.readValue().value.value.text.should.eql("TRUE");

        node.setValue(false);
        node.readValue().value.value.text.should.eql("FALSE");

    });

    it("TwoStateVariableType should add an uncertain value after creation", function () {

        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable1"
        });

        node.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

        node.id.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

        node.setValue(true);
        node.readValue().statusCode.should.eql(StatusCodes.Good);
        node.id.readValue().statusCode.should.eql(StatusCodes.Good);

    });

    it("should add a TwoStateVariableType with trueState and falseState as String", function () {
        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable1",
            trueState: "Enabled",
            falseState: "Disabled"
        });

        node.browseName.toString().should.eql("1:TwoStateVariable1");
        node.typeDefinitionObj.browseName.toString().should.eql("TwoStateVariableType");
        node.dataTypeObj.browseName.toString().should.eql("LocalizedText");
        node.valueRank.should.eql(-1);

        should.not.exist(node.transitionTime);

        node.setValue(true);
        node.readValue().value.value.text.should.eql("Enabled");

        node.setValue(false);
        node.readValue().value.value.text.should.eql("Disabled");
    });

    it("should add a TwoStateVariableType with transitionTime", function () {

        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable2",
            optionals: ["TransitionTime"]
        });
        should.exist(node.transitionTime);

        this.clock.tick(100);
        node.setValue(true);
        node.transitionTime.readValue().value.value.getTime().should.eql(100);

        this.clock.tick(100);
        node.setValue(false);
        node.transitionTime.readValue().value.value.getTime().should.eql(200);

        this.clock.tick(100);
        node.setValue(false);
        node.transitionTime.readValue().value.value.getTime().should.eql(200, "again");

    });

    it("SubState => IsFalseSubStateOf", function () {

        const mainState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableMain",
            optionals: ["TransitionTime", "EffectiveDisplayName"]
        });
        const subState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableSub",
            optionals: ["TransitionTime"],
            isFalseSubStateOf: mainState
        });

        should(mainState.isTrueSubStateOf).eql(null);
        should(mainState.isFalseSubStateOf).eql(null);
        mainState.getFalseSubStates().should.eql([subState]);
        mainState.getTrueSubStates().should.eql([]);

        should(subState.isFalseSubStateOf).eql(mainState);
        should(subState.isTrueSubStateOf).eql(null);
        subState.getFalseSubStates().should.eql([]);
        subState.getTrueSubStates().should.eql([]);

    });

    it("SubState => IsTrueSubStateOf", function () {

        function f(n) {
            return n.browseName.toString();
        }

        const mainState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableMain",
            optionals: ["TransitionTime", "EffectiveDisplayName"]
        });
        const subState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableSub",
            optionals: ["TransitionTime"],
            isTrueSubStateOf: mainState
        });

        should(mainState.isTrueSubStateOf).eql(null);
        should(mainState.isFalseSubStateOf).eql(null);
        mainState.getFalseSubStates().should.eql([]);
        mainState.getTrueSubStates().map(f).should.eql(["1:TwoStateVariableSub"]);

        should(subState.isTrueSubStateOf).eql(mainState);
        should(subState.isFalseSubStateOf).eql(null);
        subState.getFalseSubStates().length.should.eql(0);
        subState.getTrueSubStates().length.should.eql(0);

    });


    it("should add a TwoStateVariableType with effectiveTransitionTime", function () {

        const mainState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable2",
            optionals: ["EffectiveTransitionTime", "TransitionTime", "EffectiveDisplayName"]
        });
        should.exist(mainState.effectiveTransitionTime);

        const subState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableSub",
            optionals: ["TransitionTime"],
            isTrueSubStateOf: mainState,
            trueState: "PowerON",
            falseState: "PowerOFF"

        });
        mainState.getTrueSubStates().length.should.eql(1);
        mainState.getTrueSubStates()[0].browseName.toString().should.eql("1:TwoStateVariableSub");

        this.clock.tick(100);
        mainState.setValue(false);
        mainState.effectiveTransitionTime.readValue().value.value.getTime().should.eql(100);
        mainState.transitionTime.readValue().value.value.getTime().should.eql(100);

        this.clock.tick(100);
        subState.setValue(true);
        mainState.effectiveTransitionTime.readValue().value.value.getTime().should.eql(200);
        mainState.transitionTime.readValue().value.value.getTime().should.eql(100);

        this.clock.tick(100);
        subState.setValue(false);
        mainState.effectiveTransitionTime.readValue().value.value.getTime().should.eql(300);
        mainState.transitionTime.readValue().value.value.getTime().should.eql(100);

        //  todo
        // mainState.effectiveDisplayName.readValue().value.value.should.eql("aaa");

    });

});
