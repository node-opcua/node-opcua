"use strict";
/* global describe,it,before*/
require("requirish")._(module);

var assert = require("better-assert");
var UADataType = require("lib/address_space/ua_data_type").UADataType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;

var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;


var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var NodeId = require("lib/datamodel/nodeid").NodeId;



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
function createExtObjArrayNode(parentFolder,options) {

    assert(parentFolder instanceof UAObject);
    assert(typeof options.variableType ==="string" );
    assert(typeof options.indexPropertyName ==="string" );

    var addressSpace = parentFolder.__address_space;

    var complexVariableType = addressSpace.findVariableType(options.complexVariableType);
    assert(!complexVariableType.nodeId.isEmpty());


    var variableType = addressSpace.findVariableType(options.variableType);
    assert(!variableType.nodeId.isEmpty());

    var structure = addressSpace.findDataType("Structure");
    assert(structure,"Structure Type not found: please check your nodeset file");

    var dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


    var inner_options = {

        componentOf: parentFolder,

        browseName: options.browseName,
        dataType: dataType.nodeId,
        valueRank: 1,
        typeDefinition: complexVariableType.nodeId,
        value: { dataType: DataType.ExtensionObject, value: [], arrayType: VariantArrayType.Array }
    };

    var variable = addressSpace.addVariable(inner_options);

    bindExtObjArrayNode(variable,options.variableType,options.indexPropertyName);

    return variable;

}

exports.createExtObjArrayNode = createExtObjArrayNode;


function bindExtObjArrayNode(arr,variableType,indexPropertyName) {


    assert(arr instanceof UAVariable);
    var addressSpace = arr.__address_space;


    var variableType = addressSpace.findVariableType(variableType);
    assert(!variableType.nodeId.isEmpty());

    var structure = addressSpace.findDataType("Structure");
    assert(structure,"Structure Type not found: please check your nodeset file");

    var dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


    arr.$$variableType = variableType;

    var structure = addressSpace.findDataType("Structure");
    assert(structure,"Structure Type not found: please check your nodeset file");

    // verify that an object with same doesn't already exist
    var dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

    arr.$$dataType = dataType;

    arr.$$getElementBrowseName = function(extObj) {
        //assert(extObj.constructor === addressSpace.constructExtensionObject(dataType));
        assert(extObj.hasOwnProperty(indexPropertyName));
        return extObj[indexPropertyName].toString();
    };
    return arr;
}
exports.bindExtObjArrayNode = bindExtObjArrayNode;

function addElement(options,arr) {
    var addressSpace = arr.__address_space;

    // verify that arr has been created correctly
    assert( !!arr.$$variableType && !!arr.$$dataType, "did you create the array Node with createExtObjArrayNode ?");

    var obj =  addressSpace.constructExtensionObject(arr.$$dataType,options);

    var browseName = arr.$$getElementBrowseName(obj);

    var elVar = arr.$$variableType.instantiate({
        componentOf: arr.nodeId,
        browseName: browseName,
        value: { dataType: DataType.ExtensionObject, value: obj }
    });
    elVar.bindExtensionObject();

    // also add the value inside
    arr._dataValue.value.value.push(obj);
    return elVar;
}
exports.addElement = addElement;

function removeElement(arr,elementIndex) {
    var addressSpace = arr.__address_space;
    var _array = arr.readValue().value.value;
    if(_.isNumber(elementIndex)) {
        assert(elementIndex >= 0 && elementIndex < _array.length);
    } else {
        // find element by name
        // var browseNameToFind = arr.$$getElementBrowseName(elementIndex);
        var browseNameToFind = elementIndex.browseName.toString();

        var elementIndex =_array.findIndex(function(obj,i){
            var browseName = arr.$$getElementBrowseName(obj);
            return (browseName === browseNameToFind);
        });
        if (elementIndex<0) {
            throw new Error(" cannot find element matching "+ browseNameToFind.toString());
        }
    }
    var extObj = _array[elementIndex];
    var browseName = arr.$$getElementBrowseName(extObj);

    // remove element from global array (inefficient)
    _array.splice(elementIndex,1);

    // remove matching component

    var nodeId = 0;
    var node = arr.getComponentByName(browseName);

    if (!node) {
        throw new Error(" cannot find component ");
    }

    addressSpace.deleteNode(node.nodeId);

}
exports.removeElement = removeElement;
