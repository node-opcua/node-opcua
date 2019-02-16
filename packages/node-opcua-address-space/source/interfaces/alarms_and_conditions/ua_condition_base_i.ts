/**
 * @module node-opcua-address-space
 */
import { NodeId } from "node-opcua-nodeid";
import { StatusCode } from "node-opcua-status-code";
import { ConditionInfo } from "../../../src/alarms_and_conditions/condition_info";
import { ConditionSnapshot } from "../../../src/alarms_and_conditions/condition_snapshot";
import { UAEventType, UAObject, UAVariable } from "../../address_space_ts";
import { ConditionInfoOptions } from "./condition_info_i";

export interface UAConditionBase extends UAEventType {

    getBranchCount(): number;

    getBranches(): ConditionSnapshot[];

    getBranchId(): NodeId[];

    createBranch(): ConditionSnapshot;

    getEnabledState(): boolean;

    getEnabledStateAsString(): string;

    setEnableState(state: boolean): StatusCode;

    setTime(time: Date): void;

    conditionOfNode(): UAVariable | UAObject | null;

    currentBranch(): ConditionSnapshot;

    raiseConditionEvent(condition: ConditionSnapshot, renewEventId: boolean): void;

    raiseNewCondition(conditionInfo: ConditionInfoOptions): void;

    raiseNewBranchState(condition: ConditionSnapshot): void;

}
