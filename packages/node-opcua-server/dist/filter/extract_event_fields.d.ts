import type { IEventData, ISessionContext } from "node-opcua-address-space-base";
import type { SimpleAttributeOperand } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
/**

 * extract a array of eventFields from a event node, matching the selectClauses
 * @param selectClauses
 * @param eventData : a pseudo Node that provides a browse Method and a readValue(nodeId)
 */
export declare function extractEventFields(sessionContext: ISessionContext, selectClauses: SimpleAttributeOperand[], eventData: IEventData): Variant[];
//# sourceMappingURL=extract_event_fields.d.ts.map