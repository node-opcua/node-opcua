/**
 * @module opcua.address_space
 */

var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;

/**
 * @class UADataType
 * @extends  BaseNode
 * @param {Object} options
 * @param {Object} options.definition_name
 * @param {Object[]} options.definition
 *
 * @constructor
 */
function UADataType(options) {

//xx    console.log(" CONSTRUCTING A DATATYPE",options);

    BaseNode.apply(this, arguments);

    this.definition_name = options.definition_name || "<UNKNOWN>";
    this.definition = options.definition || [];

}

util.inherits(UADataType, BaseNode);
UADataType.prototype.nodeClass = NodeClass.DataType;
exports.UADataType = UADataType;

