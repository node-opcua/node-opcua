require("requirish")._(module);

var subscription_service = require("lib/services/subscription_service");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

var assert = require("better-assert");
var _ = require("underscore");

function __validateDataChangeFilter(filter,itemToMonitor,node) {

    assert(itemToMonitor.attributeId  === AttributeIds.Value);
    assert(filter instanceof subscription_service.DataChangeFilter);

    var UAVariable = require("lib/address_space/ua_variable").UAVariable;
    var NodeId = require("lib/datamodel/nodeid").NodeId;

    if (!(node instanceof UAVariable)) {
        return StatusCodes.BadNodeIdInvalid;
    }

    assert(node instanceof UAVariable);

    // if node is not Numerical=> DataChangeFilter
    assert(node.dataType instanceof NodeId);
    var dataType = node.addressSpace.findDataType(node.dataType);

    var dataTypeNumber = node.addressSpace.findDataType("Number");
    if (!dataType.isSupertypeOf(dataTypeNumber)) {
        return StatusCodes.BadFilterNotAllowed;
    }


    if (filter.deadbandType === subscription_service.DeadbandType.Percent) {
        if (filter.deadbandValue < 0 || filter.deadbandValue > 100) {
            return StatusCodes.BadDeadbandFilterInvalid;
        }

        // node must also have a valid euRange
        if (!node.euRange) {
            console.log(" node has no euRange ! DeadbandPercent cannot be used on node "+ node.nodeId.toString());
            return StatusCodes.BadFilterNotAllowed;
        }
    }
    return StatusCodes.Good;
}

function __validateFilter(filter, itemToMonitor ,node) {

    // handle filter information
    if (filter && filter instanceof subscription_service.EventFilter && itemToMonitor.attributeId !== AttributeIds.EventNotifier) {
        // invalid filter on Event
        return StatusCodes.BadFilterNotAllowed;
    }

    if (filter && filter instanceof subscription_service.DataChangeFilter && itemToMonitor.attributeId !== AttributeIds.Value) {
        // invalid DataChange filter on non Value Attribute
        return StatusCodes.BadFilterNotAllowed;
    }

    if (filter && itemToMonitor.attributeId !== AttributeIds.EventNotifier && itemToMonitor.attributeId !== AttributeIds.Value) {
        return StatusCodes.BadFilterNotAllowed;
    }

    if (filter instanceof subscription_service.DataChangeFilter) {

        return __validateDataChangeFilter(filter,itemToMonitor,node);
    }

    return StatusCodes.Good;
}

exports.validateFilter = __validateFilter;
