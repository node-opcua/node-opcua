import { UAMethod } from "node-opcua-address-space-base";
import { LocalizedTextLike, LocalizedText } from "node-opcua-data-model";
import { UAAcknowledgeableCondition_Base } from "node-opcua-nodeset-ua";
import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { ConditionSnapshot } from "./condition_snapshot";
import { UAConditionEx, UAConditionHelper } from "./ua_condition_ex";

export interface UAAcknowledgeableConditionHelper {
    autoConfirmBranch(branch: ConditionSnapshot, comment: LocalizedTextLike): void;
    acknowledgeAndAutoConfirmBranch(branch: ConditionSnapshot, comment: string | LocalizedTextLike | LocalizedText): void;
}

export interface UAAcknowledgeableConditionHelper extends UAConditionHelper {
    ///
    on(eventName: string, eventHandler: (...args: any[]) => void): this;

    on(
        eventName: "acknowledged" | "confirmed",
        eventHandler: (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void
    ): this;
}


export interface UAAcknowledgeableConditionEx
    extends UAAcknowledgeableCondition_Base,
        UAAcknowledgeableConditionHelper,
        UAConditionEx {
    on(eventName: string, eventHandler: any): this;

    enabledState: UATwoStateVariableEx;
    ackedState: UATwoStateVariableEx;
    confirmedState?: UATwoStateVariableEx;
    acknowledge: UAMethod;
    confirm?: UAMethod;
}
