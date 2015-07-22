"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var assert = require("better-assert");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;
var _ = require("underscore");

var util = require("util");

var BaseNode = require("lib/address_space/base_node").BaseNode;

/**
 * @class UAObjectType
 * @param options
 * @constructor
 */
function UAObjectType(options) {
    BaseNode.apply(this, arguments);
    //
    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
}
util.inherits(UAObjectType, BaseNode);
UAObjectType.prototype.nodeClass = NodeClass.ObjectType;

UAObjectType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
};

var tools = require("./tool_isSupertypeOf");
UAObjectType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(UAObjectType);

UAObjectType.prototype.__defineGetter__("subtypeOfObj", function () {
    if (!this._cache.subtypeOf) {
        var tmp = this.findReferencesAsObject("HasSubtype", false);
        this._cache.subtypeOf = tmp.length > 0 ? tmp[0] : null;
    }
    return this._cache.subtypeOf;

});

/**
 * instantiate an object of this UAObjectType
 * The instantiation takes care of object type inheritance when constructing inner properties and components.
 * @method instantiate
 * @param options
 * @param options.browseName {String}
 * @param [options.description]
 * @param [options.organizedBy] {String|NodeId|UANode} the parent Folder holding this object
 * @param [options.componentOf] {String|NodeId|UANode} the parent Object holding this object
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

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");
    //xx assert(!self.isAbstract, "cannot instantiate abstract UAObjectType");
    var address_space = self.__address_space;

    var baseObjectType = address_space.findObjectType("BaseObjectType"); // i=58
    assert(baseObjectType, "BaseObjectType must be defined in the address_space");

    function initialize_properties_and_components(self, references) {

        if (baseObjectType.nodeId === self.nodeId) {
            return; // nothing to do
        }

        var baseTypeNodeId = self.subTypeOf;
        // istanbul ignore next
        if (!baseTypeNodeId) {
            throw new Error("Object with nodeId " + self.nodeId + " has no Type");
        }

        var baseType = address_space.findObject(baseTypeNodeId);
        // istanbul ignore next
        if (!baseType) {
            throw new Error("Cannot find object with nodeId ".red + baseTypeNodeId);
        }

        initialize_properties_and_components(baseType, references);

        // get properties and components from base class
        var r = self._clone_references();

        //xx console.log(self.browseName,"r = ", r.length);
        Array.prototype.push.apply(references, r);
    }

    var references = [];
    initialize_properties_and_components(self, references);

    //xxassert(options.componentOf|| options.organizedBy);
    assert(!(options.componentOf && options.organizedBy));
    //xx var dumpReferences = require("./base_node").dumpReferences;
    //xx console.log("xxxx Mes references:");
    //xx dumpReferences(self.__address_space,self._references);
    //xx console.log("xxxx Mes back references:");
    //xx dumpReferences(self.__address_space,self._back_references);
    //xx console.log("xxxx Cloned  references:");
    //xx dumpReferences(self.__address_space,references);

    var opts = {
        browseName: options.browseName,
        description: options.description || self.description,
        references: references,

        componentOf: options.componentOf,
        organizedBy: options.organizedBy,

        hasTypeDefinition: self.nodeId
    };
    var instance = address_space.addObject(opts);

    instance.install_extra_properties();

    if (instance.componentOf) {
        instance.componentOf.install_extra_properties();
    }
    if (instance.organizedBy) {
        instance.organizedBy.install_extra_properties();
    }
    return instance;
};

exports.UAObjectType = UAObjectType;
