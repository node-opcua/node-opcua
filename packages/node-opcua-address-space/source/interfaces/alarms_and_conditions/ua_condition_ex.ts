import { BaseNode, UAObject, UAVariable } from "node-opcua-address-space-base";
import { LocalizedText } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { UACondition_Base } from "node-opcua-nodeset-ua";
import { StatusCode } from "node-opcua-status-code";
import { TimeZoneDataType } from "node-opcua-types";
import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { ConditionInfoOptions } from "./condition_info_i";
import { ConditionSnapshot } from "./condition_snapshot";



export interface UABaseEventHelper {
    setSourceName(name: string): void;
    setSourceNode(node: NodeId | BaseNode): void;
}


export type AddCommentEventHandler = (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void;

export interface UAConditionHelper {
    on(eventName: string, eventHandler: (...args: any[]) => void): this;
    // -- Events
    on(eventName: "addComment", eventHandler: AddCommentEventHandler): this;
    on(eventName: "branch_deleted", eventHandler: (branchId: string) => void): this;
}

export interface UAConditionHelper extends UABaseEventHelper {
    getBranchCount(): number;
    getBranches(): ConditionSnapshot[];
    getBranchIds(): NodeId[];
    createBranch(): ConditionSnapshot;
    deleteBranch(branch: ConditionSnapshot): void;
    getEnabledState(): boolean;
    getEnabledStateAsString(): string;
    setEnabledState(requestedEnabledState: boolean): StatusCode;
    setReceiveTime(time: Date): void;
    setLocalTime(time: TimeZoneDataType): void;
    setTime(time: Date): void;
    conditionOfNode(): UAObject | UAVariable | null;
    raiseConditionEvent(branch: ConditionSnapshot, renewEventId: boolean): void;
    raiseNewCondition(conditionInfo: ConditionInfoOptions): void;
    raiseNewBranchState(branch: ConditionSnapshot): void;
    currentBranch(): ConditionSnapshot;
}

export interface UAConditionEx extends UAObject, UACondition_Base, UAConditionHelper {
    enabledState: UATwoStateVariableEx;
    on(eventName: string, eventHandler: any): this;
    //
    // conditionClassId: UAProperty<NodeId, /*c*/DataType.NodeId>;
    // conditionClassName: UAProperty<LocalizedText, /*c*/DataType.LocalizedText>;
    // conditionSubClassId?: UAProperty<NodeId, /*c*/DataType.NodeId>;
    // conditionSubClassName?: UAProperty<LocalizedText, /*c*/DataType.LocalizedText>;
    // conditionName: UAProperty<UAString, /*c*/DataType.String>;
    // branchId: UAProperty<NodeId, /*c*/DataType.NodeId>;
    // retain: UAProperty<boolean, /*c*/DataType.Boolean>;
    // quality: UAConditionVariable<StatusCode, /*c*/DataType.StatusCode>;
    // lastSeverity: UAConditionVariable<UInt16, /*c*/DataType.UInt16>;
    // comment: UAConditionVariable<LocalizedText, /*c*/DataType.LocalizedText>;
    // clientUserId: UAProperty<UAString, /*c*/DataType.String>;
    // disable: UAMethod;
    // enable: UAMethod;
    // addComment: UAMethod;
    // conditionRefresh: UAMethod;
    // conditionRefresh2: UAMethod;
}
