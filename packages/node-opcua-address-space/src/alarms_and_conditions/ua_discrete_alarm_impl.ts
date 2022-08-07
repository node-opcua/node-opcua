/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { UADiscreteAlarm, UADiscreteAlarm_Base } from "node-opcua-nodeset-ua";
import { VariantOptions } from "node-opcua-variant";
import { INamespace, UAEventType } from "node-opcua-address-space-base";
import { UADiscreteAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_discrete_alarm_ex";
import { InstantiateAlarmConditionOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_alarm_condition_options";
import { UAAlarmConditionImpl } from "./ua_alarm_condition_impl";
/**
 * The DiscreteAlarmType is used to classify Types into Alarm Conditions where the input for the
 * Alarm may take on only a certain number of possible values (e.g. true/false,
 * running/stopped/terminating).
 */
export class UADiscreteAlarmImpl extends UAAlarmConditionImpl implements UADiscreteAlarmEx {
    public static instantiate(
        namespace: INamespace,
        discreteAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UADiscreteAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const discreteAlarmType = addressSpace.findEventType(discreteAlarmTypeId);
        /* istanbul ignore next */
        if (!discreteAlarmType) {
            throw new Error(" cannot find Condition Type for " + discreteAlarmType);
        }

        const discreteAlarmTypeBase = addressSpace.findObjectType("DiscreteAlarmType");
        assert(discreteAlarmTypeBase, "expecting DiscreteAlarmType - please check you nodeset xml file!");

        /* eventTypeNode should be subtypeOf("DiscreteAlarmType"); */
        /* istanbul ignore next */
        if (!discreteAlarmType.isSupertypeOf(discreteAlarmTypeBase as any)) {
            throw new Error("UADiscreteAlarm.instantiate : event found is not subType of DiscreteAlarmType");
        }

        const alarmNode = UAAlarmConditionImpl.instantiate(namespace, discreteAlarmType.nodeId, options, data) as UADiscreteAlarm;
        Object.setPrototypeOf(alarmNode, UADiscreteAlarmImpl.prototype);

        return alarmNode as UADiscreteAlarmImpl;
    }
}
