/**
 * @module node-opcua-service-filter
 */
import { ObjectTypeIds } from "node-opcua-constants";
import { AttributeIds, QualifiedName, stringToQualifiedName } from "node-opcua-data-model";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";

import { ContentFilter, ContentFilterElement, ContentFilterOptions, EventFilter, FilterOperator, SimpleAttributeOperand } from "./imports";

import { ofType } from "./make_content_filter";

export function constructSelectClause(arrayOfNames: string | string[]): SimpleAttributeOperand[] {
    if (!Array.isArray(arrayOfNames)) {
        return constructSelectClause([arrayOfNames]);
    }

    // replace "string" element in the form A.B.C into [ "A","B","C"]
    const arrayOfNames2 = arrayOfNames.map((path) => (typeof path !== "string" ? path : path.split(".")));

    const arrayOfNames3 = arrayOfNames2.map((path) => (Array.isArray(path) ? path.map(stringToQualifiedName) : path));

    // replace "string" elements in arrayOfName with QualifiedName in namespace 0
    const arrayOfNames4 = arrayOfNames3.map((s) => (typeof s === "string" ? stringToQualifiedName(s) : s));

    // construct browse paths array
    const browsePaths = arrayOfNames4.map((s) => (Array.isArray(s) ? s : [s]));

    // Part 4 page 127:
    // In some cases the same BrowsePath will apply to multiple EventTypes. If the Client specifies the BaseEventType
    // in the SimpleAttributeOperand then the Server shall evaluate the BrowsePath without considering the Type.

    const isBrowsePathForConditionId = (browsePath: QualifiedName[]) =>
        browsePath.length === 1 && browsePath[0].namespaceIndex === 0 && browsePath[0].name === "ConditionId";

    // [..]
    // The SimpleAttributeOperand structure allows the Client to specify any Attribute, however, the Server is only
    // required to support the Value Attribute for Variable Nodes and the NodeId Attribute for Object Nodes.
    // That said, profiles defined in Part 7 may make support for additional Attributes mandatory.
    const selectClauses = browsePaths.map((browsePath: QualifiedName[]) => {
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
 *
 *     constructEventFilter(["SourceName",{namespaceIndex:2 , "MyData"}]);
 *     constructEventFilter(["SourceName","2:MyData" ]);
 *
 *     constructEventFilter(["SourceName" ,["EnabledState","EffectiveDisplayName"] ]);
 *     constructEventFilter(["SourceName" ,"EnabledState.EffectiveDisplayName" ]);
 *
 */
export function constructEventFilter(
    arrayOfNames: string[] | string,
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
