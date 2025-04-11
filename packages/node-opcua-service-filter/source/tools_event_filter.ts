/**
 * @module node-opcua-service-filter
 */
import { ObjectTypeIds } from "node-opcua-constants";
import {
    AttributeIds,
    QualifiedName,
    QualifiedNameOptions,
    coerceQualifiedName,
} from "node-opcua-data-model";

import { ContentFilter, ContentFilterElement, ContentFilterOptions, EventFilter, SimpleAttributeOperand } from "./imports";

function coerceQualifiedName2(a: string | QualifiedNameOptions) {
    if (typeof a === "string") return coerceQualifiedName(a);
    a.namespaceIndex = a.namespaceIndex || 0; // need a namespaceIndex
    return coerceQualifiedName(a);
}

export function constructSimpleBrowsePath(a: string | string[] | (QualifiedNameOptions | string)[]): QualifiedName[] {
    if (typeof a === "string") {
        return constructSimpleBrowsePath(a.split("."));
    }
    if (Array.isArray(a)) return a.map(coerceQualifiedName2);
    return [coerceQualifiedName2(a)];
}
export function constructSelectClause(
    arrayOfNames: string | string[] | (QualifiedNameOptions | string)[][]
): SimpleAttributeOperand[] {
    if (!Array.isArray(arrayOfNames)) {
        return constructSelectClause([arrayOfNames]);
    }
    // construct browse paths array
    const browsePaths = arrayOfNames.map(constructSimpleBrowsePath);

    // Part 4 page 127:
    // In some cases the same BrowsePath will apply to multiple EventTypes. If the Client specifies the BaseEventType
    // in the SimpleAttributeOperand then the Server shall evaluate the BrowsePath without considering the Type.

    const isBrowsePathForConditionId = (browsePath: QualifiedNameOptions[]) =>
        browsePath.length === 1 && browsePath[0] && browsePath[0].namespaceIndex === 0 && browsePath[0].name === "ConditionId";

    // [..]
    // The SimpleAttributeOperand structure allows the Client to specify any Attribute, however, the Server is only
    // required to support the Value Attribute for Variable Nodes and the NodeId Attribute for Object Nodes.
    // That said, profiles defined in Part 7 may make support for additional Attributes mandatory.
    const selectClauses = browsePaths.map((browsePath: QualifiedNameOptions[]) => {
        if (isBrowsePathForConditionId(browsePath)) {
            // special case
            //
            // The NodeId of the Condition instance is used as ConditionId. It is not explicitly modelled as a
            // component of the ConditionType. However, it can be requested with the following
            // SimpleAttributeOperand (see Table 10) in the SelectClause of the EventFilter:
            //
            //  SimpleAttributeOperand
            //  Name          Type          Description
            //  typeId        NodeId        NodeId of the ConditionType Node
            //  browsePath[]  QualifiedName empty
            //  attributeId   IntegerId     Id of the NodeId Attribute
            //
            return new SimpleAttributeOperand({
                attributeId: AttributeIds.NodeId,
                browsePath: null,
                indexRange: undefined, //  NumericRange
                typeDefinitionId: ObjectTypeIds.ConditionType // i=2782
            });
        } else
            return new SimpleAttributeOperand({
                attributeId: AttributeIds.Value,
                browsePath,
                indexRange: undefined, //  NumericRange
                typeDefinitionId: ObjectTypeIds.BaseEventType // i=2041
            });
    });
    return selectClauses;
}
/**
 * helper to construct event filters:
 * construct a simple event filter
 *
 *  "ConditionId" in the arrayOfNames has a special meaning
 *
 * @example
 *
 *     constructEventFilter(["SourceName","Message","ReceiveTime"]);
 *     constructEventFilter(["SourceName","2:MyData" ]);
 *     constructEventFilter(["SourceName" ,["EnabledState","EffectiveDisplayName"] ]);
 *     constructEventFilter(["SourceName" ,"EnabledState.EffectiveDisplayName" ]);
 *     constructEventFilter([ ["SourceName",{namespaceIndex:2 , "MyData"} ]]);
 *
 */
export function constructEventFilter(
    arrayOfNames: (QualifiedNameOptions | string)[][] | string[] | string,
    whereClause?: ContentFilterOptions | ContentFilterElement
): EventFilter {
    const selectClauses = constructSelectClause(arrayOfNames);

    if (whereClause instanceof ContentFilterElement) {
        whereClause = new ContentFilter({ elements: [whereClause] });
    }
    const filter = new EventFilter({
        selectClauses,
        whereClause
    });
    return filter;
}
