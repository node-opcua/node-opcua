/**
 * @module node-opcua-address-space.Private
 */
import { assert } from "node-opcua-assert";

import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { ExtensionObject } from "node-opcua-extension-object";
import { UADataType, UADynamicVariableArray, UAObject, UAReferenceType, UAVariable } from "node-opcua-address-space-base";
import { UAVariableImpl } from "./ua_variable_impl";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
/*
 * define a complex Variable containing a array of extension objects
 * each element of the array is also accessible as a component variable.
 *
 */

function getExtObjArrayNodeValue<T  extends ExtensionObject>(this: UADynamicVariableArray<T>) {
    return new Variant({
        arrayType: VariantArrayType.Array,
        dataType: DataType.ExtensionObject,
        value: this.$$extensionObjectArray
    });
}

function removeElementByIndex<T extends ExtensionObject>(uaArrayVariableNode: UADynamicVariableArray<T>, elementIndex: number) {
    const _array = uaArrayVariableNode.$$extensionObjectArray;

    assert(typeof elementIndex === "number");

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

    const hasComponent = uaArrayVariableNode.addressSpace.findReferenceType("HasComponent")! as UAReferenceType;

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
export function createExtObjArrayNode<T extends ExtensionObject>(parentFolder: UAObject, options: any): UADynamicVariableArray<T> {
    assert(typeof options.variableType === "string");
    assert(typeof options.indexPropertyName === "string");

    const addressSpace = parentFolder.addressSpace;
    const namespace = parentFolder.namespace;

    const complexVariableType = addressSpace.findVariableType(options.complexVariableType);
    // istanbul ignore next
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

    // istanbul ignore next
    if (!dataType) {
        errorLog(variableType.toString());
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

    bindExtObjArrayNode(uaArrayVariableNode, options.variableType, options.indexPropertyName);

    return uaArrayVariableNode;
}
function _getElementBrowseName<T extends ExtensionObject>(this: UADynamicVariableArray<T>, extObj: ExtensionObject) {
    const indexPropertyName1 = this.$$indexPropertyName;

    if (!Object.prototype.hasOwnProperty.call(extObj, indexPropertyName1)) {
        console.log(" extension object do not have ", indexPropertyName1, extObj);
    }
    // assert(extObj.constructor === addressSpace.constructExtensionObject(dataType));
    assert(Object.prototype.hasOwnProperty.call(extObj, indexPropertyName1));
    const browseName = (extObj as any)[indexPropertyName1].toString();
    return browseName;
};
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
): UAVariable {

    assert(uaArrayVariableNode.valueRank === 1, "expecting a one dimension array");

    const addressSpace = uaArrayVariableNode.addressSpace;

    const variableType = addressSpace.findVariableType(variableTypeNodeId);
    
    // istanbul ignore next
    if (!variableType || variableType.nodeId.isEmpty()) {
        throw new Error("Cannot find VariableType " + variableTypeNodeId.toString());
    }

    const structure = addressSpace.findDataType("Structure");

    // istanbul ignore next
    if (!structure) {
        throw new Error("Structure Type not found: please check your nodeset file");
    }

    let dataType = addressSpace.findDataType(variableType.dataType);
    
    // istanbul ignore next
    if (!dataType) {
        throw new Error("Cannot find DataType " + variableType.dataType.toString());
    }
    
    assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

    assert(!uaArrayVariableNode.$$variableType, "uaArrayVariableNode has already been bound !");

    uaArrayVariableNode.$$variableType = variableType;

    // verify that an object with same doesn't already exist
    dataType = addressSpace.findDataType(variableType.dataType)! as UADataType;
    assert(dataType!.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

    uaArrayVariableNode.$$dataType = dataType;
    uaArrayVariableNode.$$extensionObjectArray = [];
    uaArrayVariableNode.$$indexPropertyName = indexPropertyName;

    uaArrayVariableNode.$$getElementBrowseName = _getElementBrowseName;

    const bindOptions: any = {
        get: getExtObjArrayNodeValue,
        set: undefined // readonly
    };
    // bind the readonly
    uaArrayVariableNode.bindVariable(bindOptions, true);

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
    assert(
        !!uaArrayVariableNode.$$variableType && !!uaArrayVariableNode.$$dataType,
        "did you create the array Node with createExtObjArrayNode ?"
    );
    assert(uaArrayVariableNode.$$dataType.nodeClass === NodeClass.DataType);

    const addressSpace = uaArrayVariableNode.addressSpace;
    const Constructor = addressSpace.getExtensionObjectConstructor(uaArrayVariableNode.$$dataType);
    assert(Constructor instanceof Function);

    let extensionObject: T;
    let elVar = null;
    let browseName;

    if (options instanceof UAVariableImpl) {
        elVar = options;
        extensionObject = elVar.$extensionObject; // get shared extension object

        assert(
            extensionObject instanceof Constructor,
            "the provided variable must expose a Extension Object of the expected type "
        );
        // add a reference
        uaArrayVariableNode.addReference({
            isForward: true,
            nodeId: elVar.nodeId,
            referenceType: "HasComponent"
        });
        // xx elVar.bindExtensionObject();
    } else {
        if (options instanceof Constructor) {
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
        }) as UAVariableImpl;
        elVar.bindExtensionObject(extensionObject,  { force: true });
        elVar.$extensionObject = extensionObject;
    }

    // also add the value inside
    uaArrayVariableNode.$$extensionObjectArray.push(elVar.$extensionObject);

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
    assert(element, "removeElement: element must exist");
    const _array = uaArrayVariableNode.$$extensionObjectArray;

    // istanbul ignore next
    if (_array.length === 0) {
        throw new Error(" cannot remove an element from an empty array ");
    }
    
    let elementIndex = -1;

    if (typeof element === "number") {
        // find element by index
        elementIndex = element;
        assert(elementIndex >= 0 && elementIndex < _array.length);
    } else if (element && element.nodeClass) {
        // find element by name
        const browseNameToFind = element.browseName.name!.toString();
        elementIndex = _array.findIndex((obj: any, i: number) => {
            const browseName = uaArrayVariableNode.$$getElementBrowseName(obj).toString();
            return browseName === browseNameToFind;
        });
    } else if (typeof element === "function") {
        // find element by functor
        elementIndex = _array.findIndex(element);
    } else {
        // find element by inner extension object
        assert(_array[0].constructor.name === (element as any).constructor.name, "element must match");
        elementIndex = _array.findIndex((x: any) => x === element);
    }
    
    // istanbul ignore next
    if (elementIndex < 0) {
        throw new Error("removeElement: cannot find element matching " + element.toString());
    }
    return removeElementByIndex(uaArrayVariableNode, elementIndex);
}
