import { extractEventFieldsBase, FilterContextOnAddressSpace } from "node-opcua-service-filter";
//
/**

 * extract a array of eventFields from a event node, matching the selectClauses
 * @param selectClauses
 * @param eventData : a pseudo Node that provides a browse Method and a readValue(nodeId)
 */
export function extractEventFields(sessionContext, selectClauses, eventData) {
    const context = new FilterContextOnAddressSpace(sessionContext, eventData);
    return extractEventFieldsBase(context, selectClauses);
}
//# sourceMappingURL=extract_event_fields.js.map