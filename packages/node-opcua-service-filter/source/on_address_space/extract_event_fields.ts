import type { IEventData, ISessionContext } from "node-opcua-address-space-base";
import type { SimpleAttributeOperand } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
//
import { extractEventFieldsBase } from "../extract_event_field.js";
import { FilterContextOnAddressSpace } from "./filter_context_on_address_space.js";

/**

 * extract a array of eventFields from a event node, matching the selectClauses
 * @param selectClauses
 * @param eventData : a pseudo Node that provides a browse Method and a readValue(nodeId)
 */
export function extractEventFields(
    sessionContext: ISessionContext,
    selectClauses: SimpleAttributeOperand[],
    eventData: IEventData
): Variant[] {
    const context = new FilterContextOnAddressSpace(sessionContext, eventData);
    return extractEventFieldsBase(context, selectClauses);
}
