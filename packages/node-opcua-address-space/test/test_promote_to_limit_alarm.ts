/**
 * Giving a limit alarm that came from a nodeset XML the behaviour of a live limit alarm, in place.
 *
 * The alarms are built with `objectType.instantiate()` in a first address space, dumped to a
 * NodeSet2 XML and loaded into a second one, so the nodes under test are exactly what a companion
 * specification model hands a server: the right children, the limit values, an InputNode, and no
 * machinery. `promoteToLimitAlarm` has to make them work without changing their identity.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { coerceLocalizedText } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";
import sinon from "sinon";

import {
    AddressSpace,
    type Namespace,
    promoteToAlarm,
    promoteToLimitAlarm,
    SessionContext,
    type UAExclusiveLimitAlarmEx,
    type UANonExclusiveLimitAlarmEx,
    type UAObject,
    type UAObjectType,
    type UAVariable
} from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

const namespaceUri = "urn:PromoteToLimitAlarm";

/** builds the model the way a modelling tool would, and returns the NodeSet2 XML file */
async function makeNodeSet(): Promise<string> {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [nodesets.standard]);
    const ns = addressSpace.registerNamespace(namespaceUri);

    const boiler = ns.addObject({
        browseName: "Boiler",
        nodeId: "s=Boiler",
        eventNotifier: 0x1,
        organizedBy: addressSpace.rootFolder.objects
    });
    const temperature = ns.addVariable({
        browseName: "Temperature",
        nodeId: "s=Temperature",
        dataType: "Double",
        componentOf: boiler
    });
    const pressure = ns.addVariable({
        browseName: "Pressure",
        nodeId: "s=Pressure",
        dataType: "Double",
        componentOf: boiler
    });

    const setLimit = (alarm: UAObject, name: string, value: number) =>
        (alarm.getPropertyByName(name) as UAVariable).setValueFromSource({ dataType: DataType.Double, value });

    const exclusiveType = addressSpace.findObjectType("ExclusiveLimitAlarmType") as UAObjectType;
    const exclusive = exclusiveType.instantiate({
        browseName: "TemperatureAlarm",
        nodeId: "s=TemperatureAlarm",
        componentOf: boiler,
        optionals: ["HighHighLimit", "HighLimit", "LowLimit", "LowLowLimit"]
    });
    setLimit(exclusive, "HighHighLimit", 100);
    setLimit(exclusive, "HighLimit", 10);
    setLimit(exclusive, "LowLimit", 1);
    setLimit(exclusive, "LowLowLimit", -10);
    (exclusive.getPropertyByName("InputNode") as UAVariable).setValueFromSource({
        dataType: DataType.NodeId,
        value: temperature.nodeId
    });

    // no HighHigh limit in the model: the test gives it through the options
    const nonExclusiveType = addressSpace.findObjectType("NonExclusiveLimitAlarmType") as UAObjectType;
    const nonExclusive = nonExclusiveType.instantiate({
        browseName: "PressureAlarm",
        nodeId: "s=PressureAlarm",
        componentOf: boiler,
        optionals: ["HighLimit", "HighState", "LowLimit", "LowState", "LowLowLimit", "LowLowState"]
    });
    setLimit(nonExclusive, "HighLimit", 10);
    setLimit(nonExclusive, "LowLimit", -1);
    setLimit(nonExclusive, "LowLowLimit", -10);
    (nonExclusive.getPropertyByName("InputNode") as UAVariable).setValueFromSource({
        dataType: DataType.NodeId,
        value: pressure.nodeId
    });

    // a reference of the model's own, which promotion must leave alone
    boiler.addReference({ referenceType: "HasCondition", nodeId: exclusive.nodeId });
    boiler.addReference({ referenceType: "HasCondition", nodeId: nonExclusive.nodeId });

    const filename = path.join(os.tmpdir(), "promote_to_limit_alarm.xml");
    await fs.promises.writeFile(filename, ns.toNodeset2XML());
    addressSpace.dispose();
    return filename;
}

function acknowledge(alarm: UAExclusiveLimitAlarmEx | UANonExclusiveLimitAlarmEx, comment: string): Promise<StatusCodes> {
    const context = new SessionContext({ object: alarm });
    const inputArguments = [
        { dataType: DataType.ByteString, value: alarm.eventId.readValue().value.value },
        { dataType: DataType.LocalizedText, value: coerceLocalizedText(comment) }
    ];
    return new Promise((resolve, reject) => {
        alarm.acknowledge.execute(null, inputArguments, context, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result?.statusCode as StatusCodes);
            }
        });
    });
}

const referenceKeys = (node: UAObject) =>
    node
        .allReferences()
        .map((r) => `${r.referenceType.toString()}|${r.isForward}|${r.nodeId.toString()}`)
        .sort();

describe("promoteToLimitAlarm", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30000));

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let boiler: UAObject;
    let temperature: UAVariable;
    let pressure: UAVariable;

    const nodeId = (s: string) => new NodeId(NodeId.NodeIdType.STRING, s, addressSpace.getNamespaceIndex(namespaceUri));
    const setValue = (variable: UAVariable, value: number) => variable.setValueFromSource({ dataType: DataType.Double, value });

    before(async () => {
        const xmlFile = await makeNodeSet();
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, xmlFile]);
        namespace = addressSpace.registerNamespace("Private");
        addressSpace.installAlarmsAndConditionsService();

        boiler = addressSpace.findNode(nodeId("Boiler")) as UAObject;
        temperature = addressSpace.findNode(nodeId("Temperature")) as UAVariable;
        pressure = addressSpace.findNode(nodeId("Pressure")) as UAVariable;
        should.exist(boiler);
        // the condition source has to be an event source, or the condition wiring refuses it
        addressSpace.rootFolder.objects.server.addReference({ referenceType: "HasEventSource", nodeId: boiler.nodeId });
        setValue(temperature, 5);
        setValue(pressure, 0);
    });

    after(() => addressSpace.dispose());

    it("PTLA-1 - drives an ExclusiveLimitAlarm loaded from a nodeset through its limit states", async () => {
        const node = addressSpace.findNode(nodeId("TemperatureAlarm")) as UAObject;
        const referencesBefore = referenceKeys(node);

        // the input node and the limits are the ones in the model
        const alarm = promoteToLimitAlarm(node, { conditionSource: boiler }) as UAExclusiveLimitAlarmEx;

        should(alarm === (node as unknown as UAExclusiveLimitAlarmEx)).eql(true);
        should(addressSpace.findNode(nodeId("TemperatureAlarm")) === node).eql(true);
        should(alarm.nodeId.toString()).eql(nodeId("TemperatureAlarm").toString());
        should(alarm.constructor.name).eql("UAExclusiveLimitAlarmImplBase");
        // every reference of the model is still there
        const referencesAfter = referenceKeys(node);
        for (const key of referencesBefore) {
            should(referencesAfter).containEql(key);
        }
        should(boiler.getComponentByName("TemperatureAlarm") === node).eql(true);

        should(alarm.getHighHighLimit()).eql(100);
        should(alarm.getHighLimit()).eql(10);
        should(alarm.getLowLimit()).eql(1);
        should(alarm.getLowLowLimit()).eql(-10);
        should(alarm.getInputNodeNode()).eql(temperature);

        // initial state: in range
        should(alarm.limitState.getCurrentState()).eql(null);
        should(alarm.activeState.getValue()).eql(false);

        const spyOnEvent = sinon.spy();
        alarm.on("event", spyOnEvent);

        setValue(temperature, -100);
        should(alarm.limitState.getCurrentState()).eql("LowLow");
        should(alarm.activeState.getValue()).eql(true);
        should(spyOnEvent.callCount).eql(1);
        should(spyOnEvent.getCall(0).args[0].message.value.text).eql("Condition is -100.000 and state is LowLow");
        should(spyOnEvent.getCall(0).args[0].sourceNode.value.toString()).eql(boiler.nodeId.toString());

        setValue(temperature, -9);
        should(alarm.limitState.getCurrentState()).eql("Low");
        should(spyOnEvent.callCount).eql(2);

        // acknowledged through the Acknowledge method, as a client would
        should(await acknowledge(alarm, "seen it")).eql(StatusCodes.Good);
        should(alarm.ackedState.getValue()).eql(true);
        // the condition event with the new AckedState, then the AuditConditionAcknowledgeEvent
        should(spyOnEvent.callCount).eql(4);
        should(spyOnEvent.getCall(2).args[0].ackedState.value.text).eql("Acknowledged");
        should(spyOnEvent.getCall(3).args[0].eventType.value.toString()).eql("ns=0;i=8944");

        // back in range, the acknowledged state needs no branch: one event
        setValue(temperature, 4);
        should(alarm.limitState.getCurrentState()).eql(null);
        should(alarm.activeState.getValue()).eql(false);
        should(spyOnEvent.callCount).eql(5);
        should(spyOnEvent.getCall(4).args[0].message.value.text).eql("Back to normal");

        setValue(temperature, 11);
        should(alarm.limitState.getCurrentState()).eql("High");
        should(alarm.activeState.getValue()).eql(true);

        setValue(temperature, 200);
        should(alarm.limitState.getCurrentState()).eql("HighHigh");
        should(spyOnEvent.callCount).eql(7);
        should(spyOnEvent.getCall(6).args[0].message.value.text).eql("Condition is 200.000 and state is HighHigh");

        // a limit written later is watched too
        alarm.setHighHighLimit(300);
        should(alarm.limitState.getCurrentState()).eql("High");

        alarm.removeListener("event", spyOnEvent);
        setValue(temperature, 5);
    });

    it("PTLA-2 - drives a NonExclusiveLimitAlarm, and adds the limit the model did not have", async () => {
        const node = addressSpace.findNode(nodeId("PressureAlarm")) as UAObject;
        const referencesBefore = referenceKeys(node);
        should.not.exist(node.getPropertyByName("HighHighLimit"));
        should.not.exist(node.getComponentByName("HighHighState"));

        // LowLow overridden, HighHigh added; the others come from the model
        const alarm = promoteToLimitAlarm(node, {
            conditionSource: boiler,
            inputNode: pressure,
            highHighLimit: 100,
            lowLowLimit: -20
        }) as UANonExclusiveLimitAlarmEx;

        should(alarm === (node as unknown as UANonExclusiveLimitAlarmEx)).eql(true);
        should(alarm.constructor.name).eql("UANonExclusiveLimitAlarmImplBase");
        const referencesAfter = referenceKeys(node);
        for (const key of referencesBefore) {
            should(referencesAfter).containEql(key);
        }

        should(alarm.getHighHighLimit()).eql(100);
        should(alarm.getHighLimit()).eql(10);
        should(alarm.getLowLimit()).eql(-1);
        should(alarm.getLowLowLimit()).eql(-20);
        should.exist(alarm.highHighState);

        should(alarm.activeState.getValue()).eql(false);
        should(alarm.lowLowState?.getValue()).eql(false);
        should(alarm.lowState?.getValue()).eql(false);
        should(alarm.highState?.getValue()).eql(false);
        should(alarm.highHighState?.getValue()).eql(false);

        const spyOnEvent = sinon.spy();
        alarm.on("event", spyOnEvent);

        setValue(pressure, -100);
        should(alarm.activeState.getValue()).eql(true);
        should(alarm.lowLowState?.getValue()).eql(true);
        should(alarm.lowState?.getValue()).eql(true);
        should(spyOnEvent.callCount).eql(1);

        setValue(pressure, -9);
        should(alarm.lowLowState?.getValue()).eql(false);
        should(alarm.lowState?.getValue()).eql(true);
        should(spyOnEvent.callCount).eql(2);

        should(await acknowledge(alarm, "seen it")).eql(StatusCodes.Good);
        should(alarm.ackedState.getValue()).eql(true);
        should(spyOnEvent.callCount).eql(4);
        should(spyOnEvent.getCall(2).args[0].ackedState.value.text).eql("Acknowledged");
        should(spyOnEvent.getCall(3).args[0].eventType.value.toString()).eql("ns=0;i=8944");

        setValue(pressure, 4);
        should(alarm.activeState.getValue()).eql(false);
        should(alarm.lowState?.getValue()).eql(false);
        should(spyOnEvent.callCount).eql(5);
        should(spyOnEvent.getCall(4).args[0].message.value.text).eql("Back to normal");

        setValue(pressure, 11);
        should(alarm.highState?.getValue()).eql(true);
        should(alarm.highHighState?.getValue()).eql(false);

        setValue(pressure, 200);
        should(alarm.activeState.getValue()).eql(true);
        should(alarm.highState?.getValue()).eql(true);
        should(alarm.highHighState?.getValue()).eql(true);
        should(spyOnEvent.callCount).eql(7);

        alarm.removeListener("event", spyOnEvent);
        setValue(pressure, 0);
    });

    it("PTLA-3 - is idempotent", () => {
        const node = addressSpace.findNode(nodeId("TemperatureAlarm")) as UAObject;
        const alarm1 = promoteToLimitAlarm(node);
        const alarm2 = promoteToLimitAlarm(node, { highLimit: 0 });
        should(alarm2 === alarm1).eql(true);
        // the second call changed nothing
        should(alarm1.getHighLimit()).eql(10);
    });

    it("PTLA-4 - promoteToAlarm hands a limit alarm over to promoteToLimitAlarm", () => {
        const objectType = addressSpace.findObjectType("ExclusiveLevelAlarmType") as UAObjectType;
        const node = objectType.instantiate({
            browseName: "LevelAlarm",
            componentOf: boiler,
            optionals: ["HighLimit"]
        });
        const alarm = promoteToAlarm(node, { conditionSource: boiler, inputNode: temperature }) as UAExclusiveLimitAlarmEx;
        should(alarm.constructor.name).eql("UAExclusiveLevelAlarmImpl");

        // the option overrides the value the model gave HighLimit
        const node2 = objectType.instantiate({ browseName: "LevelAlarm2", componentOf: boiler, optionals: ["HighLimit"] });
        const alarm2 = promoteToLimitAlarm(node2, {
            conditionSource: boiler,
            inputNode: temperature,
            highLimit: 50
        }) as UAExclusiveLimitAlarmEx;
        setValue(temperature, 60);
        should(alarm2.limitState.getCurrentState()).eql("High");
        should(alarm2.getHighLimit()).eql(50);
        setValue(temperature, 5);
        should(alarm2.limitState.getCurrentState()).eql(null);
    });

    it("PTLA-5 - refuses a node that is not a limit alarm", () => {
        const notAnAlarm = namespace.addObject({ browseName: "NotAnAlarm", organizedBy: addressSpace.rootFolder.objects });
        should(() => promoteToLimitAlarm(notAnAlarm)).throwError(/does not derive from LimitAlarmType/);

        const plainType = addressSpace.findObjectType("AlarmConditionType") as UAObjectType;
        const plainAlarm = plainType.instantiate({ browseName: "PlainAlarm", componentOf: boiler });
        should(() => promoteToLimitAlarm(plainAlarm)).throwError(/does not derive from LimitAlarmType/);
    });

    it("PTLA-6 - refuses a limit alarm with no input node", () => {
        const objectType = addressSpace.findObjectType("ExclusiveLimitAlarmType") as UAObjectType;
        const node = objectType.instantiate({ browseName: "NoInput", componentOf: boiler, optionals: ["HighLimit"] });
        should(() => promoteToLimitAlarm(node, { conditionSource: boiler, highLimit: 5 })).throwError(/needs an input node/);
    });
});
