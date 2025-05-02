import fs from "fs";
import "should";
import { AddressSpace } from "node-opcua-address-space";
import { construct_demo_alarm_in_address_space, IAlarmTestData } from "node-opcua-address-space/testHelpers";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { PseudoSession } from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import {
    AttributeIds,
    constructEventFilter,
    DataType,
    extractConditionFields,
    fieldsToJson,
    resolveNodeId,
    Variant
} from "..";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("extractConditionFields", () => {
    let addressSpace: AddressSpace;
    const test = {} as IAlarmTestData;
    before(async () => {
        const xmlFiles = [nodesets.standard, nodesets.di, nodesets.autoId];
        addressSpace = AddressSpace.create();
        fs.existsSync(xmlFiles[0]).should.eql(true);
        await generateAddressSpace(addressSpace, xmlFiles);

        addressSpace.registerNamespace("urn:OwnNamespace");
        construct_demo_alarm_in_address_space(test, addressSpace);
        // create an alarmextractEventFieldsSimplePath
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
                "SupportsFilteredRetain",
                "Time"
            ]);
    });

    it("extractConditionFields from type ConditionType - should not expose ConditionId (#1183)", async () => {
        const session = new PseudoSession(addressSpace);
        const conditionNodeId = resolveNodeId("ConditionType");
        const fields = await extractConditionFields(session, conditionNodeId);
        fields.indexOf("Time").should.not.eql(-1);
        fields.indexOf("ConditionId").should.not.eql(-1);
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
                "SupportsFilteredRetain",
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
            "ActiveState.EffectiveDisplayName",
            "ActiveState.EffectiveTransitionTime",
            "ActiveState.FalseState",
            "ActiveState.Id",
            "ActiveState.TransitionTime",
            "ActiveState.TrueState",
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

            // "LimitState", is an object
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

    it("extractConditionFields from instance - should expose ConditionId (#1183)", async () => {
        const session = new PseudoSession(addressSpace);
        const conditionNodeId = test.tankLevelCondition.nodeId;
        const fields = await extractConditionFields(session, conditionNodeId);
        fields.indexOf("Time").should.not.eql(-1);
        fields.indexOf("ConditionId").should.not.eql(-1);
    });

    it("constructEventFilter should expose ConditionId in the select clause - (#1183)", async () => {
        const session = new PseudoSession(addressSpace);
        const conditionNodeId = test.tankLevelCondition.nodeId;

        const fields = await extractConditionFields(session, conditionNodeId);
        fields[fields.length - 1].should.eql("ConditionId");

        const eventFilter = constructEventFilter(fields);

        eventFilter.selectClauses!.length.should.eql(
            fields.length,
            "eventFilter selectClause must have the same number of element, including collect ConditionId, which is a special case"
        );

        const conditionIdClause = eventFilter.selectClauses![eventFilter.selectClauses!.length - 1];
        if (conditionIdClause.browsePath) {
            conditionIdClause.browsePath.length.should.eql(0);
        }
        conditionIdClause.attributeId.should.eql(AttributeIds.NodeId);

        const values = Array(fields.length)
            .fill(0)
            .map((x, index) => new Variant({ dataType: DataType.Double, value: index }));
        doDebug && console.log(values);

        const json = fieldsToJson(fields, values);
        doDebug && console.log(json);

        json.conditionId.toString().should.eql("Variant(Scalar<Double>, value: 47)");
    });
});
