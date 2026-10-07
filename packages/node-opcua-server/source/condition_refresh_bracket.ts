/**
 * @module node-opcua-server
 */
import type { IEventData } from "node-opcua-address-space";
import { ObjectTypeIds } from "node-opcua-constants";
import { makeNodeId, type NodeId, sameNodeId } from "node-opcua-nodeid";
import { DataType, type Variant } from "node-opcua-variant";

const refreshStartEventTypeNodeId = makeNodeId(ObjectTypeIds.RefreshStartEventType);
const refreshEndEventTypeNodeId = makeNodeId(ObjectTypeIds.RefreshEndEventType);

/** every EventData carries its EventType field: constructEventData fills it from the raised type */
interface IEventDataWithEventType {
    eventType?: Variant;
}

/**
 * the RefreshStart / RefreshEnd bracket of a ConditionRefresh, and nothing else: what a MonitoredItem
 * delivers whatever its filter (OPC 10000-9 4.5), where the events are raised or in the engine of the
 * front threads for the items of the session workers
 */
export function isRefreshBracketEvent(eventData: IEventData): boolean {
    const eventType = (eventData as IEventDataWithEventType).eventType;
    if (!eventType || eventType.dataType !== DataType.NodeId) {
        return false;
    }
    const eventTypeNodeId = eventType.value as NodeId;
    return sameNodeId(eventTypeNodeId, refreshStartEventTypeNodeId) || sameNodeId(eventTypeNodeId, refreshEndEventTypeNodeId);
}
