import * as fs from "fs";
import { AddressSpace } from "node-opcua-address-space";
import { construct_demo_alarm_in_address_space, IAlarmTestData } from "node-opcua-address-space/testHelpers";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { PseudoSession } from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { extractConditionFields, resolveNodeId } from "..";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("extractConditionFields", () => {
    let addressSpace: AddressSpace;
    const test = {} as IAlarmTestData;
    before(async () => {
        const xmlFiles = [nodesets.standard];
        addressSpace = AddressSpace.create();
        fs.existsSync(xmlFiles[0]).should.eql(true);
        await generateAddressSpace(addressSpace, xmlFiles);

        addressSpace.registerNamespace("urn:OwnNamespace");
        construct_demo_alarm_in_address_space(test, addressSpace);
        // create an alarm
    });
    after(() => {
        addressSpace.dispose();
    });
    it("extractConditionFields from type ConditionType", async () => {
        const session = new PseudoSession(addressSpace);
        const conditionNodeId = resolveNodeId("ConditionType");
        const fields = await extractConditionFields(session, conditionNodeId);
        fields
            .sort()
            .should.eql([
                "BranchId",
                "ClientUserId",
                "Comment",
                "Comment.SourceTimestamp",
                "ConditionClassId",
                "ConditionClassName",
                "ConditionId",
                "ConditionName",
                "ConditionSubClassId",
                "ConditionSubClassName",
                "EnabledState",
                "EnabledState.EffectiveDisplayName",
                "EnabledState.EffectiveTransitionTime",
                "EnabledState.FalseState",
                "EnabledState.Id",
                "EnabledState.TransitionTime",
                "EnabledState.TrueState",
                "EventId",
                "EventType",
                "LastSeverity",
                "LastSeverity.SourceTimestamp",
                "LocalTime",
                "Message",
                "Quality",
                "Quality.SourceTimestamp",
                "ReceiveTime",
                "Retain",
                "Severity",
                "SourceName",
                "SourceNode",
                "Time"
            ]);
    });

    it("extractConditionFields from type AcknowledgeableConditionType", async () => {
        const session = new PseudoSession(addressSpace);
        const conditionNodeId = resolveNodeId("AcknowledgeableConditionType");
        const fields = await extractConditionFields(session, conditionNodeId);
        // xx debugLog(fields);
        fields
            .sort()
            .should.eql([
                "AckedState",
                "AckedState.FalseState",
                "AckedState.Id",
                "AckedState.TransitionTime",
                "AckedState.TrueState",
                "BranchId",
                "ClientUserId",
                "Comment",
                "Comment.SourceTimestamp",
                "ConditionClassId",
                "ConditionClassName",
                "ConditionId",
                "ConditionName",
                "ConditionSubClassId",
                "ConditionSubClassName",
                "ConfirmedState",
                "ConfirmedState.FalseState",
                "ConfirmedState.Id",
                "ConfirmedState.TransitionTime",
                "ConfirmedState.TrueState",
                "EnabledState",
                "EnabledState.EffectiveDisplayName",
                "EnabledState.EffectiveTransitionTime",
                "EnabledState.FalseState",
                "EnabledState.Id",
                "EnabledState.TransitionTime",
                "EnabledState.TrueState",
                "EventId",
                "EventType",
                "LastSeverity",
                "LastSeverity.SourceTimestamp",
                "LocalTime",
                "Message",
                "Quality",
                "Quality.SourceTimestamp",
                "ReceiveTime",
                "Retain",
                "Severity",
                "SourceName",
                "SourceNode",
                "Time"
            ]);
    });
    it("extractConditionFields from instance", async () => {
        const session = new PseudoSession(addressSpace);
        const conditionNodeId = test.tankLevelCondition.nodeId;
        const fields = await extractConditionFields(session, conditionNodeId);
        // xx debugLog(fields);
        fields.sort().should.eql([
            "AckedState",
            // "AckedState.FalseState",
            "AckedState.Id",
            // "AckedState.TransitionTime",
            // "AckedState.TrueState",
            "ActiveState",
            "ActiveState.Id",

            "BranchId",
            "ClientUserId",
            "Comment",
            "Comment.SourceTimestamp",
            "ConditionClassId",
            "ConditionClassName",
            "ConditionId",
            "ConditionName",
            // "ConditionSubClassId",
            // "ConditionSubClassName",
            "ConfirmedState",
            // "ConfirmedState.FalseState",
            "ConfirmedState.Id",
            // "ConfirmedState.TransitionTime",
            // "ConfirmedState.TrueState",
            "EnabledState",
            "EnabledState.EffectiveDisplayName",
            "EnabledState.EffectiveTransitionTime",
            "EnabledState.FalseState",
            "EnabledState.Id",
            "EnabledState.TransitionTime",
            "EnabledState.TrueState",
            "EventId",
            "EventType",

            "HighHighLimit",
            "HighLimit",
            "InputNode",

            "LastSeverity",
            "LastSeverity.SourceTimestamp",

            "LimitState",
            "LimitState.CurrentState",
            "LimitState.CurrentState.Id",
            "LowLimit",

            // "LocalTime",
            "Message",
            "Quality",
            "Quality.SourceTimestamp",
            "ReceiveTime",
            "Retain",
            "Severity",
            "SourceName",
            "SourceNode",
            "SuppressedOrShelved",
            "Time"
        ]);
    });
});
