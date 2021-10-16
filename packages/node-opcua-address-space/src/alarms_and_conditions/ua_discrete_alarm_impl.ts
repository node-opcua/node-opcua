/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { UADiscreteAlarm, UADiscreteAlarm_Base } from "node-opcua-nodeset-ua";
import { INamespace, UAEventType } from "../../source";
import { UAAlarmConditionEx, UAAlarmConditionHelper, UAAlarmConditionImpl } from "./ua_alarm_condition_impl";

export interface UADiscreteAlarmHelper extends UAAlarmConditionHelper {
    on(eventName: string, eventHandle: any): this;
}
export interface UADiscreteAlarmEx
    extends UAAlarmConditionEx,
        Omit<
            UADiscreteAlarm_Base,
            | "suppressedState"
            | "silenceState"
            | "shelvingState"
            | "outOfServiceState"
            | "latchedState"
            | "confirmedState"
            | "ackedState"
            | "comfirmedState"
            | "activeState"
            | "enabledState"
        >,
        UADiscreteAlarmHelper {}
/*=
 *      +----------------------+
 *      | UAAlarmCondition     |
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
export class UADiscreteAlarmImpl extends UAAlarmConditionImpl implements UADiscreteAlarmEx {
    public static instantiate(
        namespace: INamespace,
        discreteAlarmTypeId: UAEventType | NodeId | string,
        options: any,
        data: any
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
