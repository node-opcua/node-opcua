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
