import fs from "node:fs";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import sinon from "sinon";
import { AddressSpace, type BaseNode, type Namespace } from "../dist/api/index.js";
import { UATwoStateVariableImpl } from "../dist/impl/state_machine/ua_two_state_variable.js";
import { generateAddressSpace } from "../nodeJS.js";

let clock: sinon.SinonFakeTimers | null = null;

describe("testing add TwoStateVariable ", function (this: Mocha.Suite) {
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

    beforeEach(function (this: Mocha.Context) {
        clock = sinon.useFakeTimers();
    });
    afterEach(function (this: Mocha.Context) {
        clock?.restore();
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
        should(node.readValue().value.value.text).eql("TRUE");

        node.setValue(false);
        should(node.readValue().value.value.text).eql("FALSE");
    });

    it("TwoStateVariableType should add an uncertain value after creation", () => {
        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable1"
        });

        node.readValue().statusCode.should.eql(StatusCodes.UncertainInitialValue);

        should(node.id?.readValue().statusCode).eql(StatusCodes.UncertainInitialValue);

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
        should(node.readValue().value.value.text).eql("Enabled");

        node.setValue(false);
        should(node.readValue().value.value.text).eql("Disabled");
    });

    it("should keep the fallback text for the missing state property", () => {
        const trueStateNode = {
            readValue() {
                return {
                    value: {
                        value: { text: "Enabled" }
                    }
                };
            },
            setValueFromSource: sinon.spy()
        };
        // a plain intersection with UATwoStateVariableImpl collapses to never
        // (private _falseState), so describe just the members the test touches
        interface TwoStateVariableStub {
            _falseState: string;
            _postInitialize: sinon.SinonSpy;
            addReference: sinon.SinonSpy;
            falseState?: undefined;
            id: { setValueFromSource: sinon.SinonSpy };
            trueState: typeof trueStateNode;
            initialize: UATwoStateVariableImpl["initialize"];
            getTrueState: UATwoStateVariableImpl["getTrueState"];
            getFalseState: UATwoStateVariableImpl["getFalseState"];
        }
        const node = Object.create(UATwoStateVariableImpl.prototype) as TwoStateVariableStub;
        node.trueState = trueStateNode;
        node.falseState = undefined;
        node.addReference = sinon.spy();
        node.id = { setValueFromSource: sinon.spy() };
        node._postInitialize = sinon.spy();

        node.initialize({
            falseState: "Disabled",
            trueState: "Enabled",
            value: false
        });

        trueStateNode.setValueFromSource.calledOnce.should.eql(true);
        should(node.getTrueState().text).eql("Enabled");
        should(node.getFalseState().text).eql("Disabled");
        node._falseState.should.eql("Disabled");
    });

    it("should add a TwoStateVariableType with transitionTime", function (this: Mocha.Context) {
        const node = namespace.addTwoStateVariable({
            browseName: "TwoStateVariable2",
            optionals: ["TransitionTime"]
        });
        should.exist(node.transitionTime);

        clock?.tick(100);
        node.setValue(true);
        should(node.transitionTime?.readValue().value.value.getTime()).eql(100);

        clock?.tick(100);
        node.setValue(false);
        should(node.transitionTime?.readValue().value.value.getTime()).eql(200);

        clock?.tick(100);
        node.setValue(false);
        should(node.transitionTime?.readValue().value.value.getTime()).eql(200, "again");
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

    it("should add a TwoStateVariableType with effectiveTransitionTime", function (this: Mocha.Context) {
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
        should(mainState.effectiveTransitionTime?.readValue().statusCode).eql(StatusCodes.Good);

        mainState.getTrueSubStates().length.should.eql(1);
        mainState.getTrueSubStates()[0].browseName.toString().should.eql("1:TwoStateVariableSub");

        clock?.tick(100);
        mainState.setValue(false);
        should(mainState.effectiveTransitionTime?.readValue().statusCode).eql(StatusCodes.Good);
        should(mainState.effectiveTransitionTime?.readValue().value.value.getTime()).eql(100);
        should(mainState.transitionTime?.readValue().value.value.getTime()).eql(100);

        clock?.tick(100);
        subState.setValue(true);
        should(mainState.effectiveTransitionTime?.readValue().value.value.getTime()).eql(200);
        should(mainState.transitionTime?.readValue().value.value.getTime()).eql(100);

        clock?.tick(100);
        subState.setValue(false);
        should(mainState.effectiveTransitionTime?.readValue().value.value.getTime()).eql(300);
        should(mainState.transitionTime?.readValue().value.value.getTime()).eql(100);

        //  todo
        // mainState.effectiveDisplayName.readValue().value.value.should.eql("aaa");
    });
});
