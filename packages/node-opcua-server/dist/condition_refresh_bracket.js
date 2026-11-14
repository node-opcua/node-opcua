import { ObjectTypeIds } from "node-opcua-constants";
import { makeNodeId, sameNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
const refreshStartEventTypeNodeId = makeNodeId(ObjectTypeIds.RefreshStartEventType);
const refreshEndEventTypeNodeId = makeNodeId(ObjectTypeIds.RefreshEndEventType);
/**
 * the RefreshStart / RefreshEnd bracket of a ConditionRefresh, and nothing else: what a MonitoredItem
 * delivers whatever its filter (OPC 10000-9 4.5), where the events are raised or in the engine of the
 * front threads for the items of the session workers
 */
export function isRefreshBracketEvent(eventData) {
    const eventType = eventData.eventType;
    if (!eventType || eventType.dataType !== DataType.NodeId) {
        return false;
    }
    const eventTypeNodeId = eventType.value;
    return sameNodeId(eventTypeNodeId, refreshStartEventTypeNodeId) || sameNodeId(eventTypeNodeId, refreshEndEventTypeNodeId);
}
//# sourceMappingURL=condition_refresh_bracket.js.map