"use strict";
/* global describe,it,before*/
require("requirish")._(module);

var assert = require("better-assert");
var UADataType = require("lib/address_space/ua_data_type").UADataType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;
var BaseNode = require("lib/address_space/base_node").BaseNode;

var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;


var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var NodeId = require("lib/datamodel/nodeid").NodeId;

var makeStructure = require("lib/address_space/convert_nodeset_to_types").makeStructure;

/*
 * define a complex Variable containing a array of extension objects
 * each element of the array is also accessible as a component variable.
 *
 */


/**
 *
 * @method createExtObjArrayNode
 * @param parentFolder
 * @param options
 * @param options.browseName
 * @param options.complexVariableType
 * @param options.variableType
 * @param options.indexPropertyName
 * @return {Object|UAVariable}
 */
function createExtObjArrayNode(parentFolder, options) {

    assert(parentFolder instanceof UAObject);
    assert(typeof options.variableType === "string");
    assert(typeof options.indexPropertyName === "string");

    var addressSpace = parentFolder.addressSpace;

    var complexVariableType = addressSpace.findVariableType(options.complexVariableType);
    assert(!complexVariableType.nodeId.isEmpty());


    var variableType = addressSpace.findVariableType(options.variableType);
    assert(!variableType.nodeId.isEmpty());

    var structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    var dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


    var inner_options = {

        componentOf: parentFolder,

        browseName: options.browseName,
        dataType: dataType.nodeId,
        valueRank: 1,
        typeDefinition: complexVariableType.nodeId,
        value: {dataType: DataType.ExtensionObject, value: [], arrayType: VariantArrayType.Array}
    };

    var uaArrayVariableNode = addressSpace.addVariable(inner_options);
    assert(uaArrayVariableNode instanceof UAVariable);

    bindExtObjArrayNode(uaArrayVariableNode, options.variableType, options.indexPropertyName);

    return uaArrayVariableNode;

}

exports.createExtObjArrayNode = createExtObjArrayNode;


function getExtObjArrayNodeValue() {
    return new Variant({
        dataType: DataType.ExtensionObject,
        value: this.$$extensionObjectArray
    });
}
/**
 *
 * @param uaArrayVariableNode {UAVariable}
 * @param variableType        {DataType}
 * @param indexPropertyName   {String}
 * @returns {UAVariable}
 */
function bindExtObjArrayNode(uaArrayVariableNode, variableType, indexPropertyName) {


    assert(uaArrayVariableNode instanceof UAVariable);
    var addressSpace = uaArrayVariableNode.addressSpace;


    var variableType = addressSpace.findVariableType(variableType);
    assert(!variableType.nodeId.isEmpty());

    var structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    var dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


    uaArrayVariableNode.$$variableType = variableType;

    structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    // verify that an object with same doesn't already exist
    dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

    uaArrayVariableNode.$$dataType             = dataType;
    uaArrayVariableNode.$$extensionObjectArray = [];

    prepareDataType(dataType);

    uaArrayVariableNode.$$getElementBrowseName = function (extObj) {
        if (!extObj.hasOwnProperty(indexPropertyName)) {
            console.log(" extension object do not have ", indexPropertyName, extObj);
        }
        //assert(extObj.constructor === addressSpace.constructExtensionObject(dataType));
        assert(extObj.hasOwnProperty(indexPropertyName));
        return extObj[indexPropertyName].toString();
    };

    var options = {
        get: getExtObjArrayNodeValue,
        set: null, // readonly
    };

    // bind the readonly
    uaArrayVariableNode.bindVariable(options,true);

    return uaArrayVariableNode;
}
exports.bindExtObjArrayNode = bindExtObjArrayNode;

function addElement(options, uaArrayVariableNode) {

    assert(uaArrayVariableNode," must provide an UAVariable containing the array");
    assert(uaArrayVariableNode instanceof UAVariable,"expecting a UAVariable node here");
    // verify that arr has been created correctly
    assert(!!uaArrayVariableNode.$$variableType && !!uaArrayVariableNode.$$dataType, "did you create the array Node with createExtObjArrayNode ?");
    assert(uaArrayVariableNode.$$dataType instanceof UADataType);
    assert(uaArrayVariableNode.$$dataType._extensionObjectConstructor instanceof Function)

    var checkValue = uaArrayVariableNode.readValue();
    assert(checkValue.statusCode === StatusCodes.Good);
    assert(checkValue.value.dataType === DataType.ExtensionObject);


    var addressSpace = uaArrayVariableNode.addressSpace;

    var obj = null;
    if (options instanceof uaArrayVariableNode.$$dataType._extensionObjectConstructor) {
        // extension object has already been created
        obj = options;
    } else {
        obj = addressSpace.constructExtensionObject(uaArrayVariableNode.$$dataType, options);
    }

    var browseName = uaArrayVariableNode.$$getElementBrowseName(obj);

    var elVar = uaArrayVariableNode.$$variableType.instantiate({
        componentOf: uaArrayVariableNode.nodeId,
        browseName: browseName,
        value: {dataType: DataType.ExtensionObject, value: obj}
    });
    elVar.bindExtensionObject();

    // also add the value inside
    //xx uaArrayVariableNode._dataValue.value.value = uaArrayVariableNode._dataValue.value.value || [];
    //xx uaArrayVariableNode._dataValue.value.value.push(obj);
    uaArrayVariableNode.$$extensionObjectArray.push(obj);

    return elVar;
}
exports.addElement = addElement;

function removeElementByIndex(uaArrayVariableNode, elementIndex) {

    var _array = uaArrayVariableNode.$$extensionObjectArray;

    assert(_.isNumber(elementIndex));

    var addressSpace = uaArrayVariableNode.addressSpace;
    var extObj = _array[elementIndex];
    var browseName = uaArrayVariableNode.$$getElementBrowseName(extObj);

    // remove element from global array (inefficient)
    uaArrayVariableNode.$$extensionObjectArray.splice(elementIndex, 1);

    // remove matching component
    var node = uaArrayVariableNode.getComponentByName(browseName);

    if (!node) {
        throw new Error(" cannot find component ");
    }
    addressSpace.deleteNode(node.nodeId);
}

function removeElement(uaArrayVariableNode, element) {

    var _array = uaArrayVariableNode.$$extensionObjectArray;
    var elementIndex;
    if (_.isNumber(element)) {
        elementIndex = element;
        assert(elementIndex >= 0 && elementIndex < _array.length);
    } else if (element instanceof BaseNode ) {
        // find element by name
        // var browseNameToFind = arr.$$getElementBrowseName(elementIndex);
        var browseNameToFind = element.browseName.toString();
        elementIndex = _array.findIndex(function (obj, i) {
            var browseName = uaArrayVariableNode.$$getElementBrowseName(obj);
            return (browseName === browseNameToFind);
        });
    } else{
        elementIndex = _array.findIndex(function(x) { return x === element });
    }
    if (elementIndex < 0) {
        throw new Error(" cannot find element matching " + element.toString());
    }
    return removeElementByIndex(uaArrayVariableNode, elementIndex);
}
exports.removeElement = removeElement;

/**
 *
 * @param dataType
 */
function prepareDataType(dataType) {
    assert(dataType instanceof UADataType);
    if (!dataType._extensionObjectConstructor) {
        dataType._extensionObjectConstructor = makeStructure(dataType);
        if (!dataType._extensionObjectConstructor) {
            console.warn("AddressSpace#constructExtensionObject : cannot make structure for " + dataType.toString());
        }
    }
};
exports.prepareDataType = prepareDataType;
