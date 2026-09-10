import type { BaseNode, ListenerSignature, UAVariable } from "node-opcua-address-space-base";
import type { DataValue } from "node-opcua-data-value";
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

    /**
     * What the alarm does when the value of its input node changes. Assign to it to give an
     * alarm a behaviour of its own, without deriving from an implementation class:
     *
     * ```ts
     * alarm.onInputDataValueChange = (newValue) => {
     *     const tooHot = newValue.value.value > 80;
     *     if (tooHot !== alarm.activeState.getValue()) {
     *         alarm.signalNewCondition(tooHot ? "Active" : "Inactive", tooHot, `${newValue.value.value}`);
     *     }
     * };
     * ```
     *
     * The default does nothing: a plain AlarmConditionType cannot know what its input means.
     * Alarm types that do know (limit alarms, off-normal alarms) already define it, so
     * assigning to one of those replaces the behaviour it came with.
     *
     * The old name `_onInputDataValueChange` still works and is deprecated.
     */
    onInputDataValueChange(newValue: DataValue): void;

    /**
     * Raise a new condition event for this alarm, moving it to the given state.
     *
     * Call this only when the condition has actually changed: it throws when the ConditionInfo
     * it computes is equal to the current one, because an event that reports nothing new is a
     * bug in the caller rather than a state the alarm can represent.
     *
     * The old name `_signalNewCondition` still works and is deprecated.
     */
    signalNewCondition(stateName: string | null, isActive: boolean, value: string): void;
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
