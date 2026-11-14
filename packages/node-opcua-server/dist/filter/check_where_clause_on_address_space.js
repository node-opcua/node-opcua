import { checkFilter, FilterContextOnAddressSpace } from "node-opcua-service-filter";
export function checkWhereClauseOnAdressSpace(_addressSpace, sessionContext, whereClause, eventData) {
    // const filterContext: FilterContext = {
    //     addressSpace,
    //     sessionContext,
    //     rootNode: eventData.getEventDataSource(),
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
//# sourceMappingURL=check_where_clause_on_address_space.js.map