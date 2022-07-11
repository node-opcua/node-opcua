/**
 * @module node-opcua-service-filter
 */
// tslint:disable:object-literal-shorthand
// tslint:disable:only-arrow-functions
// tslint:disable:max-line-length

import { assert } from "node-opcua-assert";
import { ObjectTypeIds } from "node-opcua-constants";
import { AttributeIds, stringToQualifiedName } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { makeNodeId, NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { DataType, Variant } from "node-opcua-variant";

import { EventFilter, SimpleAttributeOperand } from "./imports";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/**
 * helper to construct event filters:
 * construct a simple event filter
 *
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
export function constructEventFilter(arrayOfNames: string[] | string, conditionTypes?: NodeId[] | NodeId): EventFilter {
    if (!Array.isArray(arrayOfNames)) {
        return constructEventFilter([arrayOfNames], conditionTypes);
    }
    if (conditionTypes && !Array.isArray(conditionTypes)) {
        return constructEventFilter(arrayOfNames, [conditionTypes]);
    }
    // istanbul ignore next
    if (!(arrayOfNames instanceof Array)) {
        throw new Error("internal error");
    }
    // replace "string" element in the form A.B.C into [ "A","B","C"]
    const arrayOfNames2 = arrayOfNames.map((path) => {
        if (typeof path !== "string") {
            return path;
        }
        return path.split(".");
    });

    const arrayOfNames3 = arrayOfNames2.map((path) => {
        if (Array.isArray(path)) {
            return path.map(stringToQualifiedName);
        }
        return path;
    });
    // replace "string" elements in arrayOfName with QualifiedName in namespace 0
    const arrayOfNames4 = arrayOfNames3.map((s) => {
        return typeof s === "string" ? stringToQualifiedName(s) : s;
    });

    // construct browse paths array
    const browsePaths = arrayOfNames4.map((s) => {
        return Array.isArray(s) ? s : [s];
    });

    // Part 4 page 127:
    // In some cases the same BrowsePath will apply to multiple EventTypes. If the Client specifies the BaseEventType
    // in the SimpleAttributeOperand then the Server shall evaluate the BrowsePath without considering the Type.

    // [..]
    // The SimpleAttributeOperand structure allows the Client to specify any Attribute, however, the Server is only
    // required to support the Value Attribute for Variable Nodes and the NodeId Attribute for Object Nodes.
    // That said, profiles defined in Part 7 may make support for additional Attributes mandatory.
    let selectClauses = browsePaths.map((browsePath) => {
        return new SimpleAttributeOperand({
            attributeId: AttributeIds.Value,
            browsePath,
            indexRange: undefined, //  NumericRange
            typeDefinitionId: makeNodeId(ObjectTypeIds.BaseEventType) // i=2041
        });
    });

    if (conditionTypes && conditionTypes instanceof Array) {
        const extraSelectClauses = conditionTypes.map((nodeId) => {
            return new SimpleAttributeOperand({
                attributeId: AttributeIds.NodeId,
                browsePath: undefined,
                indexRange: undefined, //  NumericRange
                typeDefinitionId: nodeId // conditionType for instance
            });
        });
        selectClauses = selectClauses.concat(extraSelectClauses);
    }

    const filter = new EventFilter({
        selectClauses,
        whereClause: {
            // ContentFilter
            elements: [
                // ContentFilterElement
                // {
                //    filterOperator: FilterOperator.IsNull,
                //    filterOperands: [ //
                //        new ElementOperand({
                //            index: 123
                //        }),
                //        new AttributeOperand({
                //            nodeId: "i=10",
                //            alias: "someText",
                //            browsePath: { //RelativePath
                //
                //            },
                //            attributeId: AttributeIds.Value
                //        })
                //    ]
                // }
            ]
        }
    });
    return filter;
}

/**
 * @class SimpleAttributeOperand
 * @method toPath
 * @return {String}
 *
 * @example:
 *
 *
 */
function simpleAttributeOperandToPath(self: SimpleAttributeOperand): string {
    if (!self.browsePath) {
        return "";
    }
    return self.browsePath
        .map((a) => {
            return a.name;
        })
        .join("/");
}

/**
 * @class SimpleAttributeOperand
 * @method toShortString
 * @return {String}
 *
 * @example:
 *
 *
 */
export function simpleAttributeOperandToShortString(
    self: SimpleAttributeOperand,
    addressSpace: any // Address Space
): string {
    let str = "";
    if (addressSpace) {
        const n = addressSpace.findNode(self.typeDefinitionId)!;
        str += n.BrowseName.toString();
    }
    str += "[" + self.typeDefinitionId.toString() + "]" + simpleAttributeOperandToPath(self);
    return str;
}
