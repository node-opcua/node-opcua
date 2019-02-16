/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { UAEventType } from "../../source";
import { NamespacePrivate } from "../namespace_private";
import { UAAlarmConditionBase } from "./ua_alarm_condition_base";

/*=
 *      +----------------------+
 *      | UAAlarmConditionBase |
 *      +----------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UADiscreteAlarm  |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UAOffNormalAlarm |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      |   UATripAlarm    |
 *      +------------------+
 *
 *
 *
 */

/**
 * The DiscreteAlarmType is used to classify Types into Alarm Conditions where the input for the
 * Alarm may take on only a certain number of possible values (e.g. true/false,
 * running/stopped/terminating).
 */
export class UADiscreteAlarm extends  UAAlarmConditionBase {

    public static instantiate(
      namespace: NamespacePrivate,
      discreteAlarmTypeId: UAEventType | NodeId | string,
      options: any,
      data: any
    ): UADiscreteAlarm {

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

        const alarmNode = UAAlarmConditionBase.instantiate(
          namespace,
          discreteAlarmType.nodeId, options, data) as UADiscreteAlarm;
        Object.setPrototypeOf(alarmNode, UADiscreteAlarm.prototype);

        return alarmNode as UADiscreteAlarm;
    }
}
