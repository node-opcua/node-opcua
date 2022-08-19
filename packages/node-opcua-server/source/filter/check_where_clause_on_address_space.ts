import { IAddressSpace, ISessionContext, IEventData } from "node-opcua-address-space-base";
import { checkFilter } from "node-opcua-service-filter";
import { FilterContextOnAddressSpace } from "node-opcua-service-filter";
import { ContentFilter } from "node-opcua-types";

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
