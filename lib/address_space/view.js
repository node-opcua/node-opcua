/**
 * @module opcua.address_space
 */
require("requirish")._(module);

const NodeClass = require("lib/datamodel/nodeclass").NodeClass;
const NodeId = require("lib/datamodel/nodeid").NodeId;
const makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
const resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;


const DataValue = require("lib/datamodel/datavalue").DataValue;
const DataType = require("lib/datamodel/variant").DataType;
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

const read_service = require("lib/services/read_service");
const AttributeIds = read_service.AttributeIds;


const translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
const BrowsePathResult = translate_service.BrowsePathResult;
const BrowsePath = translate_service.BrowsePath;

const assert = require("better-assert");
const util = require("util");
const _ = require("underscore");

const dumpIf = require("lib/misc/utils").dumpIf;

const BaseNode = require("lib/address_space/base_node").BaseNode;

/**
 * @class View
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function View(options) {
    BaseNode.apply(this, arguments);
    this.containsNoLoops = options.containsNoLoops ? true : false;
    this.eventNotifier = 0;
}
util.inherits(View, BaseNode);
View.prototype.nodeClass = NodeClass.View;

/**
 * @method readAttribute
 * @param attributeId
 * @return {DataValue}
 */
View.prototype.readAttribute = function (attributeId) {

    const options = {};

    switch (attributeId) {
        case AttributeIds.EventNotifier:
            options.value = {dataType: DataType.UInt32, value: this.eventNotifier};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ContainsNoLoops:
            options.value = {dataType: DataType.Boolean, value: this.containsNoLoops};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
};
exports.View = View;


