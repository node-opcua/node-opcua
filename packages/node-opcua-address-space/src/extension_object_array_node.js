"use strict";
/* global describe,it,before*/

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const Variant = require("node-opcua-variant").Variant;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const DataType = require("node-opcua-variant").DataType;

const StatusCodes = require("node-opcua-status-code").StatusCodes;


const BaseNode = require("./base_node").BaseNode;
const UADataType = require("./ua_data_type").UADataType;
const UAObject = require("./ua_object").UAObject;
const UAVariable = require("./ua_variable").UAVariable;

const AddressSpace = require("./address_space").AddressSpace;

const hasConstructor = require("node-opcua-factory").hasConstructor;
const getConstructor = require("node-opcua-factory").getConstructor;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;

function makeStructure(dataType,bForce) {

    bForce = !!bForce;

    assert(dataType instanceof UADataType);

    const addressSpace = dataType.addressSpace;
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
    const namespaceUri = addressSpace.getNamespaceUri(dataType.nodeId.namespace);
    return buildConstructorFromDefinition(addressSpace,dataType);
}

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;

function _extensionobject_construct(options) {

    options = options || {};
    const dataType = this.constructor.dataType;
    const obj = this;

    for (const field of dataType.definition) {
        const fieldName =  field.$$name$$;
        obj[fieldName] = field.$$initialize$$(options[fieldName]);
    }
}
function initialize_Structure(field,options) {
    return new field.$$Constructor$$(options);
}

const util = require("util");
const _defaultTypeMap = require("node-opcua-factory/src/factories_builtin_types")._defaultTypeMap;
const ec = require("node-opcua-basic-types");
const encodeArray = ec.encodeArray;
const decodeArray = ec.decodeArray;

global._extensionobject_construct = _extensionobject_construct;

function _extensionobject_encode(stream) {

    BaseUAObject.prototype.encode.call(this,stream);
    const definition = this.constructor.dataType.definition;
    for(const field of definition) {
        const fieldName = field.$$name$$;
        field.$$func_encode$$.call(this[fieldName],stream);
    }
}

function struct_encode(stream) {
    this.encode(stream);
}
function struct_decode(stream) {
    this.decode(stream);
    return this;
}

function _extensionobject_decode(stream) {
    const definition = this.constructor.definition;
    assert(definition,"expected a definition for this class ");
    for(const field of definition) {
        const fieldName = field.$$name$$;
        this[fieldName] = field.$$func_decode$$.call(this[fieldName],stream);
    }
}

const getEnumeration = require("node-opcua-factory").getEnumeration;
const findBuiltInType  = require("node-opcua-factory").findBuiltInType;
/*
exports.registerBasicType = require("./src/factories_basic_type").registerBasicType;
exports.findSimpleType = require("./src/factories_builtin_types").findSimpleType;
exports.findBuiltInType  = require("./src/factories_builtin_types").findBuiltInType;
exports.registerBuiltInType = require("./src/factories_builtin_types").registerType;
*/
const BaseUAObject = require("node-opcua-factory").BaseUAObject;
const schema_helpers =  require("node-opcua-factory/src/factories_schema_helpers");

function initialize_array(func,options){
    options= options|| [];
    const result = options.map(function(element) {
        return func(element);
    });
    return result;
}

function encode_array(fun_encode_element,arr,stream) {
    stream.writeUInt32(arr.length);
    for (const el of arr) {
        fun_encode_element(el,stream);
    }
}
function decode_array(fun_decode_element,arr,stream) {
    const n = stream.readUInt32();
    if (n===0xFFFFFFFF) {
        return null;
    }
    const result =[];
    for (let i =0;i<n;i++) {
        result.push(fun_decode_element(stream));
    }
    return result;
}

function buildConstructorFromDefinition(addressSpace,dataType) {

    assert(dataType.definition && _.isArray(dataType.definition));
    const enumeration = addressSpace.findDataType("Enumeration");

    const className = dataType.browseName.name.replace("DataType","");

    assert(enumeration,"Enumeration Type not found: please check your nodeset file");
    const structure = addressSpace.findDataType("Structure");
    assert(structure,"Structure Type not found: please check your nodeset file");

    const Constructor  =new Function("options","_extensionobject_construct.apply(this,arguments);");
    assert(_.isFunction(Constructor));
    Object.defineProperty(Constructor, "name", { value: className });

    Constructor.definition = dataType.definition;
    Constructor.dataType = dataType;
    util.inherits(Constructor, BaseUAObject);
    Constructor.prototype.encode = _extensionobject_encode;
    Constructor.prototype.decode = _extensionobject_decode;


    for (const field of dataType.definition) {

        if (field.valueRank === 1) {
            field.$$name$$ = lowerFirstLetter(field.name.replace("ListOf",""));
        } else {
            field.$$name$$ = lowerFirstLetter(field.name);
        }
        const dataTypeId = resolveNodeId(field.dataType);
        const fieldDataType = addressSpace.findNode(dataTypeId);

        if (!fieldDataType) {
            throw new Error(" cannot find description for object " + dataTypeId +
                ". Check that this node exists in the nodeset.xml file");
        }
        // check if  dataType is an enumeration or a structure or  a basic type
        field.$$dataTypeId$$ = dataTypeId;
        field.$$dataType$$ = fieldDataType;
        field.$$isEnum$$ = false;
        field.$$isStructure$$ = false;
        if (fieldDataType.isSupertypeOf(enumeration)) {
            field.$$isEnum$$ = true;
            makeEnumeration(fieldDataType);
        } else if (fieldDataType.isSupertypeOf(structure)) {
            field.$$isStructure$$ = true;
            const FieldConstructor = makeStructure(fieldDataType);
            assert(_.isFunction(FieldConstructor));
            //xx field
            field.$$func_encode$$ = struct_encode;
            field.$$func_decode$$ = struct_decode;
            field.$$Constructor$$ = FieldConstructor;
            field.$$initialize$$  = initialize_Structure.bind(null,field);
        } else {
            const stuff = findBuiltInType(fieldDataType.browseName.name);
            field.$$func_encode$$ = stuff.encode;
            field.$$func_decode$$ = stuff.decode;
            assert(_.isFunction(field.$$func_encode$$));
            assert(_.isFunction(field.$$func_decode$$));
            field.schema = stuff;
            field.$$initialize$$ = schema_helpers.initialize_field.bind(null,field);
        }
        if (field.valueRank === 1) {
            field.$$initialize$$  = initialize_array.bind(null,field.$$initialize$$);
            field.$$func_encode$$ = encode_array.bind(null,field.$$func_encode$$);
            field.$$func_decode$$ = decode_array.bind(null,field.$$func_decode$$);

        }
    }

    // reconstruct _schema form
    const fields = [];
    for (const field of dataType.definition) {
        const data = {
            name: field.$$name$$,
            fieldType: field.$$dataType$$.browseName.name,
            isArray: (field.valueRank === 1)
        };
        if (field.$$isEnum$$) {
            data.category = "enumeration";
        } else if (field.$$isStructure$$) {
            data.category = "complex";
            data.fieldTypeConstructor = field.$$Constructor$$;
        } else {
            data.category = "basic"
        }
        fields.push(data);
    }

    Constructor.prototype._schema = {
        name: className,
        id: -1,
        fields: fields
    };


    return Constructor;
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

    const addressSpace = parentFolder.addressSpace;

    const complexVariableType = addressSpace.findVariableType(options.complexVariableType);
    assert(!complexVariableType.nodeId.isEmpty());


    const variableType = addressSpace.findVariableType(options.variableType);
    assert(!variableType.nodeId.isEmpty());

    const structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    const dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");


    const inner_options = {

        componentOf: parentFolder,

        browseName: options.browseName,
        dataType: dataType.nodeId,
        valueRank: 1,
        typeDefinition: complexVariableType.nodeId,
        value: {dataType: DataType.ExtensionObject, value: [], arrayType: VariantArrayType.Array}
    };

    const uaArrayVariableNode = addressSpace.addVariable(inner_options);
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
 * @method bindExtObjArrayNode
 * @param uaArrayVariableNode {UAVariable}
 * @param variableType        {DataType}
 * @param indexPropertyName   {String}
 * @return {UAVariable}
 */
function bindExtObjArrayNode(uaArrayVariableNode, variableType, indexPropertyName) {

    assert(uaArrayVariableNode instanceof UAVariable);
    assert(variableType);

    const addressSpace = uaArrayVariableNode.addressSpace;

    variableType = addressSpace.findVariableType(variableType);
    if (!variableType) {
        throw new Error("Cannot find VariableType " + variableType.toString());
    }
    assert(!variableType.nodeId.isEmpty());

    let structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    let dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

    assert(!uaArrayVariableNode.$$variableType ,"uaArrayVariableNode has already been bound !");

    uaArrayVariableNode.$$variableType = variableType;

    structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    // verify that an object with same doesn't already exist
    dataType = addressSpace.findDataType(variableType.dataType);
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

    uaArrayVariableNode.$$dataType             = dataType;
    uaArrayVariableNode.$$extensionObjectArray = [];
    uaArrayVariableNode.$$indexPropertyName    = indexPropertyName;

    prepareDataType(dataType);

    uaArrayVariableNode.$$getElementBrowseName = function (extObj) {

        const indexPropertyName = this.$$indexPropertyName;

        if (!extObj.hasOwnProperty(indexPropertyName)) {
            console.log(" extension object do not have ", indexPropertyName, extObj);
        }
        //assert(extObj.constructor === addressSpace.constructExtensionObject(dataType));
        assert(extObj.hasOwnProperty(indexPropertyName));
        const browseName = extObj[indexPropertyName].toString();
        return browseName;
    };

    const options = {
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
 * add a new element in a ExtensionObject Array variable
 * @param options {Object}   data used to construct the underlying ExtensionObject
 * @param uaArrayVariableNode {UAVariable}
 * @return {UAVariable}
 *
 * @method addElement
 * add a new element in a ExtensionObject Array variable
 * @param nodeVariable {UAVariable}   a variable already exposing an extension objects
 * @param uaArrayVariableNode {UAVariable}
 * @return {UAVariable}
 *
 * @method addElement
 * add a new element in a ExtensionObject Array variable
 * @param constructor {Function}  constructor of the extension object to create
 * @param uaArrayVariableNode {UAVariable}
 * @return {UAVariable}
 */

function addElement(options, uaArrayVariableNode) {

    assert(uaArrayVariableNode," must provide an UAVariable containing the array");
    assert(uaArrayVariableNode instanceof UAVariable,"expecting a UAVariable node here");
    // verify that arr has been created correctly
    assert(!!uaArrayVariableNode.$$variableType && !!uaArrayVariableNode.$$dataType,
            "did you create the array Node with createExtObjArrayNode ?");
    assert(uaArrayVariableNode.$$dataType instanceof UADataType);
    assert(uaArrayVariableNode.$$dataType._extensionObjectConstructor instanceof Function);

    const checkValue = uaArrayVariableNode.readValue();
    assert(checkValue.statusCode === StatusCodes.Good);
    assert(checkValue.value.dataType === DataType.ExtensionObject);

    const addressSpace = uaArrayVariableNode.addressSpace;

    let extensionObject = null;
    let elVar = null;
    let browseName;

    if (options instanceof UAVariable) {
        elVar = options;
        extensionObject = elVar.$extensionObject; // get shared extension object
        assert(extensionObject instanceof uaArrayVariableNode.$$dataType._extensionObjectConstructor,
            "the provided variable must expose a Extension Object of the expected type ");
        // add a reference
        uaArrayVariableNode.addReference({referenceType: "HasComponent", isFoward: true, nodeId: elVar.nodeId});
        //xx elVar.bindExtensionObject();

    } else {
        if (options instanceof uaArrayVariableNode.$$dataType._extensionObjectConstructor) {
            // extension object has already been created
            extensionObject = options;
        } else {
            extensionObject = addressSpace.constructExtensionObject(uaArrayVariableNode.$$dataType, options);
        }
        browseName = uaArrayVariableNode.$$getElementBrowseName(extensionObject);
        elVar = uaArrayVariableNode.$$variableType.instantiate({
            componentOf: uaArrayVariableNode.nodeId,
            browseName: browseName,
            value: {dataType: DataType.ExtensionObject, value: extensionObject}
        });
        elVar.bindExtensionObject();
        elVar.$extensionObject = extensionObject;
    }

    // also add the value inside
    uaArrayVariableNode.$$extensionObjectArray.push(extensionObject);

    return elVar;
}
exports.addElement = addElement;

function removeElementByIndex(uaArrayVariableNode, elementIndex) {

    const _array = uaArrayVariableNode.$$extensionObjectArray;

    assert(_.isNumber(elementIndex));

    const addressSpace = uaArrayVariableNode.addressSpace;
    const extObj = _array[elementIndex];
    const browseName = uaArrayVariableNode.$$getElementBrowseName(extObj);

    // remove element from global array (inefficient)
    uaArrayVariableNode.$$extensionObjectArray.splice(elementIndex, 1);

    // remove matching component
    const node = uaArrayVariableNode.getComponentByName(browseName);
    if (!node) {
        throw new Error(" cannot find component ");
    }

    // remove the hasComponent reference toward node
    uaArrayVariableNode.removeReference({referenceType: "HasComponent", isFoward: true, nodeId: node.nodeId});

    // now check if node has still some parent
    const parents = node.findReferencesEx("HasChild",BrowseDirection.Inverse);
    if (parents.length ===0){
        addressSpace.deleteNode(node.nodeId);
    }
}

/**
 *
 * @method removeElement
 * @param uaArrayVariableNode {UAVariable}
 * @param elementIndex {number}   index of element to remove in array
 *
 *
 * @method removeElement
 * @param uaArrayVariableNode {UAVariable}
 * @param element {UAVariable}   node of element to remove in array
 */
function removeElement(uaArrayVariableNode, element) {

    assert(element,"element must exist");
    const _array = uaArrayVariableNode.$$extensionObjectArray;
    if (_array.length === 0) {
        throw new Error(" cannot remove an element from an empty array ");
    }
    let elementIndex = -1;
    if (_.isNumber(element)) {
        elementIndex = element;
        assert(elementIndex >= 0 && elementIndex < _array.length);
    } else if (element instanceof BaseNode ) {
        // find element by name
        const browseNameToFind = element.browseName.toString();
        elementIndex = _array.findIndex(function (obj, i) {
            const browseName = uaArrayVariableNode.$$getElementBrowseName(obj).toString();
            return (browseName === browseNameToFind);
        });

    } else if (_.isFunction(element)) {
        elementIndex = _array.findIndex(element);
    }else{
        assert(_array[0].constructor.name === element.constructor.name,"element must match");
        elementIndex = _array.findIndex(function(x) { return x === element });
    }
    if (elementIndex < 0) {
        throw new Error(" cannot find element matching " + element.toString());
    }
    return removeElementByIndex(uaArrayVariableNode, elementIndex);
}
exports.removeElement = removeElement;


