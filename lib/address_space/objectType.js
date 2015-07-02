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

var BaseNode = require("lib/address_space/basenode").BaseNode;

/**
 * @class ObjectType
 * @param options
 * @constructor
 */
function ObjectType(options) {
    BaseNode.apply(this, arguments);
    //
    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
}
util.inherits(ObjectType, BaseNode);
ObjectType.prototype.nodeClass = NodeClass.ObjectType;

ObjectType.prototype.readAttribute = function (attributeId) {
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


ObjectType.prototype.__defineGetter__("subtypeOfObj",function() {
    if (!this._cache.subtypeOf) {
        var tmp = this.findReferencesAsObject("HasSubtype", false);
        this._cache.subtypeOf = tmp.length>0 ? tmp[0] : null;
    }
    return this._cache.subtypeOf;

});

/**
 * instantiate an object of this ObjectType
 * @method instantiate
 * @param options
 * @param options.browseName
 * @param  [options.description]
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
ObjectType.prototype.instantiate = function (options) {
    var self = this;

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");
    assert(!self.isAbstract, "cannot instantiate abstract ObjectType");
    var address_space = self.__address_space;

    var references = self._clone_references();

    //xx var dumpReferences = require("./basenode").dumpReferences;
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
        hasTypeDefinition: self.nodeId
    };
    var instance = address_space.addObject(opts);

    instance.install_extra_properties();
    if (options.componentOf) {
        options.componentOf.install_extra_properties();
    }
    return instance;
};

exports.ObjectType = ObjectType;
