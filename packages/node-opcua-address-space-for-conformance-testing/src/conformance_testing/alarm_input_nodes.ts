/**
 * The Alarms & Conditions input nodes of the CTT server project.
 *
 * A setting named "<X>Type Input Nodes" wants the *source* Variable an alarm of
 * that type watches, not the alarm itself: the CTT writes to that Variable and
 * expects the alarm to change state and report an event. So each entry here is
 * a writable scalar plus an alarm instantiated on it. The two "Setpoint Source"
 * settings are the odd ones out - they name the setpoint Variable of the
 * matching deviation alarm, which is created alongside its input node.
 *
 * All alarms hang off a single `AlarmSource` object which is an event source of
 * the Server object, so the events reach a client subscribed to Server (i=2253)
 * - which is what the CTT subscribes to. `conditionSource` refuses a node that
 * is not an event source of anything.
 *
 * Not built: `DiscrepancyAlarmType Input Nodes`. DiscrepancyAlarmType derives
 * straight from AlarmConditionType and its mandatory TargetValueNode /
 * ExpectedTime / Tolerance children have no implementation behind them in
 * node-opcua, so an instance would be an inert shell. The two RateOfChange
 * types, by contrast, derive from the two limit alarm types and instantiate
 * through them; they carry no rate-of-change behaviour either, but the CTT's
 * limit-alarm tests exercise them meaningfully.
 */
import type { Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { DataType, Variant } from "node-opcua-variant";

import type { CttFolder } from "./ctt_tree.js";

/** where the CTT keeps these settings; outside "Server Test/NodeIds", so the whole path is the key */
const GROUP = "Server Test/Alarms and Conditions/Supported Condition Types";

/** the limits every limit-derived alarm here is given, in the units of a 0..100 input */
const LIMITS = { lowLowLimit: 10, lowLimit: 25, highLimit: 75, highHighLimit: 90 };

const double = (value: number) => new Variant({ dataType: DataType.Double, value });
const boolean = (value: boolean) => new Variant({ dataType: DataType.Boolean, value });

/**
 * The object every alarm is a condition of. It must be an event source of
 * something, or `conditionSource` throws; making it an event source of the
 * Server object is what puts its events on the Server notifier the CTT
 * subscribes to.
 */
function addAlarmSource(ctt: CttFolder): UAObject {
    const server = ctt.addressSpace.rootFolder.objects.server;
    return ctt.namespace.addObject({
        browseName: "AlarmSource",
        nodeId: ctt.nodeId("Server Test/Alarms and Conditions/AlarmSource"),
        organizedBy: ctt.folder("Server Test/Alarms and Conditions"),
        description: "condition source of the CTT alarm input nodes",
        eventSourceOf: server
    });
}

export function addAlarmInputNodes(ctt: CttFolder): void {
    const namespace: Namespace = ctt.namespace;
    const conditionSource = addAlarmSource(ctt);

    /** the writable Variable a CTT alarm setting points at; 50 sits inside LIMITS, so alarms start inactive */
    const inputNode = (leaf: string, kind: "Double" | "Boolean"): UAVariable =>
        ctt.variable(`${GROUP}/${leaf}`, kind, -1, kind === "Double" ? double(50) : boolean(false), null);

    /** a deviation setpoint, at 0 so the deviation the alarm evaluates is the input value itself */
    const setpointNode = (leaf: string): UAVariable => ctt.variable(`${GROUP}/${leaf}`, "Double", -1, double(0), null);

    const alarmOptions = (browseName: string, input: UAVariable) => ({
        browseName,
        nodeId: ctt.nodeId(`Server Test/Alarms and Conditions/${browseName}`),
        conditionSource,
        inputNode: input
    });

    // ── AlarmConditionType ──────────────────────────────────────────────
    // the base type has no sub-state model: the CTT drives ActiveState itself
    namespace.instantiateAlarmCondition(
        "AlarmConditionType",
        alarmOptions("AlarmCondition", inputNode("AlarmConditionType Input Nodes", "Double"))
    );

    // ── the limit family ────────────────────────────────────────────────
    namespace.instantiateLimitAlarm("LimitAlarmType", {
        ...alarmOptions("LimitAlarm", inputNode("LimitAlarmType Input Nodes", "Double")),
        ...LIMITS
    });

    for (const [typeName, leaf] of [
        ["ExclusiveLimitAlarmType", "ExclusiveLimitAlarmType Input Nodes"],
        ["ExclusiveLevelAlarmType", "ExclusiveLevelAlarmType Input Nodes"],
        ["ExclusiveRateOfChangeAlarmType", "ExclusiveRateOfChangeAlarmType Input Nodes"]
    ]) {
        namespace.instantiateExclusiveLimitAlarm(typeName, {
            ...alarmOptions(typeName.replace(/Type$/, ""), inputNode(leaf, "Double")),
            ...LIMITS
        });
    }

    for (const [typeName, leaf] of [
        ["NonExclusiveLimitAlarmType", "NonExclusiveLimitAlarmType Input Nodes"],
        ["NonExclusiveLevelAlarmType", "NonExclusiveLevelAlarmType Input Nodes"],
        ["NonExclusiveRateOfChangeAlarmType", "NonExclusiveRateOfChangeAlarmType Input Nodes"]
    ]) {
        namespace.instantiateNonExclusiveLimitAlarm(typeName, {
            ...alarmOptions(typeName.replace(/Type$/, ""), inputNode(leaf, "Double")),
            ...LIMITS
        });
    }

    // ── the deviation pairs: the setpoint is a setting of its own ───────
    const exclusiveSetpoint = setpointNode("Exclusive Deviation Setpoint Source");
    namespace.instantiateExclusiveDeviationAlarm({
        ...alarmOptions("ExclusiveDeviationAlarm", inputNode("ExclusiveDeviationAlarmType Input Nodes", "Double")),
        ...LIMITS,
        setpointNode: exclusiveSetpoint as Parameters<Namespace["instantiateExclusiveDeviationAlarm"]>[0]["setpointNode"]
    });

    const nonExclusiveSetpoint = setpointNode("NonExclusive Deviation Setpoint Source");
    namespace.instantiateNonExclusiveDeviationAlarm({
        ...alarmOptions("NonExclusiveDeviationAlarm", inputNode("NonExclusiveDeviationAlarmType Input Nodes", "Double")),
        ...LIMITS,
        setpointNode: nonExclusiveSetpoint as Parameters<Namespace["instantiateNonExclusiveDeviationAlarm"]>[0]["setpointNode"]
    });

    // ── the discrete family ─────────────────────────────────────────────
    namespace.instantiateDiscreteAlarm(
        "DiscreteAlarmType",
        alarmOptions("DiscreteAlarm", inputNode("DiscreteAlarmType Input Nodes", "Boolean"))
    );

    // OffNormalAlarmType is active while its input differs from NormalState
    const normalState = namespace.addVariable({
        browseName: "OffNormalNormalState",
        nodeId: ctt.nodeId("Server Test/Alarms and Conditions/OffNormalNormalState"),
        componentOf: ctt.folder("Server Test/Alarms and Conditions"),
        description: "the value OffNormalAlarmType considers normal",
        dataType: "Boolean",
        value: boolean(false)
    });
    namespace.instantiateOffNormalAlarm({
        ...alarmOptions("OffNormalAlarm", inputNode("OffNormalAlarmType Input Nodes", "Boolean")),
        normalState
    });

    // `instantiateOffNormalAlarm` is hardwired to OffNormalAlarmType and
    // UASystemOffNormalAlarmImpl is not exported, so the derived type is
    // instantiated generically: the node and its mandatory children exist,
    // the NormalState comparison is not wired.
    namespace.instantiateAlarmCondition(
        "SystemOffNormalAlarmType",
        alarmOptions("SystemOffNormalAlarm", inputNode("SystemOffNormalAlarmType Input Nodes", "Boolean"))
    );
}
