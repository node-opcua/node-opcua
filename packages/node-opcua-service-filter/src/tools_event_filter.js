"use strict";
/**
 * @module opcua.helpers
 */


var assert = require("better-assert");

var SimpleAttributeOperand = require("../_generated_/_auto_generated_SimpleAttributeOperand").SimpleAttributeOperand;
var EventFilter = require("../_generated_/_auto_generated_EventFilter").EventFilter;
var StatusCodes = require("node-opcua-status-code").StatusCodes;


// xx var NumericRange = require("node-opcua-numeric-range").NumericRange;

var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var _ = require("underscore");
var ObjectTypeIds = require("node-opcua-constants").ObjectTypeIds;
var AttributeIds = require("node-opcua-data-model").AttributeIds;
var stringToQualifiedName = require("node-opcua-data-model").stringToQualifiedName;

var Variant = require("node-opcua-variant").Variant;


var debugLog = require("node-opcua-debug").make_debugLog(__filename);
var doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

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
        return new SimpleAttributeOperand({
            typeId: makeNodeId(ObjectTypeIds.BaseEventType), // i=2041
            browsePath: browsePath,
            attributeId: AttributeIds.Value,
            indexRange: null //  NumericRange
        });
    });

    var filter = new EventFilter({

        selectClauses: selectClauses,

        whereClause: { //ContentFilter
            elements: [ // ContentFilterElement
                //{
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
                //}
            ]
        }
    });

    return filter;

}
exports.constructEventFilter = constructEventFilter;





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

SimpleAttributeOperand.prototype.toPath = function() {
    var self = this;
    return self.browsePath.map(function (a) {
        return a.name;
    }).join("/");
};

SimpleAttributeOperand.prototype.toShortString = function(addressSpace) {

    var self = this;
    var str ="";
    if (addressSpace) {
        var n = addressSpace.findNode( self.typeId);
        str += n.BrowseName.toString()
    }
    str +=  "[" + self.typeId.toString() +"]"+self.toPath();
    return str;
};


function assert_valid_event_data(eventData) {
    assert(_.isFunction(eventData.resolveSelectClause));
    assert(_.isFunction(eventData.readValue));
}



/**
 * extract a eventField from a event node, matching the given selectClause
 * @param eventNode
 * @param selectClause
 */
function extractEventField(eventData, selectClause) {

    assert_valid_event_data(eventData);
    assert(selectClause instanceof SimpleAttributeOperand);

    var handle = eventData.resolveSelectClause(selectClause);

    if (handle !=null) {
        var value = eventData.readValue(handle,selectClause);
        assert(value instanceof Variant);
        return value;

    } else {
        // Part 4 - 7.17.3
        // A null value is returned in the corresponding event field in the Publish response if the selected
        // field is not part of the Event or an error was returned in the selectClauseResults of the EventFilterResult.
        // return new Variant({dataType: DataType.StatusCode, value: browsePathResult.statusCode});
        return new Variant();
    }
    //xx var innerNode =
}

/**
 * extract a array of eventFields from a event node, matching the selectClauses
 * @param eventTypeNode
 * @param selectClauses
 * @param eventData : a pseudo Node that provides a browse Method and a readValue(nodeId)
 */
function extractEventFields(selectClauses,eventData) {

    assert_valid_event_data(eventData);
    assert(_.isArray(selectClauses));
    assert(selectClauses.length===0 || selectClauses[0] instanceof SimpleAttributeOperand);
    return selectClauses.map(extractEventField.bind(null, eventData));
}

exports.extractEventFields = extractEventFields;


