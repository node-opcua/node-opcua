/**
 * Two alarms of the same type, declared under one ObjectType, must instantiate —
 * and each must keep its own sub-state references.
 *
 * `reconstructNonHierarchicalReferences` restored the non-hierarchical references of
 * every cloned node by looking the target up in the FLAT list of every clone made
 * (`findImplementedObject` returned the first match). Both alarms clone the same
 * originals (EnabledState, ActiveState, AckedState of the alarm type), so:
 *
 *  - the second alarm's states were wired to the FIRST alarm's states
 *    (AlarmB/EnabledState --HasTrueSubState--> AlarmA/AckedState), and
 *  - the same reference was then added twice on a node, which made
 *    `addReference` assert "reference exists already in _references" and the whole
 *    instantiation throw.
 *
 * Found on OPC 40001-1 Machinery's ProcessValueType, whose <Measurement> carries both
 * a LimitAlarm and a DeviationAlarm.
 */

import { BrowseDirection } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type BaseNode, type UAObject, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

const ALARM_NAMES = ["AlarmA", "AlarmB"];
const STATE_NAMES = ["EnabledState", "ActiveState"];

function subtreeOf(node: BaseNode): Set<string> {
    const own = new Set<string>();
    const stack: BaseNode[] = [node];
    while (stack.length > 0) {
        const current = stack.pop()!;
        for (const child of current.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Forward)) {
            if (own.has(child.nodeId.toString())) continue;
            own.add(child.nodeId.toString());
            stack.push(child);
        }
    }
    return own;
}

/** every HasTrueSubState of the alarm's states must point inside that same alarm */
function expectSubStatesStayHome(holder: BaseNode, alarmName: string) {
    const alarm = holder.getChildByName(alarmName) as UAObject | null;
    should.exist(alarm, `${holder.browseName.toString()}/${alarmName}`);
    const own = subtreeOf(alarm!);
    for (const stateName of STATE_NAMES) {
        const state = alarm!.getChildByName(stateName) as BaseNode | null;
        if (!state) continue;
        const strays = state
            .findReferencesEx("HasTrueSubState", BrowseDirection.Forward)
            .filter((r) => !own.has(r.nodeId.toString()))
            .map((r) => state.addressSpace.findNode(r.nodeId)?.browseName.toString());
        should(strays).eql([], `${holder.browseName.toString()}/${alarmName}/${stateName} points outside its alarm`);
    }
}

describe("instantiate() with two alarms of the same type under one parent", function (this: Mocha.Suite) {
    this.timeout(60 * 1000);

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        addressSpace.registerNamespace("urn:test");
    });
    after(() => {
        addressSpace.dispose();
    });

    it("instantiates both alarms, each keeping its own HasTrueSubState references", () => {
        const namespace = addressSpace.getOwnNamespace();
        const alarmType = addressSpace.findObjectType("ExclusiveDeviationAlarmType") as UAObjectType;
        should.exist(alarmType);

        const deviceType = namespace.addObjectType({ browseName: "MyDeviceType" });
        for (const alarmName of ALARM_NAMES) {
            alarmType.instantiate({
                browseName: alarmName,
                componentOf: deviceType,
                modellingRule: "Mandatory",
                optionals: ["AckedState"]
            });
        }
        for (const alarmName of ALARM_NAMES) {
            expectSubStatesStayHome(deviceType, alarmName);
        }

        // used to throw "reference exists already in _references"
        const device = deviceType.instantiate({
            browseName: "Device1",
            organizedBy: addressSpace.rootFolder.objects
        });
        for (const alarmName of ALARM_NAMES) {
            expectSubStatesStayHome(device, alarmName);
        }
    });
});
