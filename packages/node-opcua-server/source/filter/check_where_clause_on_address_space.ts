import type { IAddressSpace, IEventData, ISessionContext } from "node-opcua-address-space-base";
import { checkFilter, FilterContextOnAddressSpace } from "node-opcua-service-filter";
import type { ContentFilter } from "node-opcua-types";

export function checkWhereClauseOnAdressSpace(
    addressSpace: IAddressSpace,
    sessionContext: ISessionContext,
    whereClause: ContentFilter,
    eventData: IEventData
): boolean {
    // const filterContext: FilterContext = {
    //     addressSpace,
    //     sessionContext,
    //     rootNode: eventData.$eventDataSource!,
    //     extractValue(operand: FilterOperand) {
    //         if (operand instanceof SimpleAttributeOperand) {
    //             return extractEventFields(filterContext.sessionContext, [operand], eventData)[0];
    //         } else {
    //             return new Variant({ dataType: DataType.Null });
    //         }
    //     }
    // };
    const filterContext = new FilterContextOnAddressSpace(sessionContext, eventData);

    return checkFilter(filterContext, whereClause);
}
