import type { ListenerSignature, UAMethod, UAObject } from "node-opcua-address-space-base";
import type { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import type { UAAcknowledgeableCondition_Base } from "node-opcua-nodeset-ua";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import type { ConditionSnapshot } from "./condition_snapshot";
import type { UAConditionEvents, UAConditionEx } from "./ua_condition_ex";

export interface UAAcknowledgeableConditionHelper {
    autoConfirmBranch(branch: ConditionSnapshot, comment: LocalizedTextLike): void;
    acknowledgeAndAutoConfirmBranch(branch: ConditionSnapshot, comment: string | LocalizedTextLike | LocalizedText): void;
}

export interface UAAcknowledgeableConditionEvents extends UAConditionEvents {
    acknowledged: (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void;
    confirmed: (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void;
}

export interface UAAcknowledgeableConditionEx<T extends UAAcknowledgeableConditionEvents & ListenerSignature<T> = UAAcknowledgeableConditionEvents>
    extends UAAcknowledgeableCondition_Base,
        UAAcknowledgeableConditionHelper,
        UAConditionEx<T> {
    enabledState: UATwoStateVariableEx;
    ackedState: UATwoStateVariableEx;
    confirmedState?: UATwoStateVariableEx;
    acknowledge: UAMethod;
    confirm?: UAMethod;
}
