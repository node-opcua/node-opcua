import type { BaseNode, UAObject, UAVariable } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";

/**
 * The options {@link promoteToAlarm} accepts.
 *
 * The names are the ones `instantiateAlarmCondition` already uses, so the two routes to a working
 * alarm read the same. Everything is optional here: a node being promoted usually already carries
 * the children and references the factory would have created.
 */
export interface PromoteToAlarmOptions {
    /**
     * The node this alarm reports on. Wired as a backward HasCondition reference and used to fill
     * SourceNode and SourceName, exactly as at instantiation time. The node has to be an event
     * source, otherwise the events the alarm raises reach no one.
     */
    conditionSource?: UAObject | BaseNode | NodeId | null;
    /** The variable whose value drives the alarm; monitoring is installed when it is given. */
    inputNode?: UAVariable | NodeId;
    /** Defaults to the ConditionType, as at instantiation time. */
    conditionClass?: UAObject | BaseNode | NodeId | null;
    conditionName?: string;
    maxTimeShelved?: number;
}
