import { BaseNode, UAVariable } from "node-opcua-address-space-base";
import { NodeId } from "node-opcua-nodeid";
import { UAAlarmCondition_Base } from "node-opcua-nodeset-ua";

import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { UAShelvedStateMachineEx } from "../state_machine/ua_shelved_state_machine_ex";
import { ConditionInfo } from "./condition_info_i";
import { UAAcknowledgeableConditionEx, UAAcknowledgeableConditionHelper } from "./ua_acknowledgeable_condition_ex";


export interface UAAlarmConditionHelper extends UAAcknowledgeableConditionHelper {
    activateAlarm(): void;
    deactivateAlarm(retain?: boolean): void;
    isSuppressedOrShelved(): boolean;
    getSuppressedOrShelved(): boolean;
    setMaxTimeShelved(duration: number): void;
    getMaxTimeShelved(): number;
    getInputNodeNode(): UAVariable | null;
    getInputNodeValue(): any | null;
    updateState(): void;
    getCurrentConditionInfo(): ConditionInfo;

    installInputNodeMonitoring(inputNode: BaseNode | NodeId): void;
}

export interface UAAlarmConditionEx extends UAAlarmConditionHelper, UAAlarmCondition_Base, UAAcknowledgeableConditionEx {
    on(eventName: string, eventHandler: any): this;

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

