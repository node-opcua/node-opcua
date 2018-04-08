const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const subscription_service = require("node-opcua-service-subscription");
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const AttributeIds = require("node-opcua-data-model").AttributeIds;

const UAVariable = require("node-opcua-address-space").UAVariable;
const NodeId = require("node-opcua-nodeid").NodeId;
const EventFilter = require("node-opcua-service-filter").EventFilter;

function __validateDataChangeFilter(filter,itemToMonitor,node) {

    assert(itemToMonitor.attributeId  === AttributeIds.Value);
    assert(filter instanceof subscription_service.DataChangeFilter);


    if (!(node instanceof UAVariable)) {
        return StatusCodes.BadNodeIdInvalid;
    }

    assert(node instanceof UAVariable);

    // if node is not Numerical=> DataChangeFilter
    assert(node.dataType instanceof NodeId);
    const dataType = node.addressSpace.findDataType(node.dataType);

    const dataTypeNumber = node.addressSpace.findDataType("Number");
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
            return StatusCodes.BadMonitoredItemFilterUnsupported;
        }
    }
    return StatusCodes.Good;
}

function __validateFilter(filter, itemToMonitor ,node) {

    // handle filter information
    if (filter && filter instanceof EventFilter && itemToMonitor.attributeId !== AttributeIds.EventNotifier) {
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
