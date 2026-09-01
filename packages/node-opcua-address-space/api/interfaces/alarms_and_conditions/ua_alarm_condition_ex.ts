import type { BaseNode, ListenerSignature, UAVariable } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { UAAlarmCondition_Base } from "node-opcua-nodeset-ua";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex.js";
import type { UAShelvedStateMachineEx } from "../state_machine/ua_shelved_state_machine_ex.js";
import type { ConditionInfo } from "./condition_info_i.js";
import type {
    UAAcknowledgeableConditionEvents,
    UAAcknowledgeableConditionEx,
    UAAcknowledgeableConditionHelper
} from "./ua_acknowledgeable_condition_ex.js";

export interface UAAlarmConditionHelper extends UAAcknowledgeableConditionHelper {
    activateAlarm(): void;
    deactivateAlarm(retain?: boolean): void;
    isSuppressedOrShelved(): boolean;
    getSuppressedOrShelved(): boolean;
    setMaxTimeShelved(duration: number): void;
    getMaxTimeShelved(): number;
    getInputNodeNode(): UAVariable | null;
    getInputNodeValue(): number | null;
    updateState(): void;
    getCurrentConditionInfo(): ConditionInfo;
    installInputNodeMonitoring(inputNode: BaseNode | NodeId): void;

    /**
     * What the alarm reports when its state changes. Assign to it to give an alarm a message
     * and a severity of its own:
     *
     * ```ts
     * alarm.calculateConditionInfo = (state, isActive, value, oldConditionInfo) =>
     *     new ConditionInfo({
     *         message: `Tank is almost ${Math.ceil(Number(value) * 100)}% full`,
     *         severity: 100,
     *         quality: StatusCodes.Good,
     *         retain: true
     *     });
     * ```
     *
     * The default returns the previous ConditionInfo unchanged, so an alarm that does not
     * assign one reports nothing new.
     *
     * This has been the documented way to give an alarm its own message for years, but under
     * the name `_calculateConditionInfo` and only on the implementation class, so following
     * the documentation meant importing from inside the package. That name still works and is
     * deprecated.
     */
    calculateConditionInfo(
        stateName: string | null,
        isActive: boolean,
        value: string,
        oldConditionInfo: ConditionInfo
    ): ConditionInfo;
}

export interface UALarmConditionEvents extends UAAcknowledgeableConditionEvents {}
export interface UAAlarmConditionEx<T extends UALarmConditionEvents & ListenerSignature<T> = UALarmConditionEvents>
    extends UAAlarmConditionHelper,
        UAAlarmCondition_Base,
        UAAcknowledgeableConditionEx<T> {
    enabledState: UATwoStateVariableEx;
    activeState: UATwoStateVariableEx;
    ackedState: UATwoStateVariableEx;
    confirmedState?: UATwoStateVariableEx;

    suppressedState?: UATwoStateVariableEx;

    outOfServiceState?: UATwoStateVariableEx;
    shelvingState?: UAShelvedStateMachineEx;
    silenceState?: UATwoStateVariableEx;
    latchedState?: UATwoStateVariableEx;
}
