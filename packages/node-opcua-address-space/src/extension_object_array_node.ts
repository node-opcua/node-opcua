/**
 * @module node-opcua-address-space.Private
 */
import { assert } from "node-opcua-assert";
import * as _ from "underscore";
import * as util from "util";

import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { BrowseDirection, NodeClass, QualifiedName } from "node-opcua-data-model";
import {checkDebugFlag, make_debugLog} from "node-opcua-debug";
import {
    BaseUAObject, FieldCategory,
    findBuiltInType,
    initialize_field
} from "node-opcua-factory";
import { DataTypeFactory } from "node-opcua-factory";
// import {     getEnumeration,getConstructor, hasConstructor } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { lowerFirstLetter } from "node-opcua-utils";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { ExtensionObject } from "node-opcua-extension-object";
import {
    AddressSpace,
    UADynamicVariableArray,
    UAObject,
    UAReferenceType,
    UAVariable as UAVariablePublic} from "../source/address_space_ts";

import { AddressSpacePrivate } from "./address_space_private";
import { UADataType } from "./ua_data_type";
import { UAVariable } from "./ua_variable";
import {PseudoSession} from "../source";
import {getDataTypeDefinition} from "node-opcua-client-dynamic-extension-object";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

function makeStructure(
    dataTypeFactory: DataTypeFactory,
    dataType: UADataType,
    bForce?: boolean
): any {

    bForce = !!bForce;
    const addressSpace = dataType.addressSpace;

    // istanbul ignore next
    if (!dataType.binaryEncodingNodeId) {
        throw new Error("DataType with name " + dataType.browseName.toString() +
          " has no binaryEncoding node\nplease check your nodeset file");
    }

    // if binaryEncodingNodeId is in the standard factory => no need to overwrite
    if (!bForce && (dataTypeFactory.hasConstructor(dataType.binaryEncodingNodeId) || dataType.binaryEncodingNodeId.namespace === 0)) {
        return dataTypeFactory.getConstructor(dataType.binaryEncodingNodeId);
    }

    // istanbul ignore next
    if (doDebug) {
        debugLog("buildConstructorFromDefinition => ", dataType.browseName.toString());
    }
    // etc ..... please fix me
    const namespaceUri = addressSpace.getNamespaceUri(dataType.nodeId.namespace);
    return buildConstructorFromDefinition(addressSpace, dataType);
}

function _extensionobject_construct(this: any, options: any): void {

    options = options || {};
    const dataType = this.constructor.dataType;
    const obj = this;

    for (const field of dataType.definition) {
        const fieldName = field.$$name$$;
        obj[fieldName] = field.$$initialize$$(options[fieldName]);
    }
}

(global as any)._extensionobject_construct = _extensionobject_construct;

function initialize_Structure(field: any, options: any): any {
    return new field.$$Constructor$$(options);
}

function _extensionobject_encode(this: any, stream: OutputBinaryStream) {

    BaseUAObject.prototype.encode.call(this, stream);
    const definition = this.constructor.dataType.definition;
    for (const field of definition) {
        const fieldName = field.$$name$$;
        field.$$func_encode$$.call(this[fieldName], stream);
    }
}

function struct_encode(this: any, stream: OutputBinaryStream) {
    this.encode(stream);
}

function struct_decode(this: any, stream: BinaryStream) {
    this.decode(stream);
    return this;
}

function _extensionobject_decode(this: any, stream: BinaryStream) {
    const definition = this.constructor.definition;
    assert(definition, "expected a definition for this class ");
    for (const field of definition) {
        const fieldName = field.$$name$$;
        this[fieldName] = field.$$func_decode$$.call(this[fieldName], stream);
    }
}

function initialize_array(func: any, options: any[]) {
    options = options || [];
    const result = options.map((element: any) => func(element));
    return result;
}

function encode_array(
  fun_encode_element: (el: any, stream: OutputBinaryStream) => void,
  arr: any[],
  stream: BinaryStream
) {
    stream.writeUInt32(arr.length);
    for (const el of arr) {
        fun_encode_element(el, stream);
    }
}

function decode_array(
  fun_decode_element: (stream: BinaryStream) => any,
  arr: any[],
  stream: BinaryStream
): any[] | null {
    const n = stream.readUInt32();
    if (n === 0xFFFFFFFF) {
        return null;
    }
    const result = [];
    for (let i = 0; i < n; i++) {
        result.push(fun_decode_element(stream));
    }
    return result;
}

function buildConstructorFromDefinition(
  addressSpace: AddressSpace,
  dataType: UADataType
) {

    if (doDebug) {
        debugLog("buildConstructorFromDefinition nodeId=", dataType.nodeId.toString(), dataType.browseName.toString());
    }

    const extraDataTypeManager = (addressSpace as AddressSpacePrivate).getDataTypeManager();
    const dataTypeFactory = extraDataTypeManager.getDataTypeFactory(dataType.nodeId.namespace);

    assert(dataType.definition && _.isArray(dataType.definition));
    const enumeration = addressSpace.findDataType("Enumeration");

    const className = dataType.browseName.name!.replace("DataType", "");

    assert(enumeration, "Enumeration Type not found: please check your nodeset file");
    const structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    const Constructor = new Function("options", "_extensionobject_construct.apply(this,arguments);");
    assert(_.isFunction(Constructor));
    Object.defineProperty(Constructor, "name", { value: className });

    (Constructor as any).definition = dataType.definition;
    (Constructor as any).dataType = dataType;
    util.inherits(Constructor, ExtensionObject);
    Constructor.prototype.encode = _extensionobject_encode;
    Constructor.prototype.decode = _extensionobject_decode;

    for (const field of dataType.definition) {

        if (field.valueRank === 1) {
            field.$$name$$ = lowerFirstLetter(field.name.replace("ListOf", ""));
        } else {
            field.$$name$$ = lowerFirstLetter(field.name);
        }
        const dataTypeId = resolveNodeId(field.dataType);
        const fieldDataType = addressSpace.findDataType(dataTypeId) as UADataType;
        if (!fieldDataType) {
            debugLog(field);
            throw new Error(" cannot find description for object " + dataTypeId +
              " => " + field.dataType + ". Check that this node exists in the nodeset.xml file");
        }
        // check if  dataType is an enumeration or a structure or  a basic type
        field.$$dataTypeId$$ = dataTypeId;
        field.$$dataType$$ = fieldDataType;
        field.$$isEnum$$ = false;
        field.$$isStructure$$ = false;
        if (fieldDataType.isSupertypeOf(enumeration as any)) {
            field.$$isEnum$$ = true;
            // todo repair
            // makeEnumeration(fieldDataType);
        } else if (fieldDataType.isSupertypeOf(structure as any)) {
            field.$$isStructure$$ = true;
            const FieldConstructor = makeStructure(dataTypeFactory, fieldDataType);
            assert(_.isFunction(FieldConstructor));
            // xx field
            field.$$func_encode$$ = struct_encode;
            field.$$func_decode$$ = struct_decode;
            field.$$Constructor$$ = FieldConstructor;
            field.$$initialize$$ = initialize_Structure.bind(null, field);
        } else {
            const stuff = findBuiltInType(fieldDataType.browseName.name);
            field.$$func_encode$$ = stuff.encode;
            field.$$func_decode$$ = stuff.decode;
            assert(_.isFunction(field.$$func_encode$$));
            assert(_.isFunction(field.$$func_decode$$));
            field.schema = stuff;
            field.$$initialize$$ = initialize_field.bind(null, field);
        }
        if (field.valueRank === 1) {
            field.$$initialize$$ = initialize_array.bind(null, field.$$initialize$$);
            field.$$func_encode$$ = encode_array.bind(null, field.$$func_encode$$);
            field.$$func_decode$$ = decode_array.bind(null, field.$$func_decode$$);
        }
    }

    // reconstruct _schema form
    const fields = [];
    for (const field of dataType.definition) {
        const data: any = {
            fieldType: field.$$dataType$$.browseName.name,
            isArray: (field.valueRank === 1),
            name: field.$$name$$
        };
        if (field.$$isEnum$$) {
            data.category = FieldCategory.enumeration;
        } else if (field.$$isStructure$$) {
            data.category = FieldCategory.complex;
            data.fieldTypeConstructor = field.$$Constructor$$;
        } else {
            data.category = FieldCategory.basic;
        }
        fields.push(data);
    }

    Constructor.prototype.schema = {
        fields,
        id: -1,
        name: className
    };
    return Constructor;
}

/*
 * define a complex Variable containing a array of extension objects
 * each element of the array is also accessible as a component variable.
 *
 */

function getExtObjArrayNodeValue(
  this: any
) {
    return new Variant({
        arrayType: VariantArrayType.Array,
        dataType: DataType.ExtensionObject,
        value: this.$$extensionObjectArray
    });
}

function removeElementByIndex<T extends ExtensionObject>(
  uaArrayVariableNode: UADynamicVariableArray<T>,
  elementIndex: number
) {

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

    const hasComponent =
      uaArrayVariableNode.addressSpace.findReferenceType("HasComponent")! as UAReferenceType;

    // remove the hasComponent reference toward node
    uaArrayVariableNode.removeReference({
        isForward: true,
        nodeId: node.nodeId,
        referenceType: hasComponent.nodeId
    });

    // now check if node has still some parent
    const parents = node.findReferencesEx("HasChild", BrowseDirection.Inverse);
    if (parents.length === 0) {
        addressSpace.deleteNode(node.nodeId);
    }
}

/**
 * @method prepareDataType
 * @private
 * @param dataType
 */
export function prepareDataType(
    addressSpace: AddressSpace,
    dataType: UADataType
): void {

    assert(dataType._extensionObjectConstructor, "please call await prepareDataType2")
}
/**
 *
 * create a node Variable that contains a array of ExtensionObject of a given type
 * @method createExtObjArrayNode
 * @param parentFolder
 * @param options
 * @param options.browseName
 * @param options.complexVariableType
 * @param options.variableType        the type of Extension objects stored in the array.
 * @param options.indexPropertyName
 * @return {Object|UAVariable}
 */
export function createExtObjArrayNode<T extends ExtensionObject>(
  parentFolder: UAObject,
  options: any
): UADynamicVariableArray<T> {

    assert(typeof options.variableType === "string");
    assert(typeof options.indexPropertyName === "string");

    const addressSpace = parentFolder.addressSpace;
    const namespace = parentFolder.namespace;

    const complexVariableType = addressSpace.findVariableType(options.complexVariableType);
    if (!complexVariableType) {
        throw new Error("cannot find complex variable type");
    }
    assert(!complexVariableType.nodeId.isEmpty());

    const variableType = addressSpace.findVariableType(options.variableType);
    if (!variableType) {
        throw new Error("cannot find variable Type");
    }
    assert(!variableType.nodeId.isEmpty());

    const structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    const dataType = addressSpace.findDataType(variableType.dataType);
    if (!dataType) {
        throw new Error("cannot find Data Type");
    }

    assert(dataType.isSupertypeOf(structure as any), "expecting a structure (= ExtensionObject) here ");

    const inner_options = {

        componentOf: parentFolder,

        browseName: options.browseName,
        dataType: dataType.nodeId,
        typeDefinition: complexVariableType.nodeId,
        value: { dataType: DataType.ExtensionObject, value: [], arrayType: VariantArrayType.Array },
        valueRank: 1
    };

    const uaArrayVariableNode = namespace.addVariable(inner_options) as UADynamicVariableArray<T>;

    bindExtObjArrayNode(
      uaArrayVariableNode,
      options.variableType,
      options.indexPropertyName);

    return uaArrayVariableNode;

}

/**
 * @method bindExtObjArrayNode
 * @param uaArrayVariableNode
 * @param variableTypeNodeId
 * @param indexPropertyName
 * @return
 */
export function bindExtObjArrayNode<T extends ExtensionObject>(
  uaArrayVariableNode: UADynamicVariableArray<T>,
  variableTypeNodeId: string | NodeId,
  indexPropertyName: string
): UAVariablePublic {

    const addressSpace = uaArrayVariableNode.addressSpace;

    const variableType = addressSpace.findVariableType(variableTypeNodeId);
    if (!variableType) {
        throw new Error("Cannot find VariableType " + variableTypeNodeId.toString());
    }
    assert(!variableType.nodeId.isEmpty());

    let structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    let dataType = addressSpace.findDataType(variableType.dataType);
    if (!dataType) {
        throw new Error("Cannot find DataType " + variableType.dataType.toString());
    }
    assert(dataType.isSupertypeOf(structure as any), "expecting a structure (= ExtensionObject) here ");

    assert(!uaArrayVariableNode.$$variableType, "uaArrayVariableNode has already been bound !");

    uaArrayVariableNode.$$variableType = variableType;

    structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    // verify that an object with same doesn't already exist
    dataType = addressSpace.findDataType(variableType.dataType)! as UADataType;
    assert(dataType.isSupertypeOf(structure as any), "expecting a structure (= ExtensionObject) here ");

    uaArrayVariableNode.$$dataType = dataType as UADataType;
    uaArrayVariableNode.$$extensionObjectArray = [];
    uaArrayVariableNode.$$indexPropertyName = indexPropertyName;

    prepareDataType(addressSpace, dataType as UADataType);

    uaArrayVariableNode.$$getElementBrowseName = function(this: any, extObj: ExtensionObject) {

        const indexPropertyName1 = this.$$indexPropertyName;

        if (!extObj.hasOwnProperty(indexPropertyName1)) {
            console.log(" extension object do not have ", indexPropertyName1, extObj);
        }
        // assert(extObj.constructor === addressSpace.constructExtensionObject(dataType));
        assert(extObj.hasOwnProperty(indexPropertyName1));
        const browseName = (extObj as any)[indexPropertyName1].toString();
        return browseName;
    };

    const options = {
        get: getExtObjArrayNodeValue,
        set: undefined // readonly
    };

    // bind the readonly
    uaArrayVariableNode.bindVariable(options, true);

    return uaArrayVariableNode;
}

/**
 * @method addElement
 * add a new element in a ExtensionObject Array variable
 * @param options {Object}   data used to construct the underlying ExtensionObject
 * @param uaArrayVariableNode {UAVariable}
 * @return {UAVariable}
 *
 * @method addElement
 * add a new element in a ExtensionObject Array variable
 * @param nodeVariable a variable already exposing an extension objects
 * @param uaArrayVariableNode {UAVariable}
 * @return {UAVariable}
 *
 * @method addElement
 * add a new element in a ExtensionObject Array variable
 * @param constructor  constructor of the extension object to create
 * @param uaArrayVariableNode {UAVariable}
 * @return {UAVariable}
 */
export function addElement<T extends ExtensionObject>(
  options: any /* ExtensionObjectConstructor | ExtensionObject | UAVariable*/,
  uaArrayVariableNode: UADynamicVariableArray<T>
): UAVariable {

    assert(uaArrayVariableNode, " must provide an UAVariable containing the array");
     // verify that arr has been created correctly
    assert(!!uaArrayVariableNode.$$variableType && !!uaArrayVariableNode.$$dataType,
      "did you create the array Node with createExtObjArrayNode ?");
    assert(uaArrayVariableNode.$$dataType.nodeClass === NodeClass.DataType);
    assert((uaArrayVariableNode.$$dataType as UADataType)._extensionObjectConstructor instanceof Function);

    const addressSpace = uaArrayVariableNode.addressSpace;

    let extensionObject: T;
    let elVar = null;
    let browseName;

    if (options instanceof UAVariable) {
        elVar = options;
        extensionObject = elVar.$extensionObject; // get shared extension object
        assert(extensionObject instanceof (uaArrayVariableNode.$$dataType as UADataType)._extensionObjectConstructor,
          "the provided variable must expose a Extension Object of the expected type ");
        // add a reference
        uaArrayVariableNode.addReference({
            isForward: true,
            nodeId: elVar.nodeId,
            referenceType: "HasComponent"
        });
        // xx elVar.bindExtensionObject();

    } else {
        if (options instanceof (uaArrayVariableNode.$$dataType as UADataType)._extensionObjectConstructor) {
            // extension object has already been created
            extensionObject = options as T;
        } else {
            extensionObject = addressSpace.constructExtensionObject(uaArrayVariableNode.$$dataType, options) as T;
        }
        browseName = uaArrayVariableNode.$$getElementBrowseName(extensionObject);
        elVar = uaArrayVariableNode.$$variableType.instantiate({
            browseName,
            componentOf: uaArrayVariableNode.nodeId,
            value: { dataType: DataType.ExtensionObject, value: extensionObject }
        }) as UAVariable;
        elVar.bindExtensionObject();
        elVar.$extensionObject = extensionObject;
    }

    // also add the value inside
    uaArrayVariableNode.$$extensionObjectArray.push(extensionObject);

    return elVar;
}

/**
 *
 * @method removeElement
 * @param uaArrayVariableNode {UAVariable}
 * @param element {number}   index of element to remove in array
 *
 *
 * @method removeElement
 * @param uaArrayVariableNode {UAVariable}
 * @param element {UAVariable}   node of element to remove in array
 *
 * @method removeElement
 * @param uaArrayVariableNode {UAVariable}
 * @param element {ExtensionObject}   extension object of the node of element to remove in array
 *
 */
export function removeElement<T extends ExtensionObject>(
  uaArrayVariableNode: UADynamicVariableArray<T>,
  element: any /* number | UAVariable | (a any) => boolean | ExtensionObject */
): void {

    assert(element, "element must exist");
    const _array = uaArrayVariableNode.$$extensionObjectArray;
    if (_array.length === 0) {
        throw new Error(" cannot remove an element from an empty array ");
    }
    let elementIndex = -1;

    if (_.isNumber(element)) {

        // find element by index
        elementIndex = element;
        assert(elementIndex >= 0 && elementIndex < _array.length);

    } else if (element && element.nodeClass ) {

        // find element by name
        const browseNameToFind = element.browseName.name!.toString();
        elementIndex = _array.findIndex((obj: any, i: number) => {
            const browseName = uaArrayVariableNode.$$getElementBrowseName(obj).toString();
            return (browseName === browseNameToFind);
        });

    } else if (_.isFunction(element)) {

        // find element by functor
        elementIndex = _array.findIndex(element);

    } else {

        // find element by inner extension object
        assert(_array[0].constructor.name === (element as any).constructor.name, "element must match");
        elementIndex = _array.findIndex((x: any) => x === element);
    }
    if (elementIndex < 0) {
        throw new Error(" cannot find element matching " + element.toString());
    }
    return removeElementByIndex(uaArrayVariableNode, elementIndex);
}
