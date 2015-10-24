"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var NodeId = require("lib/datamodel/nodeid").NodeId;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant  = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");

var BaseNode = require("lib/address_space/base_node").BaseNode;

var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;

function prepareDataType(dataType) {
    return coerceNodeId(dataType);
}
/**
 * @class UAVariableType
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function UAVariableType(options) {
    BaseNode.apply(this, arguments);
    //xx dumpif(!options.dataType,options);
    //xx assert(options.isAbstract || options.dataType, "dataType is mandatory if variable type is not abstract");
    this.value = options.value;          // optional default value for instances of this UAVariableType

    this.dataType = prepareDataType(options.dataType);    // DataType (NodeId)

    this.valueRank = options.valueRank || 0;  // Int32

    // see OPC-UA part 5 : $3.7 Conventions for Node descriptions
    this.arrayDimensions = options.arrayDimensions || [];
    assert(_.isArray(this.arrayDimensions));

    this.isAbstract = this.isAbstract ? true : false;  // false indicates that the UAVariableType cannot be used  as type definition
}
util.inherits(UAVariableType, BaseNode);
UAVariableType.prototype.nodeClass = NodeClass.VariableType;

UAVariableType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Value:
            if (this.hasOwnProperty("value") && this.value !== undefined) {
                assert(this.value._schema.name === "Variant");
                options.value = this.value;
                options.statusCode = StatusCodes.Good;
            } else {
                console.log(" warning Value not implemented");
                options.value = {dataType: DataType.UInt32, value: 0};
                options.statusCode = StatusCodes.BadAttributeIdInvalid;
            }
            break;
        case AttributeIds.DataType:
            assert(this.dataType instanceof NodeId);
            options.value = {dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            options.value = {dataType: DataType.Int32, value: this.valueRank};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            assert(_.isArray(this.arrayDimensions) || this.arrayDimensions === null);
            options.value = {dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: this.arrayDimensions};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
};

var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;

/**
 * instantiate an object of this UAVariableType
 * The instantiation takes care of object type inheritance when constructing inner properties
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
UAVariableType.prototype.instantiate = function (options) {

    var self = this;

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");
    //xx assert(!self.isAbstract, "cannot instantiate abstract UAObjectType");
    var address_space = self.__address_space;

    var baseVariableType = address_space.findVariableType("BaseVariableType"); // i=58
    assert(baseVariableType, "BaseVariableType must be defined in the address_space");

    var dataType = self.dataType;

    function initialize_properties_and_components(self, references) {

        if (baseVariableType.nodeId === self.nodeId) {
            return; // nothing to do
        }

        var baseTypeNodeId = self.subtypeOf;
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

    assert(!(options.componentOf && options.organizedBy)," must provide one of componentOf or OrganizedBy");


    var theValue = new Variant({
        dataType: DataType.ExtensionObject,
        value: address_space.constructExtensionObject(self.dataType)
    });

    var opts = {
        browseName: options.browseName,
        //Xx description: options.description || self.description,
        references: references,

        componentOf: options.componentOf,
        organizedBy: options.organizedBy,
        dataType: dataType,
        hasTypeDefinition: self.nodeId,

        value: theValue

    };
    var parentObj = options.componentOf ||  options.organizedBy;

    var instance = address_space.addVariable(parentObj,opts);

    if (instance.componentOf) {
        instance.componentOf.install_extra_properties();
    }
    if (instance.organizedBy) {
        instance.organizedBy.install_extra_properties();
    }

    // if VariableType is a type of Structure DataType
    // we need to instantiate a dataValue
    // and create a bidirectional binding with the individual properties of this type

    var structure = address_space.findDataType("Structure");
    assert(structure.browseName.toString() === "Structure");

    var components = instance.getComponents();
    var dt = address_space.findObject(self.dataType);
    if(dt.isSupertypeOf(structure)) {
        //
        dt.definition.forEach(function(d) {

            var component = components.filter(function(f){
                return f.browseName.name.toString() === d.name;
            });
            if (component.length === 1) {

                // install a getter function to retrieve the underlying object
                var prop = component[0];
                var name = lowerFirstLetter(d.name.toString());

                var dataType = address_space.findCorrespondingBasicDataType(d.dataType);

                //DataType.ExtensionObject
                prop.bindVariable({

                    timestamped_get: function() {

                        var dv = instance.readValue();
                        //xx console.log( "here ",dv.toString());
                        this._dataValue.statusCode        = dv.statusCode;
                        this._dataValue.serverTimestamp   = dv.serverTimestamp;
                        this._dataValue.serverPicoseconds = dv.serverPicoseconds;
                        this._dataValue.sourceTimestamp   = dv.sourceTimestamp;
                        this._dataValue.sourcePicoseconds = dv.sourcePicoseconds;

                        this._dataValue.value = new Variant({
                            // scalar
                            value: dv.value.value[name],
                            dataType: dataType
                        });

                        //xx this._dataValue.value.value = dv.value.value[name];
                        //xx console.log( "there ",this._dataValue.toString());
                        return this._dataValue;
                    }
                },true);

            }
        });
    }

    instance.install_extra_properties();

    return instance;
};

exports.UAVariableType = UAVariableType;

