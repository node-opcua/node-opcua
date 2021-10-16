import * as fs from "fs";
import * as should from "should";
import * as sinon from "sinon";

import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";

import { AddressSpace, BaseNode, Namespace } from "..";
import { generateAddressSpace } from "../nodeJS";

let clock: any = null;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add TwoStateVariable ", function (this: any) {
    this.timeout(Math.max(this.timeout(), 10000));

    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_file = nodesets.standard;
        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);
        namespace = addressSpace.registerNamespace("MyPrivateNamespace");
        namespace.namespaceUri.should.eql("MyPrivateNamespace");
        namespace.index.should.eql(1);
    });
    after(async () => {
        addressSpace.dispose();
    });

    beforeEach(function (this: any) {
        clock = sinon.useFakeTimers();
    });
    afterEach(function (this: any) {
        clock.restore();
        clock = null;
    });

    it("should add a TwoStateVariableType", () => {
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
        node.readValue().value.value.text!.should.eql("TRUE");

        node.setValue(false);
        node.readValue().value.value.text!.should.eql("FALSE");
    });

    it("TwoStateVariableType should add an uncertain value after creation", () => {
        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable1"
        });

        node.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

        node.id!.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

        node.setValue(true);
        node.readValue().statusCode.should.eql(StatusCodes.Good);
        node.id.readValue().statusCode.should.eql(StatusCodes.Good);
    });

    it("should add a TwoStateVariableType with trueState and falseState as String", () => {
        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable1",
            falseState: "Disabled",
            trueState: "Enabled"
        });

        node.browseName.toString().should.eql("1:TwoStateVariable1");
        node.typeDefinitionObj.browseName.toString().should.eql("TwoStateVariableType");
        node.dataTypeObj.browseName.toString().should.eql("LocalizedText");
        node.valueRank.should.eql(-1);

        should.not.exist(node.transitionTime);

        node.setValue(true);
        node.readValue().value.value.text!.should.eql("Enabled");

        node.setValue(false);
        node.readValue().value.value.text!.should.eql("Disabled");
    });

    it("should add a TwoStateVariableType with transitionTime", function (this: any) {
        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable2",
            optionals: ["TransitionTime"]
        });
        should.exist(node.transitionTime);

        clock.tick(100);
        node.setValue(true);
        node.transitionTime!.readValue().value.value.getTime().should.eql(100);

        clock.tick(100);
        node.setValue(false);
        node.transitionTime!.readValue().value.value.getTime().should.eql(200);

        clock.tick(100);
        node.setValue(false);
        node.transitionTime!.readValue().value.value.getTime().should.eql(200, "again");
    });

    it("SubState => IsFalseSubStateOf", () => {
        const mainState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableMain",
            optionals: ["TransitionTime", "EffectiveDisplayName"]
        });
        const subState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableSub",
            isFalseSubStateOf: mainState,
            optionals: ["TransitionTime"]
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

    it("SubState => IsTrueSubStateOf", () => {
        function f(n: BaseNode): string {
            return n.browseName.toString();
        }

        const mainState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableMain",
            optionals: ["TransitionTime", "EffectiveDisplayName"]
        });
        const subState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableSub",
            isTrueSubStateOf: mainState,
            optionals: ["TransitionTime"]
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

    it("should add a TwoStateVariableType with effectiveTransitionTime", function (this: any) {
        const mainState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable2",
            optionals: ["EffectiveTransitionTime", "TransitionTime", "EffectiveDisplayName"]
        });
        should.exist(mainState.effectiveTransitionTime);

        const subState = namespace.addTwoStateVariable({
            browseName: "TwoStateVariableSub",
            falseState: "PowerOFF",
            isTrueSubStateOf: mainState,
            optionals: ["TransitionTime"],
            trueState: "PowerON"
        });
        mainState.effectiveTransitionTime!.readValue().statusCode.should.eql(StatusCodes.Good);

        mainState.getTrueSubStates().length.should.eql(1);
        mainState.getTrueSubStates()[0].browseName.toString().should.eql("1:TwoStateVariableSub");

        clock.tick(100);
        mainState.setValue(false);
        mainState.effectiveTransitionTime!.readValue().statusCode.should.eql(StatusCodes.Good);
        mainState.effectiveTransitionTime!.readValue().value.value.getTime().should.eql(100);
        mainState.transitionTime!.readValue().value.value.getTime().should.eql(100);

        clock.tick(100);
        subState.setValue(true);
        mainState.effectiveTransitionTime!.readValue().value.value.getTime().should.eql(200);
        mainState.transitionTime!.readValue().value.value.getTime().should.eql(100);

        clock.tick(100);
        subState.setValue(false);
        mainState.effectiveTransitionTime!.readValue().value.value.getTime().should.eql(300);
        mainState.transitionTime!.readValue().value.value.getTime().should.eql(100);

        //  todo
        // mainState.effectiveDisplayName.readValue().value.value.should.eql("aaa");
    });
});
