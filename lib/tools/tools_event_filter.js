"use strict";
/**
 * @module opcua.helpers
 */
require("requirish")._(module);

var assert = require("better-assert");

var subscription_service = require("lib/services/subscription_service");
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var _ = require("underscore");
var ObjectTypeIds = require("lib/opcua_node_ids").ObjectTypeIds;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;


var browse_path_tools = require("lib/tools/tools_browse_path");
var stringToQualifiedName = browse_path_tools.stringToQualifiedName;
var constructBrowsePathFromQualifiedName = browse_path_tools.constructBrowsePathFromQualifiedName;

var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;

/**
 * helper to construct event filters:
 * construct a simple event filter
 * @method constructEventFilter
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
function constructEventFilter(arrayOfNames) {

    if (!_.isArray(arrayOfNames)) {
        return constructEventFilter([arrayOfNames]);
    }

    // replace "string" element in the form A.B.C into [ "A","B","C"]
    arrayOfNames = arrayOfNames.map(function (path) {
        if (typeof path !== "string") {
            return path;
        }
        return path.split(".");
    });
    arrayOfNames = arrayOfNames.map(function (path) {
        if (_.isArray(path)) {
            path = path.map(stringToQualifiedName);
        }
        return path;
    });
    // replace "string" elements in arrayOfName with QualifiedName in namespace 0
    arrayOfNames = arrayOfNames.map(function (s) {

        return (typeof s === "string") ? stringToQualifiedName(s) : s;
    });


    // construct browse paths array
    var browsePaths = arrayOfNames.map(function (s) {
        return _.isArray(s) ? s : [s];
    });

    // Part 4 page 127:
    // In some cases the same BrowsePath will apply to multiple EventTypes. If the Client specifies the BaseEventType
    // in the SimpleAttributeOperand then the Server shall evaluate the BrowsePath without considering the Type.

    // [..]
    // The SimpleAttributeOperand structure allows the Client to specify any Attribute, however, the Server is only
    // required to support the Value Attribute for Variable Nodes and the NodeId Attribute for Object Nodes.
    // That said, profiles defined in Part 7 may make support for additional Attributes mandatory.
    var selectClauses = browsePaths.map(function (browsePath) {
        return new subscription_service.SimpleAttributeOperand({
            typeId: makeNodeId(ObjectTypeIds.BaseEventType), // i=2041
            browsePath: browsePath,
            attributeId: AttributeIds.Value,
            indexRange: null //  NumericRange
        });
    });

    var filter = new subscription_service.EventFilter({

        selectClauses: selectClauses,

        whereClause: { //ContentFilter
            elements: [ // ContentFilterElement
                //{
                //    filterOperator: subscription_service.FilterOperator.IsNull,
                //    filterOperands: [ //
                //        new subscription_service.ElementOperand({
                //            index: 123
                //        }),
                //        new subscription_service.AttributeOperand({
                //            nodeId: "i=10",
                //            alias: "someText",
                //            browsePath: { //RelativePath
                //
                //            },
                //            attributeId: AttributeIds.Value
                //        })
                //    ]
                //}
            ]
        }
    });

    return filter;

}
exports.constructEventFilter = constructEventFilter;

var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
/**
 * @method checkSelectClause
 * @param parentNode
 * @param selectClause
 * @return {Array<StatusCode>}
 */
function checkSelectClause(parentNode, selectClause) {
    // SimpleAttributeOperand
    var addressSpace = parentNode.__address_space;

    if (selectClause.typeId.isEmpty()) {


        return StatusCodes.Good;
    }
    var eventTypeNode =  addressSpace.findEventType(selectClause.typeId);

    if (!eventTypeNode || !(eventTypeNode instanceof UAObjectType)) {
        console.log("eventTypeNode = ",selectClause.typeId.toString());
        console.log("eventTypeNode = ",eventTypeNode);
        if (eventTypeNode) { console.log(eventTypeNode.toString()); }
    }

    assert(eventTypeNode instanceof UAObjectType);
    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    var browsePath = constructBrowsePathFromQualifiedName(eventTypeNode, selectClause.browsePath);
    var browsePathResult = addressSpace.browsePath(browsePath);
    return browsePathResult.statusCode;

}
exports.checkSelectClause = checkSelectClause;
/**
 * @method checkSelectClauses
 * @param eventTypeNode
 * @param selectClauses {selectClauseResults}
 * @return {StatusCodes<>}
 */
function checkSelectClauses(eventTypeNode, selectClauses) {
    return selectClauses.map(checkSelectClause.bind(null, eventTypeNode));
}
exports.checkSelectClauses = checkSelectClauses;






/**
 *
 * @param referenceBaseName
 *
 * @example:
 *
 *  // returns all children elements with a reference type that derives from "Aggregates"
 *  // (i.e HasProperty, HasComponent, HasOrderedComponent)
 *  var nodes = obj.getChildren("Aggregates");
 *
 *
 */
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var subscription_service = require("lib/services/subscription_service");
var SimpleAttributeOperand = subscription_service.SimpleAttributeOperand;

function browsePath(eventNode, selectClause) {

    assert(selectClause instanceof SimpleAttributeOperand);
    // SimpleAttributeOperand
    var address_space = eventNode.__address_space;

    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    var browsePath = constructBrowsePathFromQualifiedName(eventNode, selectClause.browsePath);

    var browsePathResult = address_space.browsePath(browsePath);
    return browsePathResult;
}


/**
 * extract a eventField from a event node, matching the given selectClause
 * @param eventNode
 * @param map
 * @param selectClause
 */
function extractEventField(eventNode,map, selectClause) {

    var DataValue=require("lib/datamodel/datavalue").DataValue;
    var UAVariable = require("lib/address_space/ua_variable").UAVariable;

    function prepare(dataValue) {
        assert(dataValue instanceof DataValue);
        if(dataValue.statusCode === StatusCodes.Good) {
            return dataValue.value;
        }
        return new Variant({dataType: DataType.StatusCode, value: dataValue.statusCode});
    }
    assert(selectClause instanceof SimpleAttributeOperand);

    var addressSpace = eventNode.__address_space;
    //console.log(selectClause.toString());
    var browsePathResult = browsePath(eventNode, selectClause);
    //console.log(browsePathResult.toString());

    if (browsePathResult.statusCode === StatusCodes.Good) {
        assert(browsePathResult.targets.length === 1);
        var node = addressSpace.findNode(browsePathResult.targets[0].targetId);

        var key = node.nodeId.toString();
        if (map[key]) {
            return map[key];
        }
        if (node instanceof UAVariable && selectClause.attributeId === AttributeIds.Value) {

            return prepare(node.readValue(selectClause.indexRange));
        }
        return prepare(node.readAttribute(selectClause.attributeId));

    } else {
        return new Variant({dataType: DataType.StatusCode, value: browsePathResult.statusCode});
    }
    //xx var innerNode =
}

/**
 * extract a array of eventFields from a event node, matching the selectClauses
 * @param eventTypeNode
 * @param selectClauses
 * @param eventData
 */
function extractEventFields(eventTypeNode, selectClauses,eventData) {

    assert(_.isArray(selectClauses));
    assert(selectClauses.length===0 || selectClauses[0] instanceof SimpleAttributeOperand);
    assert(eventData.hasOwnProperty("__nodes"));
    var nodeValueMap = eventData.__nodes;
    return selectClauses.map(extractEventField.bind(null, eventTypeNode,nodeValueMap));
}

exports.extractEventFields = extractEventFields;


