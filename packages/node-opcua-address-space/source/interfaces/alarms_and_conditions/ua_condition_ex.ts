import type { ITypedEventEmitter, ListenerSignature, UAObject, UAProperty, UAVariable } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { UACondition_Base } from "node-opcua-nodeset-ua";
import type { StatusCode } from "node-opcua-status-code";
import type { TimeZoneDataType } from "node-opcua-types";
import type { DataType } from "node-opcua-variant";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import type { ISetStateOptions } from "../i_set_state_options";
import type { ConditionInfoOptions } from "./condition_info_i";
import type { ConditionSnapshot } from "./condition_snapshot";
import type { UABaseEventEvents, UABaseEventEx, UABaseEventHelper } from "./ua_base_event_ex";

export type { UABaseEventHelper } from "./ua_base_event_ex";

export type AddCommentEventHandler = (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void;

export interface UAConditionEvents extends UABaseEventEvents {
    addComment: AddCommentEventHandler;
    branch_deleted: (branchId: string) => void;
}

export interface UAConditionHelper extends UABaseEventHelper {
    getBranchCount(): number;
    getBranches(): ConditionSnapshot[];
    getBranchIds(): NodeId[];
    createBranch(): ConditionSnapshot;
    deleteBranch(branch: ConditionSnapshot): void;
    getEnabledState(): boolean;
    getEnabledStateAsString(): string;
    setEnabledState(requestedEnabledState: boolean, options?: ISetStateOptions): StatusCode;
    setReceiveTime(time: Date): void;
    setLocalTime(time: TimeZoneDataType): void;
    setTime(time: Date): void;
    conditionOfNode(): UAObject | UAVariable | null;
    raiseConditionEvent(branch: ConditionSnapshot, renewEventId: boolean): void;
    raiseNewCondition(conditionInfo: ConditionInfoOptions): void;
    raiseNewBranchState(branch: ConditionSnapshot): void;
    currentBranch(): ConditionSnapshot;
    findBranchForEventId(eventId: Buffer | null): ConditionSnapshot | null;
}

export interface UAConditionEx<T extends UAConditionEvents & ListenerSignature<T> = UAConditionEvents> extends 
UABaseEventEx,
 UACondition_Base, 
 UAObject<T>, 
 UAConditionHelper 
 {
    enabledState: UATwoStateVariableEx;
    // these are declared as optional in UABaseEvent_Base but required in UACondition_Base;
    // re-state them here to disambiguate the two parent interfaces.
    conditionClassId: UAProperty<NodeId, DataType.NodeId>;
    conditionClassName: UAProperty<LocalizedText, DataType.LocalizedText>;
    conditionSubClassId?: UAProperty<NodeId[], DataType.NodeId>;
    conditionSubClassName?: UAProperty<LocalizedText[], DataType.LocalizedText>;
}
