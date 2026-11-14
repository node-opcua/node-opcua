/**
 * @module node-opcua-server
 */
import type { IEventData } from "node-opcua-address-space";
/**
 * the RefreshStart / RefreshEnd bracket of a ConditionRefresh, and nothing else: what a MonitoredItem
 * delivers whatever its filter (OPC 10000-9 4.5), where the events are raised or in the engine of the
 * front threads for the items of the session workers
 */
export declare function isRefreshBracketEvent(eventData: IEventData): boolean;
//# sourceMappingURL=condition_refresh_bracket.d.ts.map