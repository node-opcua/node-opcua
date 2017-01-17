/**
 * @module opcua.helpers
 */
require("requirish")._(module);

const assert = require("better-assert");

var subscription_service = require("lib/services/subscription_service");
const NumericRange = require("lib/datamodel/numeric_range").NumericRange;

const makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
const _ = require("underscore");
const ObjectTypeIds = require("lib/opcua_node_ids").ObjectTypeIds;
const read_service = require("lib/services/read_service");
const AttributeIds = read_service.AttributeIds;


const browse_path_tools = require("lib/tools/tools_browse_path");
const stringToQualifiedName = browse_path_tools.stringToQualifiedName;
const constructBrowsePathFromQualifiedName = browse_path_tools.constructBrowsePathFromQualifiedName;

const DataType = require("lib/datamodel/variant").DataType;
const Variant = require("lib/datamodel/variant").Variant;

const debugLog = require("lib/misc/utils").make_debugLog(__filename);
const doDebug = require("lib/misc/utils").checkDebugFlag(__filename);

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
    arrayOfNames = arrayOfNames.map(path => {
        if (typeof path !== "string") {
            return path;
        }
        return path.split(".");
    });
    arrayOfNames = arrayOfNames.map(path => {
        if (_.isArray(path)) {
            path = path.map(stringToQualifiedName);
        }
        return path;
    });
    // replace "string" elements in arrayOfName with QualifiedName in namespace 0
    arrayOfNames = arrayOfNames.map(s => (typeof s === "string") ? stringToQualifiedName(s) : s);


    // construct browse paths array
    const browsePaths = arrayOfNames.map(s => _.isArray(s) ? s : [s]);

    // Part 4 page 127:
    // In some cases the same BrowsePath will apply to multiple EventTypes. If the Client specifies the BaseEventType
    // in the SimpleAttributeOperand then the Server shall evaluate the BrowsePath without considering the Type.

    // [..]
    // The SimpleAttributeOperand structure allows the Client to specify any Attribute, however, the Server is only
    // required to support the Value Attribute for Variable Nodes and the NodeId Attribute for Object Nodes.
    // That said, profiles defined in Part 7 may make support for additional Attributes mandatory.
    const selectClauses = browsePaths.map(browsePath => new subscription_service.SimpleAttributeOperand({
        typeId: makeNodeId(ObjectTypeIds.BaseEventType), // i=2041
        browsePath,
        attributeId: AttributeIds.Value,
        indexRange: null //  NumericRange
    }));

    const filter = new subscription_service.EventFilter({

        selectClauses,

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

const UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
/**
 * @method checkSelectClause
 * @param parentNode
 * @param selectClause
 * @return {Array<StatusCode>}
 */
function checkSelectClause(parentNode, selectClause) {
    // SimpleAttributeOperand
    const addressSpace = parentNode.addressSpace;

    if (selectClause.typeId.isEmpty()) {
        return StatusCodes.Good;
    }
    const eventTypeNode =  addressSpace.findEventType(selectClause.typeId);

    if (!eventTypeNode || !(eventTypeNode instanceof UAObjectType)) {
        //xx console.log("eventTypeNode = ",selectClause.typeId.toString());
        //xx console.log("eventTypeNode = ",eventTypeNode);
        if (eventTypeNode) { console.log(eventTypeNode.toString()); }
    }

    assert(eventTypeNode instanceof UAObjectType);
    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    const browsePath = constructBrowsePathFromQualifiedName(eventTypeNode, selectClause.browsePath);
    const browsePathResult = addressSpace.browsePath(browsePath);
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
const SimpleAttributeOperand = subscription_service.SimpleAttributeOperand;

SimpleAttributeOperand.prototype.toPath = function() {
    const self = this;
    return self.browsePath.map(a => a.name).join("/");
};

SimpleAttributeOperand.prototype.toShortString = function(addressSpace) {

    const self = this;
    let str ="";
    if (addressSpace) {
        const n = addressSpace.findNode( self.typeId);
        str += n.BrowseName.toString()
    }
    str +=  `[${self.typeId.toString()}]${self.toPath()}`;
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

    const handle = eventData.resolveSelectClause(selectClause);

    if (handle !=null) {
        const value = eventData.readValue(handle,selectClause);
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


