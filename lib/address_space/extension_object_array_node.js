/* global describe,it,before*/
require("requirish")._(module);

const assert = require("better-assert");
const UADataType = require("lib/address_space/ua_data_type").UADataType;
const UAObject = require("lib/address_space/ua_object").UAObject;
const UAVariable = require("lib/address_space/ua_variable").UAVariable;
const UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;

const Variant = require("lib/datamodel/variant").Variant;
const VariantArrayType = require("lib/datamodel/variant").VariantArrayType;


const Method = require("lib/address_space/ua_method").Method;
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

const DataType = require("lib/datamodel/variant").DataType;
const AttributeIds = require("lib/services/read_service").AttributeIds;
const AddressSpace = require("lib/address_space/address_space").AddressSpace;
const _ = require("underscore");
const NodeId = require("lib/datamodel/nodeid").NodeId;


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
  assert(typeof options.variableType === "string");
  assert(typeof options.indexPropertyName === "string");

  const addressSpace = parentFolder.addressSpace;

  const complexVariableType = addressSpace.findVariableType(options.complexVariableType);
  assert(!complexVariableType.nodeId.isEmpty());


  const variableType = addressSpace.findVariableType(options.variableType);
  assert(!variableType.nodeId.isEmpty());

  const structure = addressSpace.findDataType("Structure");
  assert(structure,"Structure Type not found: please check your nodeset file");

  const dataType = addressSpace.findDataType(variableType.dataType);
  assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


  const inner_options = {

    componentOf: parentFolder,

    browseName: options.browseName,
    dataType: dataType.nodeId,
    valueRank: 1,
    typeDefinition: complexVariableType.nodeId,
    value: { dataType: DataType.ExtensionObject, value: [], arrayType: VariantArrayType.Array }
  };

  const variable = addressSpace.addVariable(inner_options);

  bindExtObjArrayNode(variable,options.variableType,options.indexPropertyName);

  return variable;
}

exports.createExtObjArrayNode = createExtObjArrayNode;


function bindExtObjArrayNode(arr,variableType,indexPropertyName) {
  assert(arr instanceof UAVariable);
  const addressSpace = arr.addressSpace;


  var variableType = addressSpace.findVariableType(variableType);
  assert(!variableType.nodeId.isEmpty());

  let structure = addressSpace.findDataType("Structure");
  assert(structure,"Structure Type not found: please check your nodeset file");

  let dataType = addressSpace.findDataType(variableType.dataType);
  assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


  arr.$$variableType = variableType;

  structure = addressSpace.findDataType("Structure");
  assert(structure,"Structure Type not found: please check your nodeset file");

    // verify that an object with same doesn't already exist
  dataType = addressSpace.findDataType(variableType.dataType);
  assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

  arr.$$dataType = dataType;

  arr.$$getElementBrowseName = (extObj) => {
        // assert(extObj.constructor === addressSpace.constructExtensionObject(dataType));
    assert(extObj.hasOwnProperty(indexPropertyName));
    return extObj[indexPropertyName].toString();
  };
  return arr;
}
exports.bindExtObjArrayNode = bindExtObjArrayNode;

function addElement(options,arr) {
  const addressSpace = arr.addressSpace;

    // verify that arr has been created correctly
  assert(!!arr.$$variableType && !!arr.$$dataType, "did you create the array Node with createExtObjArrayNode ?");

  const obj =  addressSpace.constructExtensionObject(arr.$$dataType,options);

  const browseName = arr.$$getElementBrowseName(obj);

  const elVar = arr.$$variableType.instantiate({
    componentOf: arr.nodeId,
    browseName,
    value: { dataType: DataType.ExtensionObject, value: obj }
  });
  elVar.bindExtensionObject();

    // also add the value inside
  arr._dataValue.value.value.push(obj);
  return elVar;
}
exports.addElement = addElement;

function removeElement(arr,elementIndex) {
  const addressSpace = arr.addressSpace;
  const _array = arr.readValue().value.value;
  if (_.isNumber(elementIndex)) {
    assert(elementIndex >= 0 && elementIndex < _array.length);
  } else {
        // find element by name
        // var browseNameToFind = arr.$$getElementBrowseName(elementIndex);
    const browseNameToFind = elementIndex.browseName.toString();

    elementIndex = _array.findIndex((obj, i) => {
      const browseName = arr.$$getElementBrowseName(obj);
      return (browseName === browseNameToFind);
    });
    if (elementIndex < 0) {
      throw new Error(` cannot find element matching ${browseNameToFind.toString()}`);
    }
  }
  const extObj = _array[elementIndex];
  const browseName = arr.$$getElementBrowseName(extObj);

    // remove element from global array (inefficient)
  _array.splice(elementIndex,1);

    // remove matching component

  const nodeId = 0;
  const node = arr.getComponentByName(browseName);

  if (!node) {
    throw new Error(" cannot find component ");
  }

  addressSpace.deleteNode(node.nodeId);
}
exports.removeElement = removeElement;
