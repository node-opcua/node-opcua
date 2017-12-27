"use strict";
/* global describe,it,before*/
var assert = require("node-opcua-assert");
var _ = require("underscore");

var Variant = require("node-opcua-variant").Variant;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var DataType = require("node-opcua-variant").DataType;

var StatusCodes = require("node-opcua-status-code").StatusCodes;


var BaseNode = require("./base_node").BaseNode;
var UADataType = require("./ua_data_type").UADataType;
var UAObject = require("./ua_object").UAObject;
var UAVariable = require("./ua_variable").UAVariable;

var AddressSpace = require("./address_space").AddressSpace;

var hasConstructor = require("node-opcua-factory").hasConstructor;
var getConstructor = require("node-opcua-factory").getConstructor;

function makeStructure(dataType,bForce) {

    bForce = !!bForce;

    assert(dataType instanceof UADataType);

    var addressSpace = dataType.addressSpace;
    assert(addressSpace.constructor.name === "AddressSpace");
    assert(addressSpace instanceof AddressSpace);

    // istanbul ignore next
    if (!dataType.binaryEncodingNodeId) {
        throw new Error("DataType with name " + dataType.browseName.toString() + " has no binaryEncoding node\nplease check your nodeset file");
    }

    // if binaryEncodingNodeId is in the standard factory => no need to overwrite
    if (!bForce && (hasConstructor(dataType.binaryEncodingNodeId) ||   dataType.binaryEncodingNodeId.namespace === 0)) {
        //xx console.log("Skipping standard constructor".bgYellow ," for dataType" ,dataType.browseName.toString());
        return getConstructor(dataType.binaryEncodingNodeId);
    }
    // etc ..... please fix me
    var namespaceUri = addressSpace.getNamespaceUri(dataType.nodeId.namespace);
    console.log("XXXXXXXXXXXXXX=>", "#makeStructure FIX ME !!!!!!! ".red, namespaceUri);
}
/*
 * define a complex Variable containing a array of extension objects
 * each element of the array is also accessible as a component variable.
 *
 */


/**
 *
 * @method createExtObjArrayNode
 *         create a node Variable that contains a array of ExtensionObject of a given type
 * @param parentFolder
 * @param options
 * @param options.browseName
 * @param options.complexVariableType :
    * @param options.variableType        : the type of Extension objects stored in the array.
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
        arrayType: VariantArrayType.Array,
        value: this.$$extensionObjectArray
    });
}

/**
 * @method prepareDataType
 * @private
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
}
exports.prepareDataType = prepareDataType;

/**
 *
 * @param uaArrayVariableNode {UAVariable}
 * @param variableType        {DataType}
 * @param indexPropertyName   {String}
 * @return {UAVariable}
 */
function bindExtObjArrayNode(uaArrayVariableNode, variableType, indexPropertyName) {

    assert(uaArrayVariableNode instanceof UAVariable);
    var addressSpace = uaArrayVariableNode.addressSpace;

    variableType = addressSpace.findVariableType(variableType);
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
        set: null // readonly
    };

    // bind the readonly
    uaArrayVariableNode.bindVariable(options,true);

    return uaArrayVariableNode;
}
exports.bindExtObjArrayNode = bindExtObjArrayNode;

/**
 * @method addElement
 *         add a new element in a ExtensionObject Array variable
 *
 * @param options {Object}   data used to construct the underlying ExtensionObject
 * @param uaArrayVariableNode {UAVariable}
 * @return {*}
 */
function addElement(options, uaArrayVariableNode) {

    assert(uaArrayVariableNode," must provide an UAVariable containing the array");
    assert(uaArrayVariableNode instanceof UAVariable,"expecting a UAVariable node here");
    // verify that arr has been created correctly
    assert(!!uaArrayVariableNode.$$variableType && !!uaArrayVariableNode.$$dataType, "did you create the array Node with createExtObjArrayNode ?");
    assert(uaArrayVariableNode.$$dataType instanceof UADataType);
    assert(uaArrayVariableNode.$$dataType._extensionObjectConstructor instanceof Function);

    var checkValue = uaArrayVariableNode.readValue();
    assert(checkValue.statusCode === StatusCodes.Good);
    assert(checkValue.value.dataType === DataType.ExtensionObject);

    var addressSpace = uaArrayVariableNode.addressSpace;

    var extensionObject = null;
    if (options instanceof uaArrayVariableNode.$$dataType._extensionObjectConstructor) {
        // extension object has already been created
        extensionObject = options;
    } else {
        extensionObject = addressSpace.constructExtensionObject(uaArrayVariableNode.$$dataType, options);
    }

    var browseName = uaArrayVariableNode.$$getElementBrowseName(extensionObject);

    var elVar = uaArrayVariableNode.$$variableType.instantiate({
        componentOf: uaArrayVariableNode.nodeId,
        browseName: browseName,
        value: {dataType: DataType.ExtensionObject, value: extensionObject}
    });
    elVar.bindExtensionObject();
    elVar.$extensionObject = extensionObject;
    -

        // also add the value inside
        uaArrayVariableNode.$$extensionObjectArray.push(extensionObject);

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


