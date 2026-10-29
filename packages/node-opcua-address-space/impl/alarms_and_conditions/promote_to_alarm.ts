/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import type { UAObject, UAObjectType, UAProperty, UAVariable } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-basic-types";
import { NodeId } from "node-opcua-nodeid";
import type { InstallSetPointOptions } from "../../api/interfaces/alarms_and_conditions/install_setpoint_options.js";
import type { PromoteToAlarmOptions } from "../../api/interfaces/alarms_and_conditions/promote_to_alarm_options.js";
import type { PromoteToLimitAlarmOptions } from "../../api/interfaces/alarms_and_conditions/promote_to_limit_alarm_options.js";
import type { UAAlarmConditionEx } from "../../api/interfaces/alarms_and_conditions/ua_alarm_condition_ex.js";
import type { UALimitAlarmEx } from "../../api/interfaces/alarms_and_conditions/ua_limit_alarm_ex.js";
import { initialize_properties_and_components } from "../_instantiate_helpers.js";
import { _initialize_acknowledgeable_condition_node } from "./ua_acknowledgeable_condition_impl.js";
import {
    _initialize_alarm_condition_node,
    type AlarmConditionInitializationOptions,
    type UAAlarmConditionImpl,
    UAAlarmConditionImplBase
} from "./ua_alarm_condition_impl.js";
import { _initialize_condition_node } from "./ua_condition_impl.js";
import { UAExclusiveDeviationAlarmImpl } from "./ua_exclusive_deviation_alarm_impl.js";
import { UAExclusiveLevelAlarmImpl } from "./ua_exclusive_level_alarm_impl.js";
import { _initialize_exclusive_limit_alarm_node, UAExclusiveLimitAlarmImpl } from "./ua_exclusive_limit_alarm_impl.js";
import { UAExclusiveRateOfChangeAlarmImpl } from "./ua_exclusive_rate_of_change_alarm_impl.js";
import { _initialize_limit_alarm_node, type LimitAlarmInitializationOptions, UALimitAlarmImplBase } from "./ua_limit_alarm_impl.js";
import { UANonExclusiveDeviationAlarmImpl } from "./ua_non_exclusive_deviation_alarm_impl.js";
import { _initialize_non_exclusive_limit_alarm_node, UANonExclusiveLimitAlarmImpl } from "./ua_non_exclusive_limit_alarm_impl.js";

function _isOfType(typeDefinition: UAObjectType, type: UAObjectType | null): boolean {
    return !!type && (typeDefinition === type || typeDefinition.isSubtypeOf(type));
}

/**
 * Give an existing node the behaviour of the alarm its type says it is.
 *
 * A node only becomes a working alarm when `namespace.instantiateAlarmCondition` builds it; a node
 * that arrived any other way - `objectType.instantiate()`, or a nodeset XML - carries the right
 * children but none of the machinery, so `activateAlarm` and `signalNewCondition` are simply not
 * there. This retypes the node in place, keeping its identity in the address space index and every
 * reference already pointing at it, and then runs the same initialization the factory runs.
 *
 * A limit alarm is handed to {@link promoteToLimitAlarm}: its behaviour lives in UALimitAlarmImpl
 * and its subclasses, and a node wearing the plain alarm prototype would look promoted while
 * ignoring its own limit set points. Handing it on rather than refusing it lets a caller promote
 * every alarm of a nodeset the same way, without sorting them by type first.
 */
export function promoteToAlarm(node: UAObject, options?: PromoteToAlarmOptions): UAAlarmConditionEx {
    if (node instanceof UAAlarmConditionImplBase) {
        return node as unknown as UAAlarmConditionImpl; // already promoted
    }
    const addressSpace = node.addressSpace;
    const typeDefinition = node.typeDefinitionObj;

    const alarmConditionType = addressSpace.findObjectType("AlarmConditionType");
    /* c8 ignore next */
    if (!alarmConditionType) {
        throw new Error("promoteToAlarm: cannot find AlarmConditionType - is the standard nodeset loaded ?");
    }
    if (!typeDefinition || !_isOfType(typeDefinition, alarmConditionType)) {
        throw new Error(
            `promoteToAlarm: ${node.browseName.toString()} has type definition ` +
                `${typeDefinition ? typeDefinition.browseName.toString() : "<none>"} ` +
                "which does not derive from AlarmConditionType - only alarms can be promoted"
        );
    }
    if (_isOfType(typeDefinition, addressSpace.findObjectType("LimitAlarmType"))) {
        return promoteToLimitAlarm(node, options);
    }
    // CertificateExpirationAlarmType carries behaviour of its own - promoteToCertificateExpirationAlarm
    // starts an expiry timer and registers a shutdown task. Promoting one here would give it plain
    // alarm behaviour and silently drop that, which is worse than refusing: the node would look
    // promoted and never fire.
    if (_isOfType(typeDefinition, addressSpace.findObjectType("CertificateExpirationAlarmType"))) {
        throw new Error(
            `promoteToAlarm: ${node.browseName.toString()} is a ${typeDefinition.browseName.toString()}, ` +
                "which has its own expiry machinery - use promoteToCertificateExpirationAlarm instead"
        );
    }
    const conditionNode = node as unknown as UAAlarmConditionImpl;
    return _promote_alarm_condition(conditionNode, typeDefinition, "promoteToAlarm", {
        conditionClass: options?.conditionClass,
        conditionName: options?.conditionName || node.browseName.name || undefined,
        conditionSource: options?.conditionSource ?? null,
        inputNode: options?.inputNode,
        maxTimeShelved: options?.maxTimeShelved
    });
}

/**
 * The condition, acknowledgeable condition and alarm steps of the wiring, as the factory chain
 * runs them.
 */
function _promote_alarm_condition(
    conditionNode: UAAlarmConditionImpl,
    typeDefinition: UAObjectType,
    caller: string,
    initializationOptions: AlarmConditionInitializationOptions
): UAAlarmConditionImpl {
    const alarmConditionEventType = conditionNode.addressSpace.findEventType(typeDefinition.nodeId);
    /* c8 ignore next */
    if (!alarmConditionEventType) {
        throw new Error(`${caller}: cannot find event type for ${typeDefinition.browseName.toString()}`);
    }
    // conditionSource has to be an own property even when it is absent: the condition
    // initialization tells "no source" from "source not considered" by its presence.
    _initialize_condition_node(conditionNode.namespace, conditionNode, alarmConditionEventType, initializationOptions);
    _initialize_acknowledgeable_condition_node(conditionNode);
    return _initialize_alarm_condition_node(conditionNode, initializationOptions);
}

type LimitName = "highHighLimit" | "highLimit" | "lowLimit" | "lowLowLimit";
const limitNames: LimitName[] = ["highHighLimit", "highLimit", "lowLimit", "lowLowLimit"];
// the browse names of a limit property and of the matching NonExclusiveLimitAlarmType state
const limitBrowseNames: Record<LimitName, [string, string]> = {
    highHighLimit: ["HighHighLimit", "HighHighState"],
    highLimit: ["HighLimit", "HighState"],
    lowLimit: ["LowLimit", "LowState"],
    lowLowLimit: ["LowLowLimit", "LowLowState"]
};

type LimitAlarmClass =
    | typeof UAExclusiveDeviationAlarmImpl
    | typeof UAExclusiveLevelAlarmImpl
    | typeof UAExclusiveRateOfChangeAlarmImpl
    | typeof UAExclusiveLimitAlarmImpl
    | typeof UANonExclusiveDeviationAlarmImpl
    | typeof UANonExclusiveLimitAlarmImpl;

/**
 * The impl class a limit alarm type maps to - the most specific first, since a deviation alarm
 * is also an exclusive (or non-exclusive) limit alarm.
 */
function _findLimitAlarmClass(node: UAObject, typeDefinition: UAObjectType): LimitAlarmClass | null {
    const addressSpace = node.addressSpace;
    const candidates: [string, LimitAlarmClass][] = [
        ["ExclusiveDeviationAlarmType", UAExclusiveDeviationAlarmImpl],
        ["ExclusiveLevelAlarmType", UAExclusiveLevelAlarmImpl],
        ["ExclusiveRateOfChangeAlarmType", UAExclusiveRateOfChangeAlarmImpl],
        ["ExclusiveLimitAlarmType", UAExclusiveLimitAlarmImpl],
        ["NonExclusiveDeviationAlarmType", UANonExclusiveDeviationAlarmImpl],
        ["NonExclusiveLimitAlarmType", UANonExclusiveLimitAlarmImpl]
    ];
    for (const [typeName, implClass] of candidates) {
        if (_isOfType(typeDefinition, addressSpace.findObjectType(typeName))) {
            return implClass;
        }
    }
    return null;
}

/**
 * Give an existing limit alarm node the behaviour of the limit alarm its type says it is.
 *
 * The limit alarm counterpart of {@link promoteToAlarm}, for a node that came from a nodeset XML or
 * from `objectType.instantiate()`. The node is retyped in place to the class its type definition
 * calls for - exclusive or non-exclusive, level, deviation, rate of change, or a subtype of those -
 * so it keeps its NodeId and every reference, and then gets the same initialization
 * `instantiateExclusiveLimitAlarm` / `instantiateNonExclusiveLimitAlarm` run.
 *
 * The limits are the values the HighHighLimit / HighLimit / LowLimit / LowLowLimit properties of
 * the node already hold; `options` overrides them, and adds the property (and the matching state of
 * a non-exclusive alarm) for a limit the node does not have.
 *
 * A node that is already promoted is returned as it is. A node that is not a limit alarm, a bare
 * LimitAlarmType (it has no limit states to drive), and a node without an input node all throw.
 */
export function promoteToLimitAlarm(node: UAObject, options?: PromoteToLimitAlarmOptions): UALimitAlarmEx {
    if (node instanceof UALimitAlarmImplBase) {
        return node; // already promoted
    }
    const addressSpace = node.addressSpace;
    const typeDefinition = node.typeDefinitionObj;
    const browseName = node.browseName.toString();

    const limitAlarmType = addressSpace.findObjectType("LimitAlarmType");
    /* c8 ignore next */
    if (!limitAlarmType) {
        throw new Error("promoteToLimitAlarm: cannot find LimitAlarmType - is the standard nodeset loaded ?");
    }
    if (!typeDefinition || !_isOfType(typeDefinition, limitAlarmType)) {
        throw new Error(
            `promoteToLimitAlarm: ${browseName} has type definition ` +
                `${typeDefinition ? typeDefinition.browseName.toString() : "<none>"} ` +
                "which does not derive from LimitAlarmType - only limit alarms can be promoted"
        );
    }
    const implClass = _findLimitAlarmClass(node, typeDefinition);
    if (!implClass) {
        throw new Error(
            `promoteToLimitAlarm: ${browseName} is a ${typeDefinition.browseName.toString()}, which derives from neither ` +
                "ExclusiveLimitAlarmType nor NonExclusiveLimitAlarmType - it has no limit states to drive"
        );
    }
    const isExclusive = implClass.prototype instanceof UAExclusiveLimitAlarmImpl || implClass === UAExclusiveLimitAlarmImpl;

    // ---------- the input node: given, or the one the InputNode property already points at.
    // Resolved to the variable itself: installInputNodeMonitoring only watches a node it is given,
    // a bare NodeId is recorded and never listened to.
    let inputNodeId: NodeId | undefined;
    if (options?.inputNode) {
        inputNodeId = options.inputNode instanceof NodeId ? options.inputNode : options.inputNode.nodeId;
    } else {
        const inputNodeProperty = node.getPropertyByName("InputNode") as UAProperty<NodeId, DataType.NodeId> | null;
        const value = inputNodeProperty?.readValue().value.value;
        if (value instanceof NodeId && !value.isEmpty()) {
            inputNodeId = value;
        }
    }
    const inputNode = inputNodeId ? (addressSpace.findNode(inputNodeId) as UAVariable | null) : null;
    if (!inputNode) {
        throw new Error(
            `promoteToLimitAlarm: ${browseName} needs an input node - give options.inputNode, ` +
                "or set its InputNode property to a variable of the address space"
        );
    }

    // ---------- the limits: a limit given in options overrides the property, and creates it when missing
    const limits: Partial<Record<LimitName, number>> = {};
    const missing: string[] = [];
    for (const name of limitNames) {
        const [limitBrowseName, stateBrowseName] = limitBrowseNames[name];
        const value = options?.[name];
        const property = node.getPropertyByName(limitBrowseName) as UAVariable | null;
        if (value !== undefined) {
            limits[name] = value;
            if (!property) {
                missing.push(limitBrowseName);
            }
            if (!isExclusive && !node.getComponentByName(stateBrowseName)) {
                missing.push(stateBrowseName);
            }
        } else if (property && typeof property.readValue().value.value !== "number") {
            // a Null value; note that an instantiated Double property starts as 0, which reads as a limit
            throw new Error(
                `promoteToLimitAlarm: ${browseName}.${limitBrowseName} has no value - give it one in the nodeset, ` +
                    `or pass options.${name}`
            );
        } else if (property && !isExclusive && !node.getComponentByName(stateBrowseName)) {
            // NonExclusiveLimitAlarmType ties each state to its limit: without the state the limit is never checked
            missing.push(stateBrowseName);
        }
    }
    if (!isExclusive) {
        for (const name of limitNames) {
            const [limitBrowseName, stateBrowseName] = limitBrowseNames[name];
            if (
                node.getComponentByName(stateBrowseName) &&
                !node.getPropertyByName(limitBrowseName) &&
                options?.[name] === undefined
            ) {
                throw new Error(
                    `promoteToLimitAlarm: ${browseName} has a ${stateBrowseName} but no ${limitBrowseName} - pass options.${name}`
                );
            }
        }
    }
    // checked before anything is touched, so a refused node is left as it was
    if (limitNames.every((name) => limits[name] === undefined && !node.getPropertyByName(limitBrowseNames[name][0]))) {
        throw new Error(`promoteToLimitAlarm: ${browseName} has no limit - at least one limit is required`);
    }
    if (missing.length > 0) {
        const baseObjectType = addressSpace.findObjectType("BaseObjectType") as UAObjectType;
        // adds the requested optionals only: a child the node already has is never cloned twice
        initialize_properties_and_components(node, baseObjectType, typeDefinition, false, false, missing);
    }

    // ---------- the wiring, as instantiateExclusiveLimitAlarm / instantiateNonExclusiveLimitAlarm run it
    const alarmNode = _promote_alarm_condition(node as unknown as UAAlarmConditionImpl, typeDefinition, "promoteToLimitAlarm", {
        conditionClass: options?.conditionClass,
        conditionName: options?.conditionName || node.browseName.name || undefined,
        conditionSource: options?.conditionSource ?? null,
        // installed once, by the limit alarm step below
        inputNode: undefined,
        maxTimeShelved: options?.maxTimeShelved
    });
    const limitAlarmInitializationOptions: LimitAlarmInitializationOptions = { inputNode, ...limits };
    const limitAlarm = _initialize_limit_alarm_node(alarmNode as UALimitAlarmImplBase, limitAlarmInitializationOptions);

    // the first evaluation of the input runs on the exclusive / non-exclusive prototype, as in the
    // factories: a deviation alarm cannot evaluate anything before its setpoint is installed
    if (isExclusive) {
        Object.setPrototypeOf(limitAlarm, UAExclusiveLimitAlarmImpl.prototype);
        _initialize_exclusive_limit_alarm_node(limitAlarm as UAExclusiveLimitAlarmImpl);
    } else {
        Object.setPrototypeOf(limitAlarm, UANonExclusiveLimitAlarmImpl.prototype);
        _initialize_non_exclusive_limit_alarm_node(limitAlarm as UANonExclusiveLimitAlarmImpl);
    }
    Object.setPrototypeOf(limitAlarm, implClass.prototype);

    if (limitAlarm instanceof UAExclusiveDeviationAlarmImpl || limitAlarm instanceof UANonExclusiveDeviationAlarmImpl) {
        let setpointNode: InstallSetPointOptions["setpointNode"] = options?.setpointNode;
        if (setpointNode === undefined) {
            const setpointNodeId = limitAlarm.setpointNode.readValue().value.value;
            if (setpointNodeId instanceof NodeId && !setpointNodeId.isEmpty()) {
                setpointNode = addressSpace.findNode(setpointNodeId) as InstallSetPointOptions["setpointNode"];
            }
        }
        limitAlarm._install_setpoint({ setpointNode });
    }
    return limitAlarm;
}
