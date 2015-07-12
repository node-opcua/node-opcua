"use strict";
/**
 * @module opcua.helpers
 */
require("requirish")._(module);
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
    arrayOfNames = arrayOfNames.map(function(path) {
        if (typeof path!=="string") return path;
        return path.split(".");
    });
    arrayOfNames = arrayOfNames.map(function(path) {
        if (_.isArray(path)) {
            path = path.map(stringToQualifiedName);
        }
        return path;
    });
    // replace "string" elements in arrayOfName with QualifiedName in namespace 0
    arrayOfNames = arrayOfNames.map(function(s){

        return (typeof s === "string") ? stringToQualifiedName(s) : s ;
    });


    // construct browse paths array
    var browsePaths = arrayOfNames.map(function(s){
        return _.isArray(s) ? s : [s] ;
    });

    var selectClauses = browsePaths.map(function(browsePath){
        return {
            typeId: makeNodeId(ObjectTypeIds.BaseEventType), // i=2041
            browsePath: browsePath,
            attributeId: AttributeIds.Value,
            indexRange: null //  NumericRange
        }
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

/**
 *
 * @param eventTypeNode
 * @param selectClause
 * @returns {Array<StatusCode>}
 */
function checkSelectClause(eventTypeNode,selectClause) {
    // SimpleAttributeOperand
    var address_space = eventTypeNode.__address_space;
    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    var browsePath = constructBrowsePathFromQualifiedName(eventTypeNode,selectClause.browsePath);
    var browsePathResult = address_space.browsePath(browsePath);
    return browsePathResult.statusCode;

}
/**
 *
 * @param eventTypeNode
 * @param selectClauses {selectClauseResults}
 */
function checkSelectClauses(eventTypeNode,selectClauses) {
    return selectClauses.map(checkSelectClause.bind(null,eventTypeNode));
}
exports.checkSelectClauses = checkSelectClauses;
