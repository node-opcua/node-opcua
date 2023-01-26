import { IEventData, ISessionContext } from "node-opcua-address-space-base";
import { extractEventFieldsBase } from "node-opcua-service-filter";
import { FilterContextOnAddressSpace } from "node-opcua-service-filter";
import { SimpleAttributeOperand } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
//

/**
 * @method extractEventFields
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
