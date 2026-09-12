import fs from "node:fs";
import { BrowseDirection } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";

import type { AddressSpace, UAObject, UAObjectType } from "../../dist/api/index.js";
import { AddressSpace as AddressSpaceCtor, promoteToStateMachine } from "../../dist/api/index.js";
import { generateAddressSpace } from "../../nodeJS.js";

/**
 * FEAT-57: the CTT's "Base Info State Machine Instance / 001.js" script walks, for every
 * StateMachine instance, from the instance's TypeDefinition up through its super types (stopping
 * at StateMachineType) looking for a forward GeneratesEvent reference, and requires its target to
 * be BaseEventType or a subtype. node-opcua's finite state machines always raise
 * "TransitionEventType" on a state change (finite_state_machine.ts), so FiniteStateMachineType
 * must carry that reference for the CTT's walk to succeed.
 *
 * This test reproduces the CTT's own walk (GetReferenceTypeFirstParent equivalent) rather than
 * just checking FiniteStateMachineType directly, so it also validates that the reference is
 * reachable from a concrete subtype (ExclusiveLimitStateMachineType) exactly as the CTT sees it.
 */
function findGeneratesEventTargetByWalkingUp(addressSpace: AddressSpace, startType: UAObjectType): UAObjectType | null {
    const stateMachineType = addressSpace.findObjectType("StateMachineType")!;

    let current: UAObjectType | null = startType;
    for (let i = 0; i < 10 && current; i++) {
        const refs = current.findReferencesEx("GeneratesEvent", BrowseDirection.Forward);
        if (refs.length > 0) {
            return addressSpace.findNode(refs[0].nodeId) as UAObjectType;
        }
        if (current.nodeId.toString() === stateMachineType.nodeId.toString()) {
            break;
        }
        current = current.subtypeOfObj as UAObjectType | null;
    }
    return null;
}

describe("FEAT-57 - state machine types must expose GeneratesEvent -> TransitionEventType", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpaceCtor.create();
        addressSpace.registerNamespace("PRIVATE_NAMESPACE");
        const xml_file = nodesets.standard;
        fs.existsSync(xml_file).should.be.eql(true);
        await generateAddressSpace(addressSpace, xml_file);
        addressSpace.installAlarmsAndConditionsService();
    });
    after(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    const transitionEventTypeNodeId = () => addressSpace.findObjectType("TransitionEventType")!.nodeId.toString();

    it("an ordinary FiniteStateMachine instance's type answers the CTT's parent walk with TransitionEventType", () => {
        // FiniteStateMachineType itself is abstract in the standard nodeset; ProgramStateMachineType
        // is a concrete subtype of it, used here purely as "some ordinary state machine that is not
        // an alarm's LimitState", to prove the reference is reachable through the type hierarchy.
        const stateMachineType = addressSpace.findObjectType("ProgramStateMachineType")!;
        const machine = stateMachineType.instantiate({
            browseName: "MyPlainStateMachine",
            organizedBy: addressSpace.rootFolder.objects
        }) as UAObject;
        promoteToStateMachine(machine);

        const found = findGeneratesEventTargetByWalkingUp(addressSpace, machine.typeDefinitionObj as UAObjectType);
        should.exist(found);
        should(found!.isSubtypeOf(addressSpace.findObjectType("BaseEventType")!)).eql(true);
        should(found!.nodeId.toString()).eql(transitionEventTypeNodeId());
    });

    it("FiniteStateMachineType itself now carries a GeneratesEvent reference to TransitionEventType (installed on first instantiation)", () => {
        const finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType")!;
        const refs = finiteStateMachineType.findReferencesEx("GeneratesEvent", BrowseDirection.Forward);
        should(refs.length).be.aboveOrEqual(1);
        should(refs.map((r) => r.nodeId.toString())).containEql(transitionEventTypeNodeId());
    });

    it("an ExclusiveLimitAlarm's LimitState machine's type answers the CTT's parent walk with TransitionEventType (the CTT-reported case)", () => {
        const namespace = addressSpace.getOwnNamespace();

        const green = namespace.addObject({
            browseName: "Feat57Green",
            eventNotifier: 0x1,
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: addressSpace.rootFolder.objects
        });
        const source = namespace.addObject({
            browseName: "Feat57Source",
            componentOf: green,
            eventSourceOf: green
        });
        const variableWithAlarm = namespace.addVariable({
            browseName: "Feat57VariableWithLimit",
            dataType: "Double",
            propertyOf: source
        });

        const alarm = namespace.instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
            browseName: "Feat57ExclusiveAlarm",
            conditionSource: source,
            highHighLimit: 100.0,
            highLimit: 10.0,
            inputNode: variableWithAlarm,
            lowLimit: 1.0,
            lowLowLimit: -10.0
        });

        const limitStateMachine = alarm.limitState as unknown as UAObject;
        should.exist(limitStateMachine.typeDefinitionObj);

        const found = findGeneratesEventTargetByWalkingUp(addressSpace, limitStateMachine.typeDefinitionObj as UAObjectType);
        should.exist(found);
        should(found!.isSubtypeOf(addressSpace.findObjectType("BaseEventType")!)).eql(true);
        should(found!.nodeId.toString()).eql(transitionEventTypeNodeId());
    });

    it("adding a second and third state machine instance does not duplicate the GeneratesEvent reference", () => {
        const stateMachineType = addressSpace.findObjectType("ProgramStateMachineType")!;
        promoteToStateMachine(
            stateMachineType.instantiate({
                browseName: "MyPlainStateMachine2",
                organizedBy: addressSpace.rootFolder.objects
            }) as UAObject
        );
        promoteToStateMachine(
            stateMachineType.instantiate({
                browseName: "MyPlainStateMachine3",
                organizedBy: addressSpace.rootFolder.objects
            }) as UAObject
        );

        const finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType")!;
        const refs = finiteStateMachineType
            .findReferencesEx("GeneratesEvent", BrowseDirection.Forward)
            .filter((r) => r.nodeId.toString() === transitionEventTypeNodeId());
        should(refs.length).eql(1);
    });
});
