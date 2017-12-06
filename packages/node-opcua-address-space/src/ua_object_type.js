"use strict";

/**
 * @module opcua.address_space
 */

var assert = require("node-opcua-assert");

var _ = require("underscore");

var util = require("util");
var utils = require("node-opcua-utils");

var NodeClass = require("node-opcua-data-model").NodeClass;
var AttributeIds = require("node-opcua-data-model").AttributeIds;

var DataValue =  require("node-opcua-data-value").DataValue;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;


var BaseNode = require("./base_node").BaseNode;
var SessionContext = require("./session_context").SessionContext;
/**
 * @class UAObjectType
 * @param options
 * @constructor
 */
function UAObjectType(options) {

    BaseNode.apply(this, arguments);
    this.isAbstract = utils.isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;
}
util.inherits(UAObjectType, BaseNode);
UAObjectType.prototype.nodeClass = NodeClass.ObjectType;

UAObjectType.prototype.readAttribute = function (context, attributeId) {
    assert(context instanceof SessionContext);
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};

var tools = require("./tool_isSupertypeOf");
UAObjectType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(UAObjectType);



var initialize_properties_and_components = require("./ua_variable_type").initialize_properties_and_components;
var assertUnusedChildBrowseName = require("./ua_variable_type").assertUnusedChildBrowseName;
/**
 * instantiate an object of this UAObjectType
 * The instantiation takes care of object type inheritance when constructing inner properties and components.
 * @method instantiate
 * @param options
 * @param options.browseName {String}
 * @param [options.description]
 * @param [options.organizedBy] {String|NodeId|UANode} the parent Folder holding this object
 * @param [options.componentOf] {String|NodeId|UANode} the parent Object holding this object
 * @param [options.notifierOf] {NodeId|UANode}
 * @param [options.eventSourceOf] {NodeId|UANode}
 * @param [options.optionals = [] {Array<String>] ] name of the optional child to create
 * @param [options.modellingRule] {String}
 *
 *
 * Note : HasComponent usage scope
 *
 *    Source          |     Destination
 * -------------------+---------------------------
 *  Object            | Object, Variable,Method
 *  ObjectType        |
 * -------------------+---------------------------
 *  DataVariable      | Variable
 *  DataVariableType  |
 */
UAObjectType.prototype.instantiate = function (options) {


    var self = this;
    var addressSpace = self.addressSpace;
    assert(!self.isAbstract, "cannot instantiate abstract UAObjectType");

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");

    assert(!options.hasOwnProperty("propertyOf"),"an Object shall not be a PropertyOf an other object");
    assert(!options.hasOwnProperty("optional"),"do you mean optionals ?");

    assertUnusedChildBrowseName(addressSpace,options);

    var baseObjectType = addressSpace.findObjectType("BaseObjectType");
    assert(baseObjectType, "BaseObjectType must be defined in the address space");


    var references = [];

    var opts = {
        browseName:     options.browseName,
        description:    options.description || self.description,
        references:     references,
        componentOf:    options.componentOf,
        organizedBy:    options.organizedBy,
        notifierOf:     options.notifierOf,
        eventSourceOf:  options.eventSourceOf,
        typeDefinition: self.nodeId,

        nodeId: options.nodeId,

        modellingRule : options.modellingRule
    };

    var instance = addressSpace.addObject(opts);

    initialize_properties_and_components(instance, baseObjectType,self, options.optionals);

    assert(instance.typeDefinition.toString()=== self.nodeId.toString());

    instance.install_extra_properties();

    if (self._postInstantiateFunc) {
        self._postInstantiateFunc(instance,self,options);
    }

    return instance;
};

exports.UAObjectType = UAObjectType;
