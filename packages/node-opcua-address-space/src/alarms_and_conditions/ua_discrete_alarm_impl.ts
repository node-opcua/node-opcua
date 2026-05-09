/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { INamespace, UAEventType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { NodeId } from "node-opcua-nodeid";
import type { UADiscreteAlarm } from "node-opcua-nodeset-ua";
import type { VariantOptions } from "node-opcua-variant";
import type { InstantiateAlarmConditionOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_alarm_condition_options.js";
import type { UADiscreteAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_discrete_alarm_ex.js";
import { UAAlarmConditionImplBase } from "./ua_alarm_condition_impl.js";
/**
 * The DiscreteAlarmType is used to classify Types into Alarm Conditions where the input for the
 * Alarm may take on only a certain number of possible values (e.g. true/false,
 * running/stopped/terminating).
 */
export class UADiscreteAlarmImplBase extends UAAlarmConditionImplBase  {
    public static instantiate(
        namespace: INamespace,
        discreteAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UADiscreteAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const discreteAlarmType = addressSpace.findEventType(discreteAlarmTypeId);
        /* c8 ignore next */
        if (!discreteAlarmType) {
            throw new Error(` cannot find Condition Type for ${discreteAlarmType}`);
        }

        const discreteAlarmTypeBase = addressSpace.findObjectType("DiscreteAlarmType");
        assert(discreteAlarmTypeBase, "expecting DiscreteAlarmType - please check you nodeset xml file!");

        /* eventTypeNode should be subtypeOf("DiscreteAlarmType"); */
        /* c8 ignore next */
        if (!discreteAlarmType.isSubtypeOf(discreteAlarmTypeBase as any)) {
            throw new Error("UADiscreteAlarm.instantiate : event found is not subType of DiscreteAlarmType");
        }

        const alarmNode = UAAlarmConditionImplBase.instantiate(
            namespace,
            discreteAlarmType.nodeId,
            options,
            data
        ) as  unknown as UADiscreteAlarm;
        Object.setPrototypeOf(alarmNode, UADiscreteAlarmImplBase.prototype);

        return alarmNode as unknown as  UADiscreteAlarmImpl;
    }
}
export type UADiscreteAlarmImpl = UADiscreteAlarmImplBase & UADiscreteAlarmEx;
export const UADiscreteAlarmImpl = UADiscreteAlarmImplBase as unknown as UADiscreteAlarmImpl;