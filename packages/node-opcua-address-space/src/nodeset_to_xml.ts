/**
 * @module node-opcua-address-space
 */
// produce nodeset xml files
import { AddressSpacePrivate } from "./address_space_private";

// tslint:disable:no-var-requires
const XMLWriter = require("xml-writer");
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { QualifiedName } from "node-opcua-data-model";
import { getStructureTypeConstructor } from "node-opcua-factory";
import { hasStructuredType } from "node-opcua-factory";
import { getStructuredTypeSchema } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import * as utils from "node-opcua-utils";
import { Variant } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

import { XmlWriter } from "../source";

import { BaseNode } from "./base_node";
import { UANamespace } from "./namespace";
import { NamespacePrivate } from "./namespace_private";
import { Reference } from "./reference";
import { UADataType } from "./ua_data_type";
import { UAMethod } from "./ua_method";
import { UAObject } from "./ua_object";
import { UAObjectType } from "./ua_object_type";
import { UAReferenceType } from "./ua_reference_type";
import { UAVariable } from "./ua_variable";
import { UAVariableType } from "./ua_variable_type";

function _hash(node: BaseNode | Reference): string {
    return (node.nodeId.toString());
}

function _dumpDisplayName(xw: XmlWriter, node: BaseNode): void {
    xw.startElement("DisplayName").text(node.displayName[0].text!).endElement();
}

function _dumpDescription(xw: XmlWriter, node: BaseNode): void {
    if (node.description) {
        let desc = node.description.text;
        desc = desc || "";
        xw.startElement("Description").text(desc).endElement();
    }
}

function translateNodeId(xw: XmlWriter, nodeId: NodeId): NodeId {
    assert(nodeId instanceof NodeId);
    const nn = xw.translationTable[nodeId.namespace];
    const translatedNode = new NodeId(nodeId.identifierType, nodeId.value, nn);
    return translatedNode;
}

function n(xw: XmlWriter, nodeId: NodeId): string {
    return translateNodeId(xw, nodeId).toString().replace("ns=0;", "");
}

function translateBrowseName(xw: XmlWriter, browseName: QualifiedName): QualifiedName {
    assert(browseName instanceof QualifiedName);
    const nn = xw.translationTable[browseName.namespaceIndex];
    const translatedBrowseName = new QualifiedName({ namespaceIndex: nn, name: browseName.name });
    return translatedBrowseName;
}

function b(xw: XmlWriter, browseName: QualifiedName): string {
    return translateBrowseName(xw, browseName).toString().replace("ns=0;", "");
}

function _dumpReferences(xw: XmlWriter, node: BaseNode) {

    xw.startElement("References");

    const addressSpace = node.addressSpace;

    const aggregateReferenceType = addressSpace.findReferenceType("Aggregates")!;
    const hasChildReferenceType = addressSpace.findReferenceType("HasChild")!;
    const hasSubtypeReferenceType = addressSpace.findReferenceType("HasSubtype")!;
    const hasTypeDefinitionReferenceType = addressSpace.findReferenceType("HasTypeDefinition")!;
    const nonHierarchicalReferencesType = addressSpace.findReferenceType("NonHierarchicalReferences")!;
    const organizesReferencesType = addressSpace.findReferenceType("Organizes")!;
    const connectsToReferenceType = addressSpace.findReferenceType("ConnectsTo")!;
    const hasEventSourceReferenceType = addressSpace.findReferenceType("HasEventSource")!;

    function referenceToKeep(reference: Reference): boolean {
        const referenceType = reference._referenceType!;
        // only keep
        if (referenceType.isSupertypeOf(aggregateReferenceType) && reference.isForward) {
            return true;
        } else if (referenceType.isSupertypeOf(hasSubtypeReferenceType) && !reference.isForward) {
            return true;
             } else if (referenceType.isSupertypeOf(hasTypeDefinitionReferenceType) && reference.isForward) {
            return true;
             } else if (referenceType.isSupertypeOf(nonHierarchicalReferencesType) && reference.isForward) {
            return true;
             } else if (referenceType.isSupertypeOf(organizesReferencesType) && !reference.isForward) {
            return true;
             } else if (connectsToReferenceType &&
                        referenceType.isSupertypeOf(connectsToReferenceType) && reference.isForward) {
            return true;
             } else if (referenceType.isSupertypeOf(hasEventSourceReferenceType) && reference.isForward) {
            return true;
             }
        return false;
    }

    const references = node.allReferences().filter(referenceToKeep);

    for (const reference of references) {

        if (reference._referenceType!.browseName.toString() === "HasSubtype" && reference.isForward) {
            continue;
        }

        // only output inverse Reference
        xw.startElement("Reference");

        xw.writeAttribute("ReferenceType", b(xw, reference._referenceType!.browseName));

        if (!reference.isForward) {
            xw.writeAttribute("IsForward", reference.isForward ? "true" : "false");
        }
        xw.text(n(xw, reference.nodeId));

        xw.endElement();
    }
    xw.endElement();

}

function _dumpVariantExtensionObjectValue_Body(
  xw: XmlWriter,
  schema: any,
  value: any
) {

    xw.startElement(schema.name);
    if (value) {
        for (const field of schema.fields) {
            xw.startElement(utils.capitalizeFirstLetter(field.name));
            const v = value[field.name];
            if (v !== null && v !== undefined) {
                switch (field.fieldType) {
                    case "UInt64":
                    case "Int64":
                        xw.text(v[1].toString());
                        break;
                    case "LocalizedText":
                        xw.startElement("Locale");
                        if (v.locale) {
                            xw.text(v.locale);
                        }
                        xw.endElement();
                        xw.startElement("Text");
                        if (v.text) {
                            xw.text(v.text);
                        }
                        xw.endElement();
                        break;
                    default:
                        xw.text(v.toString());
                }
            }
            xw.endElement();
        }
    }
    xw.endElement();

}

// tslint:disable:no-console

/* encode object as XML */
function _dumpVariantExtensionObjectValue(
  xw: XmlWriter,
  schema: any,
  value: any
) {

    xw.startElement("ExtensionObject");
    {
        xw.startElement("TypeId");
        {
            // find HasEncoding node
            const encodingDefaultXml = (getStructureTypeConstructor(schema.name) as any).encodingDefaultXml;
            if (!encodingDefaultXml) {
                console.log("?????");
            }
            // xx var encodingDefaultXml = schema.encodingDefaultXml;
            xw.startElement("Identifier");
            xw.text(encodingDefaultXml.toString());
            xw.endElement();
        }
        xw.endElement();

        xw.startElement("Body");
        _dumpVariantExtensionObjectValue_Body(xw, schema, value);
        xw.endElement();
    }
    xw.endElement();
}

function _dumpValue(
  xw: XmlWriter,
  node: UAVariable | UAVariableType,
  value: any
) {
    const addressSpace = node.addressSpace;

    if (!value) {
        return;
    }

    assert(value instanceof Variant);

    const dataTypeNode = addressSpace.findNode(node.dataType);
    if (!dataTypeNode) {
        return;
    }
    const dataTypeName = dataTypeNode.browseName.toString();

    const baseDataTypeName = (DataType as any)[DataType[value.dataType]];

    // console.log("nodeset_to_xml #_dumpValue Cannot find ", dataTypeName,node.dataType.toString());
    if (!hasStructuredType(dataTypeName)) {
        return;
    } // this is not a extension object

    const schema = getStructuredTypeSchema(dataTypeName);

    function encodeXml(value1: any) {
        _dumpVariantExtensionObjectValue_Body(xw, schema, value1);
    }

    xw.startElement("Value");

    // determine if dataTypeName is a ExtensionObject
    const isExtensionObject = dataTypeName === "LocalizedText" ? false : true;

    if (isExtensionObject) {

        if (value.arrayType === VariantArrayType.Array) {
            xw.startElement("ListOf" + baseDataTypeName);
            value.value.forEach(_dumpVariantExtensionObjectValue.bind(null, xw, schema));
            xw.endElement();
        } else if (value.arrayType === VariantArrayType.Scalar) {
            _dumpVariantExtensionObjectValue(xw, schema, value);
        }
    } else {

        if (value.arrayType === VariantArrayType.Array) {

            xw.startElement("ListOf" + baseDataTypeName);
            xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");

            value.value.forEach(encodeXml);

            xw.endElement();

        } else if (value.arrayType === VariantArrayType.Scalar) {
            encodeXml(value.value);
        }
    }

    xw.endElement();
}

function _dumpArrayDimensions(
  xw: XmlWriter,
  node: UAVariableType | UAVariable
) {
    if (node.arrayDimensions) {
        xw.writeAttribute("ArrayDimensions", node.arrayDimensions.join(","));
    }
}

function visitUANode(
  node: BaseNode,
  options: any,
  forward: boolean
) {

    assert(_.isBoolean(forward));

    const addressSpace = node.addressSpace;
    options.elements = options.elements || [];
    options.index_el = options.index_el || {};

    // visit references
    function process_reference(reference: Reference) {

        //  only backward or forward refernces
        if (reference.isForward !== forward) {
            return;
        }

        if (reference.nodeId.namespace === 0) {
            return; // skip OPCUA namespace
        }
        const k = _hash(reference);
        if (!options.index_el[k]) {
            options.index_el[k] = 1;

            const o = addressSpace.findNode(k)! as BaseNode;
            if (o) {
                visitUANode(o, options, forward);
            }
        }
    }

    _.forEach(node.ownReferences(), process_reference);
    options.elements.push(node);
    return node;
}

function dumpReferencedNodesOld(
  xw: XmlWriter,
  node: BaseNode,
  forward: boolean
) {

    assert(_.isBoolean(forward));

    xw.visitedNode[_hash(node)] = 1;

    const nodesToVisit: any = {};
    visitUANode(node, nodesToVisit, forward);

    for (const el of nodesToVisit.elements) {
        if (!xw.visitedNode[_hash(el)]) {
            el.dumpXML(xw);
        }
    }
}

function dumpReferencedNodes(
  xw: XmlWriter,
  node: BaseNode,
  forward: boolean
) {

    const addressSpace = node.addressSpace;
    if (!forward) {

        {
            const r = node.findReferencesEx("HasTypeDefinition");
            if (r && r.length) {
                assert(r.length === 1);
                const typeDefinitionObj = Reference.resolveReferenceNode(addressSpace, r[0])! as BaseNode;
                assert(typeDefinitionObj instanceof BaseNode);

                if (typeDefinitionObj.nodeId.namespace === node.nodeId.namespace) {
                    // only output node if it is on the same namespace
                    if (!xw.visitedNode[_hash(typeDefinitionObj)]) {
                        typeDefinitionObj.dumpXML(xw);
                    }
                }
            }
        }

        //
        {
            const r = node.findReferencesEx("HasSubtype", BrowseDirection.Inverse);
            if (r && r.length) {
                const subTypeOf = Reference.resolveReferenceNode(addressSpace, r[0])! as BaseNode;
                assert(r.length === 1);
                if (subTypeOf.nodeId.namespace === node.nodeId.namespace) {
                    // only output node if it is on the same namespace
                    if (!xw.visitedNode[_hash(subTypeOf)]) {
                        subTypeOf.dumpXML(xw);
                    }
                }
            }
        }
    } else {

        const r = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
        for (const reference of r) {
            const nodeChild = Reference.resolveReferenceNode(addressSpace, reference) as BaseNode;
            assert(nodeChild instanceof BaseNode);
            if (nodeChild.nodeId.namespace === node.nodeId.namespace) {
                if (!xw.visitedNode[_hash(nodeChild)]) {
                    console.log(node.nodeId.toString(), " dumping child ", nodeChild.browseName.toString(), nodeChild.nodeId.toString());
                    nodeChild.dumpXML(xw);
                }
            }
        }
    }
}

function dumpCommonAttributes(
  xw: XmlWriter,
  node: BaseNode
) {

    xw.writeAttribute("NodeId", n(xw, node.nodeId));
    xw.writeAttribute("BrowseName", b(xw, node.browseName));

    if (node.hasOwnProperty("symbolicName")) {
        xw.writeAttribute("SymbolicName", (node as any).symbolicName);
    }
    if (node.hasOwnProperty("isAbstract")) {
        if ((node as any).isAbstract) {
            xw.writeAttribute("IsAbstract", (node as any).isAbstract ? "true" : "false");
        }
    }
}

function dumpCommonElements(
  xw: XmlWriter,
  node: BaseNode
) {
    _dumpDisplayName(xw, node);
    _dumpDescription(xw, node);
    _dumpReferences(xw, node);
}

function _dumpUADataTypeDefinition(
  xw: XmlWriter,
  node: UADataType
) {
    const indexes = (node as any)._getDefinition();
    if (indexes) {
        xw.startElement("Definition");
        xw.writeAttribute("Name", node.definitionName);

        _.forEach(indexes.nameIndex, (defItem: any, key) => {

            xw.startElement("Field");
            xw.writeAttribute("Name", defItem.name);

            if (defItem.dataType && !defItem.dataType.isEmpty()) {
                // there is no dataType on enumeration
                const dataTypeStr = defItem.dataType.toString();
                xw.writeAttribute("DataType", dataTypeStr);
            }

            if (!utils.isNullOrUndefined(defItem.valueRank)) {
                xw.writeAttribute("ValueRank", defItem.valueRank);
            }
            if (!utils.isNullOrUndefined(defItem.value)) {
                xw.writeAttribute("Value", defItem.value);
            }
            if (defItem.description) {
                xw.startElement("Description");
                xw.text(defItem.description);
                xw.endElement();
            }
            xw.endElement();
        });
        xw.endElement();
    }
}

function dumpUADataType(
  xw: XmlWriter,
  node: UADataType
) {
    xw.startElement("UADataType");
    xw.writeAttribute("NodeId", n(xw, node.nodeId));
    xw.writeAttribute("BrowseName", b(xw, node.browseName));

    if (node.isAbstract) {
        xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
    }
    _dumpReferences(xw, node);
    _dumpUADataTypeDefinition(xw, node);
    xw.endElement();
}

UADataType.prototype.dumpXML = function(xw: XmlWriter) {
    dumpUADataType(xw, this);
};

function _markAsVisited(
  xw: XmlWriter,
  node: BaseNode
) {
    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;
}

function dumpUAVariable(
  xw: XmlWriter,
  node: UAVariable
) {

    _markAsVisited(xw, node);

    dumpReferencedNodes(xw, node, false);

    const addressSpace = node.addressSpace;

    xw.startElement("UAVariable");
    {
        // attributes
        dumpCommonAttributes(xw, node);

        if (node.valueRank !== -1) {
            xw.writeAttribute("ValueRank", node.valueRank);
        }

        const dataTypeNode = addressSpace.findNode(node.dataType);
        if (dataTypeNode) {
            // verify that data Type is in alias
            const dataTypeName = dataTypeNode.browseName.toString();
            xw.writeAttribute("DataType", dataTypeName);
        }
    }
    {
        // sub elements
        dumpCommonElements(xw, node);
        _dumpArrayDimensions(xw, node);
        _dumpValue(xw, node, node.readValue().value);
    }
    xw.endElement();

    dumpAggregates(xw, node);
}

UAVariable.prototype.dumpXML = function(xw) {
    dumpUAVariable(xw, this);
};

UAReferenceType.prototype.dumpXML = function(xw) {
    dumpReferenceType(xw, this);
};

function dumpUAVariableType(
  xw: XmlWriter,
  node: UAVariableType
) {

    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    dumpReferencedNodes(xw, node, false);

    const addressSpace = node.addressSpace;

    xw.startElement("UAVariableType");

    {
        // attributes
        dumpCommonAttributes(xw, node);

        if (node.valueRank !== -1) {
            xw.writeAttribute("ValueRank", node.valueRank);
        }
        const dataTypeNode = addressSpace.findNode(node.dataType);
        if (!dataTypeNode) {
            // throw new Error(" cannot find datatype " + node.dataType);
            console.log(" cannot find datatype " + node.dataType +
              " for node " + node.browseName.toString() + " id =" + node.nodeId.toString());
        } else {
            const dataTypeName = dataTypeNode.browseName.toString();
            xw.writeAttribute("DataType", dataTypeName);

        }
    }
    {
        // sub elements
        dumpCommonElements(xw, node);
        _dumpArrayDimensions(xw, node);
        _dumpValue(xw, node, node.value);
    }

    xw.endElement();

    dumpAggregates(xw, node);
}

UAVariableType.prototype.dumpXML = function(xw) {
    dumpUAVariableType(xw, this);
};

function dumpUAObject(
  xw: XmlWriter,
  node: UAObject
) {

    xw.writeComment("Object - " + b(xw, node.browseName) + " {{{{ ");

    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    // dump SubTypeOf and HasTypeDefinition
    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAObject");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    // dump aggregates nodes ( Properties / components )

    dumpAggregates(xw, node);

    dumpElementInFolder(xw, node);

    xw.writeComment("Object - " + b(xw, node.browseName) + " }}}} ");
}

UAObject.prototype.dumpXML = function(xw) {
    dumpUAObject(xw, this);
};

function dumpElementInFolder(
  xw: XmlWriter,
  node: BaseNode
) {

    const aggregates = node.getFolderElements().sort(
      (x: BaseNode, y: BaseNode) =>
        x.browseName.name!.toString() > y.browseName.name!.toString() ? 1 : -1
    );
    for (const aggregate of aggregates) {

        // do not export node that do not belong to our namespace
        if (node.nodeId.namespace !== aggregate.nodeId.namespace) {
            return;
        }

        if (!xw.visitedNode[_hash(aggregate)]) {
            aggregate.dumpXML(xw);
        }
    }
}

function dumpAggregates(
  xw: XmlWriter,
  node: BaseNode
) {

    // Xx xw.writeComment("Aggregates {{ ");
    const aggregates = node.getAggregates().sort(
      (x: BaseNode, y: BaseNode) =>
        x.browseName.name!.toString() > y.browseName.name!.toString() ? 1 : -1
    );
    for (const aggregate of aggregates) {

        // do not export node that do not belong to our namespace
        if (node.nodeId.namespace !== aggregate.nodeId.namespace) {
            return;
        }

        if (!xw.visitedNode[_hash(aggregate)]) {
            aggregate.dumpXML(xw);
        }
    }
    // Xx xw.writeComment("Aggregates }} ");
}

function dumpUAObjectType(
  xw: XmlWriter,
  node: UAObjectType
) {

    assert(node instanceof UAObjectType);
    xw.writeComment("ObjectType - " + b(xw, node.browseName) + " {{{{ ");
    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    // dump SubTypeOf and HasTypeDefinition
    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAObjectType");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    dumpAggregates(xw, node);

    xw.writeComment("ObjectType - " + b(xw, node.browseName) + " }}}}");
}

UAObjectType.prototype.dumpXML = function(xw) {
    dumpUAObjectType(xw, this);
};

function dumpUAMethod(
  xw: XmlWriter,
  node: UAMethod
) {

    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAMethod");
    dumpCommonAttributes(xw, node);
    xw.endElement();

    dumpAggregates(xw, node);
}

UAMethod.prototype.dumpXML = function(xw) {
    dumpUAMethod(xw, this);
};

function resolveDataTypeName(
  addressSpace: AddressSpacePrivate,
  dataType: string | NodeId
): QualifiedName {

    let dataTypeNode = null;
    // istanbul ignore next
    if (_.isString(dataType)) {
        dataTypeNode = addressSpace.findDataType(dataType);
    } else {
        assert(dataType instanceof NodeId);
        const o = addressSpace.findNode(dataType.toString());
        dataTypeNode = o ? o : null;
    }
    if (!dataTypeNode) {
        throw new Error("Cannot find dataTypeName " + dataType);
    }
    return dataTypeNode.browseName;
}

function buildUpAliases(
  node: BaseNode,
  xw: XmlWriter,
  options: any
) {

    const addressSpace = node.addressSpace;

    options.aliases = options.aliases || {};
    options.aliases_visited = options.aliases_visited || {};

    const k = _hash(node);
    // istanbul ignore next
    if (options.aliases_visited[k]) {
        return;
    }
    options.aliases_visited[k] = 1;

    // put datatype into aliases list
    if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {

        const nodeV = node as UAVariableType || UAVariable;

        if (nodeV.dataType && nodeV.dataType.namespace === 0 && nodeV.dataType.value !== 0) {
            // name
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, nodeV.dataType));
            if (dataTypeName) {
                if (!options.aliases[dataTypeName]) {
                    options.aliases[dataTypeName] = nodeV.dataType;
                }
            }
        }
    }

    function collectReferenceNameInAlias(reference: Reference) {
        // reference.referenceType
        const key = b(xw, reference._referenceType!.browseName);
        if (!options.aliases.key) {
            if (reference.referenceType.namespace === 0) {
                options.aliases[key] = reference.referenceType.toString().replace("ns=0;", "");
            } else {
                options.aliases[key] = n(xw, reference.referenceType);
            }
        }
    }

    _.forEach(node.allReferences(), collectReferenceNameInAlias);

}

function writeAliases(
  xw: XmlWriter,
  aliases: any
) {

    xw.startElement("Aliases");

    if (aliases) {
        const keys = Object.keys(aliases).sort();
        for (const key of keys) {
            xw.startElement("Alias");
            xw.writeAttribute("Alias", key);
            xw.text(aliases[key].toString().replace(/ns=0;/, ""));
            xw.endElement();
        }
    }
    xw.endElement();
}

function constructNamespaceDependency(
  namespace: NamespacePrivate
) {

    const addressSpace = namespace.addressSpace;

    // navigate all namespace recursively to
    // find dependency
    const dependency = [];
    const depMap = new Set();

    // default namespace is always first
    dependency.push(addressSpace.getDefaultNamespace());
    depMap.add(dependency[0].index);

    if (namespace !== addressSpace.getDefaultNamespace()) {
        dependency.push(namespace);
        depMap.add(namespace.index);
    }

    for (const node of _.values(namespace._nodeid_index)) {
        // visit all reference
        const references = node.ownReferences();
        for (const reference of references) {
            // check referenceId
            const namespaceIndex = reference._referenceType!.nodeId.namespace;
            if (!depMap.has(namespaceIndex)) {
                depMap.add(namespaceIndex);
                dependency.push(addressSpace.getNamespace(namespaceIndex));
            }
            const namespaceIndex2 = reference.nodeId.namespace;
            if (!depMap.has(namespaceIndex2)) {
                depMap.add(namespaceIndex2);
                dependency.push(addressSpace.getNamespace(namespaceIndex2));
            }
        }
    }
    return dependency;
}

function constructNamespaceTranslationTable(dependency: any): any {

    const translationTable: any = {};
    for (let i = 0; i < dependency.length; i++) {
        translationTable[dependency[i].index] = i;
    }
    return translationTable;
}

function dumpReferenceType(
  xw: XmlWriter,
  referenceType: UAReferenceType
) {

    _markAsVisited(xw, referenceType);

    xw.startElement("UAReferenceType");

    dumpCommonAttributes(xw, referenceType);

    dumpCommonElements(xw, referenceType);

    if (referenceType.inverseName /* LocalizedText*/) {
        // console.log("referenceType.inverseName)",referenceType.inverseName);
        xw.startElement("InverseName");
        xw.text(referenceType.inverseName!.text || "");
        xw.endElement();
    }

    xw.endElement();
}

function sortByBrowseName(x: BaseNode, y: BaseNode): number {
    const xstr = x.browseName.toString();
    const ystr = y.browseName.toString();
    if (xstr > ystr) {
        return -1;
    } else if (xstr < ystr) {
        return 1;
    }
    return 0;
}

export function dumpXml(
  node: BaseNode,
  options: any
) {

    const addressSpace = node.addressSpace;

    const namespace = node.namespace as NamespacePrivate;

    // make a first visit so that we determine which node to output and in which order
    const nodesToVisit: any = {};

    const dependency = constructNamespaceDependency(namespace);
    const translationTable = constructNamespaceTranslationTable(dependency);

    const xw = new XMLWriter(true);
    xw.translationTable = translationTable;

    visitUANode(node, nodesToVisit, false);

    xw.startDocument({ encoding: "utf-8" });
    xw.startElement("UANodeSet");
    xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:xsd", "http://www.w3.org/2001/XMLSchema");
    xw.writeAttribute("Version", "1.02");
    xw.writeAttribute("LastModified", (new Date()).toISOString());
    xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");

    buildUpAliases(node, xw, nodesToVisit);
    writeAliases(xw, nodesToVisit.aliases);

    for (const el of nodesToVisit.elements) {
        el.dumpXML(xw);
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
}

UANamespace.prototype.toNodeset2XML = function(this: UANamespace) {

    const dependency = constructNamespaceDependency(this);
    const translationTable = constructNamespaceTranslationTable(dependency);

    const xw = new XMLWriter(true);
    xw.translationTable = translationTable;

    xw.startDocument({ encoding: "utf-8", version: "1.0" });
    xw.startElement("UANodeSet");

    xw.writeAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:uax", "http://opcfoundation.org/UA/2008/02/Types.xsd");
    xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");
    // xx xw.writeAttribute("Version", "1.02");
    // xx xw.writeAttribute("LastModified", (new Date()).toISOString());

    // ------------- Namespace Uris
    xw.startElement("NamespaceUris");

    // xx const namespaceArray = namespace.addressSpace.getNamespaceArray();
    for (const depend of dependency) {
        xw.startElement("Uri");
        xw.text(depend.namespaceUri);
        xw.endElement();
    }

    xw.endElement();

    // ------------- Namespace Uris
    xw.startElement("Models");
    xw.endElement();

    const s: any = {};
    for (const node of _.values(this._nodeid_index)) {
        buildUpAliases(node, xw, s);
    }
    writeAliases(xw, s.aliases);

    xw.visitedNode = {};

    // -------------- writeReferences
    xw.writeComment("ReferenceTypes");
    const referenceTypes = _.values(this._referenceTypeMap).sort(sortByBrowseName);
    for (const referenceType of referenceTypes) {
        dumpReferenceType(xw, referenceType);
    }
    // -------------- ObjectTypes
    xw.writeComment("ObjectTypes");
    const objectTypes = _.values(this._objectTypeMap).sort(sortByBrowseName);
    // xx xw.writeComment(" "+ objectTypes.map(x=>x.browseName.name.toString()).join(" "));
    for (const objectType of objectTypes) {
        if (!xw.visitedNode[_hash(objectType)]) {
            objectType.dumpXML(xw);
        }
    }

    // -------------- VariableTypes
    xw.writeComment("VariableTypes");
    const variableTypes = _.values(this._variableTypeMap).sort(sortByBrowseName);
    // xx xw.writeComment("ObjectTypes "+ variableTypes.map(x=>x.browseName.name.toString()).join(" "));
    for (const variableType of variableTypes) {
        if (!xw.visitedNode[_hash(variableType)]) {
            variableType.dumpXML(xw);
        }
    }

    // -------------- Any thing else
    xw.writeComment("Other Nodes");
    const nodes = _.values(this._nodeid_index).sort(sortByBrowseName);
    // xx xw.writeComment(" "+ nodes.map(x=>x.browseName.name.toString()).join(" "));
    for (const node of nodes) {
        if (!xw.visitedNode[_hash(node)]) {
            node.dumpXML(xw);
        }
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
};
