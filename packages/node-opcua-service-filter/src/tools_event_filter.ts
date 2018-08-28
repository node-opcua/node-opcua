// tslint:disable:object-literal-shorthand
// tslint:disable:only-arrow-functions
import { assert } from "node-opcua-assert";
import * as  _ from "underscore";
import { SimpleAttributeOperand, EventFilter, } from "./imports";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { makeNodeId, NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";

import { ObjectTypeIds } from "node-opcua-constants";
import { AttributeIds, stringToQualifiedName } from "node-opcua-data-model";

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

/**
 * helper to construct event filters:
 * construct a simple event filter
 * @method constructEventFilter
 *
 * @param   arrayOfNames   {Array<string>}
 * @param   conditionTypes {Array<NodeId>}
 * @return  {EventFilter}
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
export function constructEventFilter(arrayOfNames: string[] | string, conditionTypes?: NodeId[] | NodeId): any {

    if (!_.isArray(arrayOfNames)) {
        return constructEventFilter([arrayOfNames], conditionTypes);
    }
    if (conditionTypes && !_.isArray(conditionTypes)) {
        return constructEventFilter(arrayOfNames, [conditionTypes]);
    }
    if (!(arrayOfNames instanceof Array)) throw new Error("internal error");

    // replace "string" element in the form A.B.C into [ "A","B","C"]
    const arrayOfNames2 = arrayOfNames.map(function (path) {
        if (typeof path !== "string") {
            return path;
        }
        return path.split(".");
    });

    const arrayOfNames3 = arrayOfNames2.map(function (path) {
        if (_.isArray(path)) {
            return path.map(stringToQualifiedName);
        }
        return path;
    });
    // replace "string" elements in arrayOfName with QualifiedName in namespace 0
    const arrayOfNames4 = arrayOfNames3.map(function (s) {
        return (typeof s === "string") ? stringToQualifiedName(s) : s;
    });


    // construct browse paths array
    const browsePaths = arrayOfNames4.map(function (s) {
        return _.isArray(s) ? s : [s];
    });

    // Part 4 page 127:
    // In some cases the same BrowsePath will apply to multiple EventTypes. If the Client specifies the BaseEventType
    // in the SimpleAttributeOperand then the Server shall evaluate the BrowsePath without considering the Type.

    // [..]
    // The SimpleAttributeOperand structure allows the Client to specify any Attribute, however, the Server is only
    // required to support the Value Attribute for Variable Nodes and the NodeId Attribute for Object Nodes.
    // That said, profiles defined in Part 7 may make support for additional Attributes mandatory.
    let selectClauses = browsePaths.map(function (browsePath) {
        return new SimpleAttributeOperand({
            typeDefinitionId: makeNodeId(ObjectTypeIds.BaseEventType), // i=2041
            browsePath: browsePath,
            attributeId: AttributeIds.Value,
            indexRange: undefined //  NumericRange
        });
    });

    if (conditionTypes) {
        const extraSelectClauses = conditionTypes.map(function (nodeId) {
            return new SimpleAttributeOperand({
                typeDefinitionId: nodeId, // conditionType for instance
                browsePath: undefined,
                attributeId: AttributeIds.NodeId,
                indexRange: undefined //  NumericRange
            });
        });
        selectClauses = selectClauses.concat(extraSelectClauses);
    }


    const filter = new EventFilter({

        selectClauses: selectClauses,

        whereClause: { // ContentFilter
            elements: [ // ContentFilterElement
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
    if (!self.browsePath) return "";
    return self.browsePath.map(function (a) {
        return a.name;
    }).join("/");
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
export function simpleAttributeOperandToShortString(self: SimpleAttributeOperand, addressSpace: any) {

    let str = "";
    if (addressSpace) {
        const n = addressSpace.findNode(self.typeDefinitionId);
        str += n.BrowseName.toString();
    }
    str += "[" + self.typeDefinitionId.toString() + "]" + simpleAttributeOperandToPath(self);
    return str;
}
function assert_valid_event_data(eventData: any) {
    assert(_.isFunction(eventData.resolveSelectClause));
    assert(_.isFunction(eventData.readValue));
}


/**
 *
 * @method extractEventField
 * extract a eventField from a event node, matching the given selectClause
 * @param eventData
 * @param selectClause
 */
function extractEventField(eventData: any, selectClause: any) {

    assert_valid_event_data(eventData);
    assert(selectClause instanceof SimpleAttributeOperand);

    selectClause.browsePath = selectClause.browsePath || [];

    if (selectClause.browsePath.length === 0 && selectClause.attributeId === AttributeIds.NodeId) {

        // "ns=0;i=2782" => ConditionType
        // "ns=0;i=2041" => BaseEventType
        if (selectClause.typeDefinitionId.toString() !== "ns=0;i=2782") {
            // not ConditionType
            console.warn("this case is not handled yet : selectClause.typeDefinitionId = " + selectClause.typeDefinitionId.toString());
            const eventSource = eventData.$eventDataSource;
            return new Variant({dataType: DataType.NodeId, value: eventSource.nodeId});
        }
        const conditionTypeNodeId = resolveNodeId("ConditionType");
        assert(sameNodeId(selectClause.typeDefinitionId, conditionTypeNodeId));

        const eventSource = eventData.$eventDataSource;
        const eventSourceTypeDefinition = eventSource.typeDefinitionObj;
        if (!eventSourceTypeDefinition) {
            // eventSource is a EventType class
            return new Variant();
        }
        const addressSpace = eventSource.addressSpace;
        const conditionType = addressSpace.findObjectType(conditionTypeNodeId);

        if (!eventSourceTypeDefinition.isSupertypeOf(conditionType)) {
            return new Variant();
        }
        // Yeh : our EventType is a Condition Type !
        return new Variant({dataType: DataType.NodeId, value: eventSource.nodeId});
    }


    const handle = eventData.resolveSelectClause(selectClause);

    if (handle !== null) {
        const value = eventData.readValue(handle, selectClause);
        assert(value instanceof Variant);
        return value;

    } else {

         // Part 4 - 7.17.3
        // A null value is returned in the corresponding event field in the Publish response if the selected
        // field is not part of the Event or an error was returned in the selectClauseResults of the EventFilterResult.
        // return new Variant({dataType: DataType.StatusCode, value: browsePathResult.statusCode});
        return new Variant();
    }
}

/**
 * @method extractEventFields
 * extract a array of eventFields from a event node, matching the selectClauses
 * @param selectClauses
 * @param eventData : a pseudo Node that provides a browse Method and a readValue(nodeId)
 */
function extractEventFields(selectClauses: any, eventData: any) {

    assert_valid_event_data(eventData);
    assert(_.isArray(selectClauses));
    assert(selectClauses.length === 0 || selectClauses[0] instanceof SimpleAttributeOperand);
    return selectClauses.map(extractEventField.bind(null, eventData));
}

exports.extractEventFields = extractEventFields;


