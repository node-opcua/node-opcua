require("requirish")._(module);

const subscription_service = require("lib/services/subscription_service");
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
const AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

const assert = require("better-assert");
const _ = require("underscore");

function __validateDataChangeFilter(filter,itemToMonitor,node) {

    assert(itemToMonitor.attributeId  === AttributeIds.Value);
    assert(filter instanceof subscription_service.DataChangeFilter);

    const UAVariable = require("lib/address_space/ua_variable").UAVariable;
    const NodeId = require("lib/datamodel/nodeid").NodeId;

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
            console.log(` node has no euRange ! DeadbandPercent cannot be used on node ${node.nodeId.toString()}`);
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
