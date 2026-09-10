/**
 * Giving an existing node the behaviour of the alarm its type already says it is.
 *
 * `namespace.instantiateAlarmCondition` is not the only way an alarm node comes into being: a
 * nodeset XML, or a plain `objectType.instantiate()`, produces a node with all the right children
 * and none of the condition machinery. `promoteToAlarm` closes that gap in place, which is what
 * the identity assertions below are checking - the node the address space already indexes, and
 * that other nodes already reference, has to be the node that comes back.
 */
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";

import {
    AddressSpace,
    type Namespace,
    promoteToAlarm,
    type UAAlarmConditionEx,
    type UAObject,
    type UAObjectType,
    type UAVariable
} from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("promoteToAlarm", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30000));

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let source: UAObject;
    let inputNode: UAVariable;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.registerNamespace("Private");
        addressSpace.installAlarmsAndConditionsService();

        const green = namespace.addObject({
            browseName: "Green",
            eventNotifier: 0x1,
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: addressSpace.rootFolder.objects
        });
        // the condition source has to be an event source, or the condition wiring refuses it
        source = namespace.addObject({ browseName: "Boiler", componentOf: green, eventSourceOf: green });
        inputNode = namespace.addVariable({ browseName: "BoilerTemperature", dataType: "Double", propertyOf: source });
        inputNode.setValueFromSource({ dataType: DataType.Double, value: 0 });
    });

    after(() => addressSpace.dispose());

    const alarmConditionType = () => {
        const t = addressSpace.findObjectType("AlarmConditionType");
        should.exist(t);
        return t as UAObjectType;
    };

    const bareAlarm = (browseName: string, typeName = "AlarmConditionType"): UAObject => {
        const objectType = addressSpace.findObjectType(typeName);
        should.exist(objectType);
        return (objectType as UAObjectType).instantiate({
            browseName,
            componentOf: source,
            optionals: ["ConfirmedState", "Confirm"]
        });
    };

    it("PTA-1 - turns an inert node from objectType.instantiate into a working alarm", () => {
        const node = bareAlarm("PlainAlarm");

        // before promotion the node is an ordinary object: none of the condition API is there
        should(typeof (node as unknown as Partial<UAAlarmConditionEx>).activateAlarm).eql("undefined");
        should(typeof (node as unknown as Partial<UAAlarmConditionEx>).signalNewCondition).eql("undefined");

        const alarm = promoteToAlarm(node, { conditionSource: source, inputNode });

        should(typeof alarm.activateAlarm).eql("function");
        should(typeof alarm.signalNewCondition).eql("function");

        alarm.activateAlarm();
        should(alarm.activeState.getValue()).eql(true);
        should(alarm.currentBranch().getRetain()).eql(true);

        alarm.deactivateAlarm();
        should(alarm.activeState.getValue()).eql(false);
    });

    it("PTA-2 - promotes in place, so the node keeps its identity in the address space", () => {
        const node = bareAlarm("InPlaceAlarm");
        const nodeId = node.nodeId;

        const alarm = promoteToAlarm(node, { conditionSource: source, inputNode });

        should(alarm === (node as unknown as UAAlarmConditionEx)).eql(true);
        should(addressSpace.findNode(nodeId) === (alarm as unknown as UAObject)).eql(true);
        // the reference that made it a component of the source is untouched
        should(source.getComponentByName("InPlaceAlarm") === (alarm as unknown as UAObject)).eql(true);
    });

    it("PTA-3 - is idempotent", () => {
        const node = bareAlarm("IdempotentAlarm");

        const alarm1 = promoteToAlarm(node, { conditionSource: source, inputNode });
        const alarm2 = promoteToAlarm(node);

        should(alarm2 === alarm1).eql(true);
        alarm1.activateAlarm();
        should(alarm1.activeState.getValue()).eql(true);
    });

    it("PTA-4 - runs an assigned onInputDataValueChange when the input node value changes", () => {
        const node = bareAlarm("HookedAlarm");
        const alarm = promoteToAlarm(node, { conditionSource: source, inputNode });

        const seen: number[] = [];
        alarm.onInputDataValueChange = (newValue) => {
            seen.push(newValue.value.value as number);
        };

        inputNode.setValueFromSource({ dataType: DataType.Double, value: 77.0 });

        should(seen).eql([77.0]);
    });

    it("PTA-5 - refuses a node that is not an alarm", () => {
        const notAnAlarm = namespace.addObject({ browseName: "NotAnAlarm", organizedBy: addressSpace.rootFolder.objects });

        should(() => promoteToAlarm(notAnAlarm)).throwError(/does not derive from AlarmConditionType/);
    });

    it("PTA-6 - refuses a limit alarm rather than half promoting it", () => {
        const node = bareAlarm("LimitAlarm", "ExclusiveLevelAlarmType");

        should(() => promoteToAlarm(node, { conditionSource: source, inputNode })).throwError(
            /ExclusiveLevelAlarmType.*limit alarm/
        );
    });

    it("PTA-8 - refuses a certificate expiration alarm, which owns an expiry timer", () => {
        // it is not a limit alarm, so the check above does not catch it; promoting one would give
        // plain alarm behaviour and drop the timer promoteToCertificateExpirationAlarm installs
        const node = bareAlarm("CertExpiry", "CertificateExpirationAlarmType");

        should(() => promoteToAlarm(node, { conditionSource: source, inputNode })).throwError(
            /CertificateExpirationAlarmType.*promoteToCertificateExpirationAlarm/
        );
    });

    it("PTA-7 - promotes an alarm type from a companion specification family", () => {
        // the type here matters more than its name: SystemOffNormalAlarmType is a DiscreteAlarmType,
        // the branch of the family the DI health alarms live on
        const node = bareAlarm("OffNormal", "SystemOffNormalAlarmType");
        const alarm = promoteToAlarm(node, { conditionSource: source, inputNode });

        alarm.activateAlarm();
        should(alarm.activeState.getValue()).eql(true);
        should(alarmConditionType().nodeId.namespace).eql(0);
    });
});
