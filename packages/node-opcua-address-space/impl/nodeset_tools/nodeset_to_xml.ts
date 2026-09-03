/**
 * @module node-opcua-address-space
 */
// produce nodeset xml files

import { types } from "node:util";
import type {
    BaseNode,
    IAddressSpace,
    UADataType,
    UAMethod,
    UAObject,
    UAReference,
    UAReferenceType,
    UAVariable,
    UAVariableType,
    UAView
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { AttributeIds, type Int64, isMinDate, type StatusCode } from "node-opcua-basic-types";
import { VariableIds } from "node-opcua-constants";
import { type LocalizedText, makeAccessLevelFlag, NodeClass, QualifiedName } from "node-opcua-data-model";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { EnumDefinition, StructureDefinition, StructureType } from "node-opcua-types";
import { isNullOrUndefined, lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import XMLWriter from "xml-writer";
import { makeDefinitionMap } from "../../api/loader/decode_xml_extension_object.js";
import type { DefinitionMap2 } from "../../api/loader/make_xml_extension_object_parser.js";
import { SessionContext } from "../../api/session_context.js";
import type { XmlWriter } from "../../api/xml_writer.js";
import { BaseNodeImpl, getReferenceType } from "../base_node_impl.js";
import { NamespaceImpl } from "../namespace_impl.js";
import { ReferenceImpl } from "../reference_impl.js";
import { UAMethodImpl } from "../ua_method_impl.js";
import { UAObjectImpl } from "../ua_object_impl.js";
import { UAObjectTypeImpl } from "../ua_object_type_impl.js";
import { UAVariableImpl } from "../ua_variable_impl.js";
import type { UAVariableTypeImpl } from "../ua_variable_type_impl.js";
import {
    _constructNamespaceTranslationTable,
    constructNamespaceDependency,
    constructNamespacePriorityTable
} from "./construct_namespace_dependency.js";
import { type NodesetWalkEvent, namespaceToWalkEvents, nodeToWalkEvents } from "./nodeset_to_records.js";

const debugLog = make_debugLog("nodeset_to_xml");
const warningLog = make_warningLog("nodeset_to_xml");
const errorLog = make_errorLog("nodeset_to_xml");
const doDebug = false;

function _hash(node: BaseNode | UAReference): string {
    return node.nodeId.toString();
}

function _dumpDisplayName(xw: XmlWriter, node: BaseNode): void {
    if (node.displayName?.[0]) {
        xw.startElement("DisplayName")
            .text(node.displayName[0].text || "")
            .endElement();
    }
}
function _dumpDescription(xw: XmlWriter, node: { description?: LocalizedText }): void {
    if (node.description?.text?.length) {
        let desc = node.description.text;
        desc = desc || "";
        xw.startElement("Description").text(desc).endElement();
    }
}

function translateNodeId(xw: XmlWriter, nodeId: NodeId): NodeId {
    assert(nodeId instanceof NodeId);
    const nn = xw.translationTable.get(nodeId.namespace);
    const translatedNode = new NodeId(nodeId.identifierType, nodeId.value, nn);
    return translatedNode;
}

function n(xw: XmlWriter, nodeId: NodeId): string {
    return translateNodeId(xw, nodeId).toString().replace("ns=0;", "");
}

function translateBrowseName(xw: XmlWriter, browseName: QualifiedName): QualifiedName {
    assert(browseName instanceof QualifiedName);
    const nn = xw.translationTable.get(browseName.namespaceIndex);
    const translatedBrowseName = new QualifiedName({ namespaceIndex: nn, name: browseName.name });
    return translatedBrowseName;
}

function b(xw: XmlWriter, browseName: QualifiedName): string {
    return translateBrowseName(xw, browseName).toString().replace("ns=0;", "");
}

function hasHigherPriorityThan(namespaceIndex1: number, namespaceIndex2: number, priorityTable: number[]) {
    const order1 = priorityTable[namespaceIndex1];
    const order2 = priorityTable[namespaceIndex2];
    return order1 > order2;
}

function _hasHigherPriorityThan(xw: XmlWriter, namespaceIndex1: number, namespaceIndex2: number) {
    assert(xw.priorityTable, "expecting a priorityTable");
    assert(namespaceIndex1 < xw.priorityTable.length);
    assert(namespaceIndex2 < xw.priorityTable.length);
    return hasHigherPriorityThan(namespaceIndex1, namespaceIndex2, xw.priorityTable);
}

function _mustFindReferenceType(addressSpace: IAddressSpace, name: string): UAReferenceType {
    const referenceType = addressSpace.findReferenceType(name);
    // c8 ignore next
    if (!referenceType) {
        throw new Error(`Cannot find standard reference type ${name}: please check your nodeset file`);
    }
    return referenceType;
}

function _dumpReferences(xw: XmlWriter, node: BaseNode) {
    xw.startElement("References");

    const addressSpace = node.addressSpace;

    const aggregateReferenceType = _mustFindReferenceType(addressSpace, "Aggregates");
    // const hasChildReferenceType = _mustFindReferenceType(addressSpace, "HasChild");
    const hasSubtypeReferenceType = _mustFindReferenceType(addressSpace, "HasSubtype");
    const hasTypeDefinitionReferenceType = _mustFindReferenceType(addressSpace, "HasTypeDefinition");
    const nonHierarchicalReferencesType = _mustFindReferenceType(addressSpace, "NonHierarchicalReferences");
    const organizesReferencesType = _mustFindReferenceType(addressSpace, "Organizes");
    // ConnectsTo is genuinely optional: not every nodeset registers it, and the check
    // below already tolerates it being absent.
    const connectsToReferenceType = addressSpace.findReferenceType("ConnectsTo");
    const hasEventSourceReferenceType = _mustFindReferenceType(addressSpace, "HasEventSource");

    function referenceToKeep(reference: UAReference): boolean {
        // resolved here: a reference nobody has looked at since the load carries only the NodeId of its type
        const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);
        if (!referenceType) {
            return false;
        }
        const targetedNamespaceIndex = reference.nodeId.namespace;

        // get the direct backward reference to a external namespace
        if (referenceType.isSubtypeOf(aggregateReferenceType) && !reference.isForward) {
            if (reference.nodeId.namespace !== node.nodeId.namespace) {
                // todo: may be check that reference.nodeId.namespace is one of the namespace
                // on which our namespace is build and not a derived one !
                return true;
            }
        }
        if (referenceType.isSubtypeOf(hasSubtypeReferenceType) && reference.isForward) {
            // return false;
        }
        // only keep
        if (referenceType.isSubtypeOf(aggregateReferenceType) && reference.isForward) {
            if (_hasHigherPriorityThan(xw, targetedNamespaceIndex, node.nodeId.namespace)) {
                return false;
            }
            return true;
        } else if (referenceType.isSubtypeOf(hasSubtypeReferenceType) && !reference.isForward) {
            return true;
        } else if (referenceType.isSubtypeOf(hasTypeDefinitionReferenceType) && reference.isForward) {
            return true;
        } else if (referenceType.isSubtypeOf(nonHierarchicalReferencesType) && reference.isForward) {
            // e.g. HasInterface — always keep, the current node owns this reference
            return true;
        } else if (referenceType.isSubtypeOf(organizesReferencesType) && !reference.isForward) {
            // Organizes inverse — the current node is organized by an external folder
            return true;
        } else if (connectsToReferenceType && referenceType.isSubtypeOf(connectsToReferenceType) && reference.isForward) {
            return true;
        } else if (referenceType.isSubtypeOf(hasEventSourceReferenceType) && reference.isForward) {
            return true;
        }
        return false;
    }
    const allReferences = node.allReferences();
    const references = allReferences.filter(referenceToKeep);

    for (const reference of references.sort(sortByNodeId)) {
        if (getReferenceType(reference).browseName.toString() === "HasSubtype" && reference.isForward) {
            continue;
        }
        xw.startElement("Reference");

        xw.writeAttribute("ReferenceType", b(xw, getReferenceType(reference).browseName));

        if (!reference.isForward) {
            xw.writeAttribute("IsForward", reference.isForward ? "true" : "false");
        }
        xw.text(n(xw, reference.nodeId));

        xw.endElement();
    }
    xw.endElement();
}
function _dumpLocalizedText(xw: XmlWriter, v: LocalizedText) {
    const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    if (v.locale?.length) {
        xw.startElement(`${uax}Locale`);
        xw.text(v.locale);
        xw.endElement();
    }
    xw.startElement(`${uax}Text`);
    if (v.text) {
        xw.text(v.text);
    }
    xw.endElement();
}
function _dumpQualifiedName(xw: XmlWriter, v: QualifiedName) {
    const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    const t = translateBrowseName(xw, v);
    if (t.name) {
        xw.startElement(`${uax}Name`);
        xw.text(t.name);
        xw.endElement();
    }
    if (t.namespaceIndex) {
        xw.startElement(`${uax}NamespaceIndex`);
        xw.text(t.namespaceIndex.toString());
        xw.endElement();
    }
}
function _dumpXmlElement(xw: XmlWriter, v: string) {
    xw.text(v);
}
/*
<uax:ExtensionObject>
    <uax:TypeId>
        <uax:Identifier>i=339</uax:Identifier>
    </uax:TypeId>
    <uax:Body>
        <BuildInfo xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
            <ProductUri></ProductUri>
            <ManufacturerName></ManufacturerName>
            <ProductName></ProductName>
            <SoftwareVersion></SoftwareVersion>
            <BuildNumber></BuildNumber>
            <BuildDate>1900-01-01T00:00:00Z</BuildDate>
        </BuildInfo>
    </uax:Body>
</uax:ExtensionObject>
*/
type XmlNamespaceUri = string;
type NamespaceUri = string;
type XmlNs = string;
interface XmlWriterEx extends XmlWriter {
    map: Record<XmlNamespaceUri, XmlNs>;
    stackMap: Record<XmlNamespaceUri, XmlNs>[];
    namespaceArray: NamespaceUri[];
}
export function initXmlWriterEx(xw: XmlWriter, map: Record<XmlNamespaceUri, XmlNs>, namespaceArray: NamespaceUri[]): void {
    const xwe = xw as XmlWriterEx;
    xwe.map = map;
    xwe.stackMap = [];
    xwe.namespaceArray = namespaceArray;
}
function findXsdNamespaceUri(xw: XmlWriter, nodeId: NodeId): string {
    const xwe = xw as XmlWriterEx;
    if (!xwe.namespaceArray) {
        return "";
    }
    const namespace = xwe.namespaceArray[nodeId.namespace];
    if (namespace === "http://opcfoundation.org/UA/") {
        return "http://opcfoundation.org/UA/2008/02/Types.xsd";
    }
    // c8 ignore next
    if (!namespace) {
        return "";
    }
    return `${namespace.replace(/\/$/, "")}/Types.xsd`;
}

function getPrefix(xw: XmlWriter, namespace: XmlNamespaceUri): XmlNs {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return "";
    const p = xwe.map[namespace] || "";
    return p ? `${p}:` : "";
}

function restoreDefaultNamespace(xw: XmlWriter) {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return;
    const previousMap = xwe.stackMap.pop();
    if (previousMap) {
        xwe.map = previousMap;
    }
}

function setDefaultNamespace(xw: XmlWriter, namespace: XmlNamespaceUri): void {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return;
    if (xwe.map[namespace] !== "") {
        xw.writeAttribute("xmlns", namespace);
    }

    xwe.stackMap.push({
        ...xwe.map
    });
    xwe.map[namespace] = "";
}

function startElementEx(xw: XmlWriter, _ns: XmlNs, name: string, defaultNamespace: XmlNamespaceUri) {
    const _xwe = xw as XmlWriterEx;
    xw.startElement(name);
    setDefaultNamespace(xw, defaultNamespace);
}

function _dumpNodeId(xw: XmlWriter, v: NodeId) {
    const xmlns = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    xw.startElement(`${xmlns}Identifier`);
    xw.text(n(xw, v));
    xw.endElement();
}

function _dumpVariantValue(xw: XmlWriter, dataTypeNodeId: NodeId, dataType: DataType, addressSpace: IAddressSpace, value: unknown) {
    if (value === undefined || value === null) {
        return;
    }
    if (dataType === DataType.Null) {
        return;
    }
    const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    xw.startElement(`${uax}${DataType[dataType]}`);
    const definitionMap = makeDefinitionMap(addressSpace);
    _dumpVariantInnerValue(xw, dataType, dataTypeNodeId, definitionMap, addressSpace, value);
    xw.endElement();
}

function _dumpVariantInnerExtensionObject(
    xw: XmlWriter,
    definitionMap: DefinitionMap2,
    definition: StructureDefinition,
    addressSpace: IAddressSpace,
    value: ExtensionObject
) {
    const namespaceUri = findXsdNamespaceUri(xw, definition.defaultEncodingId);
    const ns = getPrefix(xw, namespaceUri);

    const isUnion =
        definition.structureType === StructureType.Union || definition.structureType === StructureType.UnionWithSubtypedValues;

    for (const field of definition.fields || []) {
        const dataTypeNodeId = field.dataType;

        const fieldName = field.name || "";
        const lowerFieldName = lowerFirstLetter(fieldName);
        const v = (value as unknown as Record<string, unknown>)[lowerFieldName];
        if (v !== null && v !== undefined) {
            if (
                dataTypeNodeId.namespace === 0 &&
                dataTypeNodeId.value === 0 &&
                dataTypeNodeId.identifierType === NodeIdType.NUMERIC
            ) {
                // to do ?? shall we do a extension Object here ?
                continue; // ns=0;i=0 is reserved
            }

            const { name, definition } = definitionMap.findDefinition(dataTypeNodeId);

            startElementEx(xw, ns, fieldName, namespaceUri);
            //  xw.startElement(fieldName);

            let fun: (value: unknown) => void = (_value: unknown) => {
                /** */
            };
            if (definition instanceof StructureDefinition) {
                fun = _dumpVariantInnerExtensionObject.bind(null, xw, definitionMap, definition, addressSpace) as (
                    value: unknown
                ) => void;
            } else if (definition instanceof EnumDefinition) {
                fun = _dumpVariantInnerValueEnum.bind(null, xw, definition);
            } else if (definition?.dataType === DataType.Variant) {
                fun = (value: unknown) => {
                    const variantValue = value as Variant;
                    xw.startElement("Value");
                    _dumpVariantValue(xw, field.dataType, variantValue.dataType, addressSpace, variantValue.value);
                    xw.endElement();
                };
            } else {
                const baseType = definition.dataType;
                fun = _dumpVariantInnerValue.bind(null, xw, baseType, dataTypeNodeId, definitionMap, addressSpace);
            }
            try {
                if (field.valueRank === -1) {
                    fun(v);
                } else {
                    // array
                    for (const arrayItem of v as unknown[]) {
                        xw.startElement(name);
                        fun(arrayItem);
                        xw.endElement();
                    }
                }
            } catch (err) {
                if (types.isNativeError(err)) {
                    errorLog("Error in _dumpVariantExtensionObjectValue_Body !!!", err.message);
                }
                // c8 ignore next
                if (doDebug) {
                    debugLog(name);
                    debugLog(field);
                }
                // throw err;
            }
            restoreDefaultNamespace(xw);
            xw.endElement();
        } else {
            if (!isUnion && !field.isOptional) {
                // field is mandatory but is null=> provide an empty array
                startElementEx(xw, ns, fieldName, namespaceUri);
                restoreDefaultNamespace(xw);
                xw.endElement();
            }
        }
    }
}

function _dumpVariantInnerValueEnum(xw: XmlWriter, definition: EnumDefinition, value: unknown): void {
    if (!definition.fields) {
        return;
    }
    const field = definition.fields.find((f) => f.value[1] === value || f.name === value);
    xw.text(`${field?.name}_${field?.value[1]}`);
}

function _dumpVariantInnerValue(
    xw: XmlWriter,
    dataType: DataType,
    dataTypeNodeId: NodeId,
    definitionMap: DefinitionMap2,
    addressSpace: IAddressSpace,
    value: unknown
): void {
    const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    switch (dataType) {
        case null:
        case DataType.Null:
            break;
        case DataType.LocalizedText:
            _dumpLocalizedText(xw, value as LocalizedText);
            break;
        case DataType.QualifiedName:
            _dumpQualifiedName(xw, value as QualifiedName);
            break;
        case DataType.NodeId:
            _dumpNodeId(xw, value as NodeId);
            break;
        case DataType.DateTime:
            xw.text((value as Date).toISOString());
            break;
        case DataType.Int64:
        case DataType.UInt64:
            xw.text((value as [number, number])[1].toString());
            break;
        case DataType.Boolean:
        case DataType.SByte:
        case DataType.Byte:
        case DataType.Float:
        case DataType.Double:
        case DataType.Int16:
        case DataType.Int32:
        case DataType.UInt16:
        case DataType.UInt32:
        case DataType.String:
            xw.text((value as { toString(): string }).toString());
            break;
        case DataType.ByteString:
            {
                const base64 = (value as Buffer).toString("base64");
                const chunks = base64.match(/.{0,80}/g);
                xw.text(base64.length > 80 && chunks ? chunks.join("\n") : base64);
            }
            break;
        case DataType.Guid:
            /*
             <uax:Guid>
                 <uax:String>947c29a7-490d-4dc9-adda-1109e3e8fcb7</uax:String>
            </uax:Guid>
            */
            if (value !== undefined && value !== null) {
                // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
                xw.startElement(`${uax}String`);
                xw.text((value as { toString(): string }).toString());
                xw.endElement();
            }
            break;

        case DataType.ExtensionObject:
            _dumpVariantExtensionObjectValue(xw, dataTypeNodeId, definitionMap, addressSpace, value as ExtensionObject);
            break;
        case DataType.XmlElement:
            _dumpXmlElement(xw, value as string);
            break;
        case DataType.StatusCode:
            xw.text((value as StatusCode).value.toString());
            break;
        case DataType.Variant: {
            const variantValue = value as Variant;
            _dumpVariantInnerValue(xw, variantValue.dataType, dataTypeNodeId, definitionMap, addressSpace, variantValue.value);
            break;
        }
        default:
            errorLog(`_dumpVariantInnerValue incomplete ${value} DataType=${dataType}=${DataType[dataType]}`);
        //  throw new Error("_dumpVariantInnerValue incomplete " + value + " " + "DataType=" + dataType + "=" + DataType[dataType]);
    }
}

/**
 *
 * @param xw
 * @param schema
 * @param value
 * @private
 */
export function _dumpVariantExtensionObjectValue_Body(
    xw: XmlWriter,
    definitionMap: DefinitionMap2,
    name: string,
    definition: StructureDefinition,
    addressSpace: IAddressSpace,
    value: ExtensionObject
) {
    if (value) {
        const namespaceUri = findXsdNamespaceUri(xw, definition.defaultEncodingId);
        const ns = getPrefix(xw, namespaceUri);
        startElementEx(xw, ns, `${name}`, namespaceUri);
        if (value) {
            _dumpVariantInnerExtensionObject(xw, definitionMap, definition, addressSpace, value);
        }
        restoreDefaultNamespace(xw);
        xw.endElement();
    }
}

function _dumpVariantExtensionObjectValue(
    xw: XmlWriter,
    dataTypeNodeId: NodeId,
    definitionMap: DefinitionMap2,
    addressSpace: IAddressSpace,
    value: ExtensionObject
) {
    const { name, definition } = definitionMap.findDefinition(dataTypeNodeId);
    // const encodingDefaultXml = (getStructureTypeConstructor(schema.name) as any).encodingDefaultXml;
    const encodingDefaultXml = value.schema.encodingDefaultXml;
    if (!encodingDefaultXml || encodingDefaultXml.isEmpty()) {
        warningLog("dataType Name ", name, "with ", dataTypeNodeId.toString(), " does not have xml encoding");
        // throw new Error("Extension Object doesn't provide a XML ");
        return;
    }
    const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    startElementEx(xw, uax, `ExtensionObject`, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    {
        const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
        xw.startElement(`${uax}TypeId`);
        // find HasEncoding node
        // xx var encodingDefaultXml = schema.encodingDefaultXml;
        xw.startElement(`${uax}Identifier`);
        xw.text(n(xw, encodingDefaultXml));
        xw.endElement();
        xw.endElement();
        startElementEx(xw, uax, "Body", "http://opcfoundation.org/UA/2008/02/Types.xsd");

        _dumpVariantExtensionObjectValue_Body(xw, definitionMap, name, definition as StructureDefinition, addressSpace, value);

        restoreDefaultNamespace(xw);
        xw.endElement();
    }
    restoreDefaultNamespace(xw);
    xw.endElement();
}

function _dumpVariantExtensionObjectValue2(xw: XmlWriter, addressSpace: IAddressSpace, value: ExtensionObject) {
    const dataTypeNodeId = value.schema.dataTypeNodeId;
    const definitionMap = makeDefinitionMap(addressSpace);
    const dataTypeNode = addressSpace.findDataType(dataTypeNodeId);
    if (!dataTypeNode) {
        warningLog("_dumpVariantExtensionObjectValue2: Cannot find dataType for  ", dataTypeNodeId.toString());
        return;
    }
    _dumpVariantExtensionObjectValue(xw, dataTypeNode.nodeId, definitionMap, addressSpace, value);
}

export function _isDefaultValue(value: Variant): boolean {
    // detect default value
    if (value.arrayType === VariantArrayType.Scalar) {
        switch (value.dataType) {
            case DataType.ExtensionObject:
                if (!value.value) {
                    return true;
                }
                break;
            case DataType.DateTime:
                if (!value.value || isMinDate(value.value)) {
                    return true;
                }
                break;
            case DataType.ByteString:
                if (!value.value || value.value.length === 0) {
                    return true;
                }
                break;
            case DataType.Boolean:
                return false; // we want it all the time !
            case DataType.SByte:
            case DataType.Byte:
            case DataType.UInt16:
            case DataType.UInt32:
            case DataType.Int16:
            case DataType.Int32:
            case DataType.Double:
            case DataType.Float:
                if (value.value === 0 || value.value === null) {
                    return true;
                }
                break;
            case DataType.String:
                if (value.value === null || value.value === "") {
                    return true;
                }
                break;
            case DataType.Int64:
            case DataType.UInt64:
                if (0 === coerceInt64ToInt32(value.value)) {
                    return true;
                }
                break;
            case DataType.LocalizedText:
                if (!value.value) {
                    return true;
                }
                {
                    const l = value.value as LocalizedText;
                    if (!l.locale && !l.text) {
                        return true;
                    }
                }
                break;
        }
        return false;
    } else {
        if (!value.value || value.value.length === 0) {
            return true;
        }
        return false;
    }
}

function _dumpValue(xw: XmlWriter, node: UAVariable | UAVariableType, variant: Variant) {
    const addressSpace = node.addressSpace;

    // c8 ignore next
    if (variant === null || variant === undefined) {
        return;
    }
    assert(variant instanceof Variant);

    const dataTypeNode = addressSpace.findDataType(node.dataType);

    // c8 ignore next
    if (!dataTypeNode) {
        // c8 ignore next
        doDebug && debugLog("Cannot find dataType:", node.dataType.toString());
        return;
    }

    const dataTypeName = dataTypeNode.browseName.name?.toString();
    const baseDataTypeName = DataType[variant.dataType];

    if (baseDataTypeName === "Null") {
        return;
    }
    assert(typeof baseDataTypeName === "string");

    // determine if dataTypeName is a ExtensionObject
    const isExtensionObject = variant.dataType === DataType.ExtensionObject;

    if (_isDefaultValue(variant)) {
        return;
    }
    xw.startElement("Value");

    const uax = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    if (isExtensionObject) {
        const encodeXml = _dumpVariantExtensionObjectValue2.bind(null, xw, node.addressSpace);

        switch (variant.arrayType) {
            case VariantArrayType.Matrix:
            case VariantArrayType.Array:
                startElementEx(xw, uax, `ListOf${baseDataTypeName}`, "http://opcfoundation.org/UA/2008/02/Types.xsd");
                variant.value.forEach(encodeXml);
                restoreDefaultNamespace(xw);
                xw.endElement();
                break;
            case VariantArrayType.Scalar:
                encodeXml(variant.value);
                break;
            default:
                errorLog(node.toString());
                errorLog("_dumpValue : unsupported arrayType: ", variant.arrayType);
        }
    } else {
        const encodeXml = _dumpVariantValue.bind(null, xw, node.dataType, variant.dataType, node.addressSpace);
        switch (variant.arrayType) {
            case VariantArrayType.Matrix:
            case VariantArrayType.Array:
                startElementEx(xw, uax, `ListOf${dataTypeName}`, "http://opcfoundation.org/UA/2008/02/Types.xsd");
                variant.value.forEach(encodeXml);
                restoreDefaultNamespace(xw);
                xw.endElement();
                break;
            case VariantArrayType.Scalar:
                encodeXml(variant.value);
                break;
            default:
                errorLog(node.toString());
                errorLog("_dumpValue : unsupported arrayType: ", variant.arrayType);
        }
    }

    xw.endElement();
}

function _dumpArrayDimensionsAttribute(xw: XmlWriter, node: UAVariableType | UAVariable) {
    if (node.arrayDimensions) {
        if (node.valueRank === -1 || (node.arrayDimensions.length === 1 && node.arrayDimensions[0] === 0)) {
            return;
        }
        xw.writeAttribute("ArrayDimensions", node.arrayDimensions.join(","));
    }
}

function getParent(node: BaseNode): BaseNode | null {
    if (node instanceof UAVariableImpl || node instanceof UAMethodImpl || node instanceof UAObjectImpl) {
        return node.parent;
    }
    return null;
}

const currentReadFlag = makeAccessLevelFlag("CurrentRead");
function dumpCommonAttributes(xw: XmlWriter, node: BaseNode) {
    xw.writeAttribute("NodeId", n(xw, node.nodeId));
    xw.writeAttribute("BrowseName", b(xw, node.browseName));

    const parentNode = getParent(node);
    if (parentNode) {
        if (parentNode.nodeId.namespace <= node.nodeId.namespace) {
            xw.writeAttribute("ParentNodeId", n(xw, parentNode.nodeId));
        }
    }
    if (Object.hasOwn(node, "symbolicName")) {
        xw.writeAttribute("SymbolicName", (node as unknown as { symbolicName: string }).symbolicName);
    }
    if (Object.hasOwn(node, "isAbstract")) {
        const isAbstract = (node as unknown as { isAbstract: boolean }).isAbstract;
        if (isAbstract) {
            xw.writeAttribute("IsAbstract", isAbstract ? "true" : "false");
        }
    }
    // AccessLevel and UserAccessLevel exist in the XSD on UAVariable only. Gate on the node
    // class rather than on the presence of the property: UAVariableTypeImpl happens not to own
    // an accessLevel today, but it does own a `historizing` (see #1550), so a property-presence
    // guard is one refactor away from emitting an attribute the schema rejects.
    if (node.nodeClass === NodeClass.Variable) {
        const variable = node as UAVariable;
        // CurrentRead is by default
        if (variable.accessLevel !== currentReadFlag) {
            xw.writeAttribute("AccessLevel", variable.accessLevel.toString());
        }
        // UserAccessLevel is implicitly accessLevel when omitted (see convertUserAccessLevel in the loader),
        // so it only needs to be written down when it further restricts accessLevel.
        if (variable.userAccessLevel !== undefined && variable.userAccessLevel !== variable.accessLevel) {
            xw.writeAttribute("UserAccessLevel", variable.userAccessLevel.toString());
        }
    }
    // access policy: undefined means "inherit from the namespace", an empty rolePermissions array
    // means "this node deliberately grants nothing".
    if (node.accessRestrictions !== undefined) {
        xw.writeAttribute("AccessRestrictions", node.accessRestrictions.toString());
    }
    if (node.rolePermissions !== undefined && node.rolePermissions.length === 0) {
        xw.writeAttribute("HasNoPermissions", "true");
    }
    if (Object.hasOwn(node, "minimumSamplingInterval")) {
        const minimumSamplingInterval = (node as UAVariable).minimumSamplingInterval;
        if (minimumSamplingInterval > 0) {
            xw.writeAttribute("MinimumSamplingInterval", minimumSamplingInterval);
        }
    }
    // Historizing exists in the XSD on UAVariable only: UAVariableType is restricted to
    // DataType/ValueRank/ArrayDimensions. UAVariableTypeImpl nevertheless owns a `historizing`
    // property, so the node class must be tested here rather than the presence of the property.
    // false being the default, the attribute is only emitted when it is set.
    if (node.nodeClass === NodeClass.Variable && (node as UAVariable).historizing) {
        xw.writeAttribute("Historizing", "true");
    }
}

// the UANode XSD sequence is DisplayName, Description, Category, Documentation, References,
// RolePermissions, Extensions: RolePermissions must therefore come after References.
function _dumpRolePermissions(xw: XmlWriter, node: BaseNode) {
    const rolePermissions = node.rolePermissions;
    if (!rolePermissions || rolePermissions.length === 0) {
        // the empty case is carried by the HasNoPermissions attribute
        return;
    }
    xw.startElement("RolePermissions");
    for (const rolePermission of rolePermissions) {
        xw.startElement("RolePermission");
        xw.writeAttribute("Permissions", rolePermission.permissions.toString());
        xw.text(n(xw, rolePermission.roleId));
        xw.endElement();
    }
    xw.endElement();
}

function dumpCommonElements(xw: XmlWriter, node: BaseNode) {
    _dumpDisplayName(xw, node);
    _dumpDescription(xw, node);
    _dumpReferences(xw, node);
    _dumpRolePermissions(xw, node);
}

export function coerceInt64ToInt32(int64: Int64): number {
    if (typeof int64 === "number") {
        return int64 as number;
    }
    if (int64[0] === 0xffffffff && int64[1] === 0xffffffff) {
        return 0xffffffff;
    }
    if (int64[0] !== 0) {
        warningLog("coerceInt64ToInt32 , loosing high word in conversion");
    }
    return int64[1];
}

function _dumpEnumDefinition(xw: XmlWriter, enumDefinition: EnumDefinition) {
    enumDefinition.fields = enumDefinition.fields || [];

    for (const defItem of enumDefinition.fields) {
        xw.startElement("Field");
        xw.writeAttribute("Name", defItem.name as string);
        if (!isNullOrUndefined(defItem.value)) {
            xw.writeAttribute("Value", coerceInt64ToInt32(defItem.value));
        }
        _dumpDescription(xw, defItem);
        xw.endElement();
    }
}
function _dumpStructureDefinition(
    xw: XmlWriter,
    structureDefinition: StructureDefinition,
    baseStructureDefinition: StructureDefinition | null | undefined
) {
    /*
     * note: baseDataType and defaultEncodingId are implicit and not stored in the XML file ??
     *
     */
    // const baseDataType = structureDefinition.baseDataType;
    // const defaultEncodingId = structureDefinition.defaultEncodingId;

    // do not repeat elements that are already defined in base structure in the xml ouput!
    const fields = structureDefinition.fields || [];
    const nbFieldsInBase: number = baseStructureDefinition ? baseStructureDefinition.fields?.length || 0 : 0;

    for (let index = nbFieldsInBase; index < fields.length; index++) {
        const defItem = fields[index];
        xw.startElement("Field");
        xw.writeAttribute("Name", defItem.name as string);

        if (defItem.arrayDimensions) {
            xw.writeAttribute("ArrayDimensions", defItem.arrayDimensions.map((x) => x.toString()).join(","));
        }
        if (defItem.valueRank !== undefined && defItem.valueRank !== -1) {
            xw.writeAttribute("ValueRank", defItem.valueRank);
        }
        if (defItem.isOptional /* && defItem.isOptional !== false */) {
            xw.writeAttribute("IsOptional", defItem.isOptional.toString());
        }
        if (defItem.maxStringLength !== undefined && defItem.maxStringLength !== 0) {
            xw.writeAttribute("MaxStringLength", defItem.maxStringLength);
        }
        // todo : SymbolicName ( see AutoId )

        if (defItem.dataType) {
            // todo : namespace translation !
            xw.writeAttribute("DataType", n(xw, defItem.dataType));
        }
        _dumpDescription(xw, defItem);
        xw.endElement();
    }
}

function _dumpEncoding(xw: XmlWriter, uaEncoding: UAObject) {
    const uaDescription = uaEncoding.findReferencesAsObject("HasDescription")[0];
    if (uaDescription) {
        dumpUAVariable(xw, uaDescription as UAVariable);
    }
    _dumpUAObject(xw, uaEncoding);
}
function _dumpUADataTypeDefinition(xw: XmlWriter, uaDataType: UADataType) {
    const uaDataTypeBase = uaDataType.subtypeOfObj;

    if (uaDataType.isEnumeration()) {
        xw.startElement("Definition");
        xw.writeAttribute("Name", b(xw, uaDataType.browseName));
        _dumpEnumDefinition(xw, uaDataType.getEnumDefinition());
        xw.endElement();
        return;
    }

    if (uaDataType.isStructure()) {
        // in case the namespace is conforming to 1.03 specification the DataTypeDefinition attribute
        // will be not be readable....

        const dataValue = uaDataType.readAttribute(SessionContext.defaultContext, AttributeIds.DataTypeDefinition);

        const t = true;
        if (t || dataValue.statusCode.isGood()) {
            const definition = uaDataType.getStructureDefinition();
            const baseDefinition = uaDataTypeBase ? uaDataTypeBase.getStructureDefinition() : null;
            xw.startElement("Definition");
            xw.writeAttribute("Name", b(xw, uaDataType.browseName));
            if (definition.structureType === StructureType.Union) {
                xw.writeAttribute("IsUnion", "true");
            }
            _dumpStructureDefinition(xw, definition, baseDefinition);
            xw.endElement();
        }
        return;
    }
}

function dumpUAView(xw: XmlWriter, node: UAView) {
    _markAsVisited(xw, node);

    xw.startElement("UAView");
    xw.writeAttribute("NodeId", n(xw, node.nodeId));
    xw.writeAttribute("BrowseName", b(xw, node.browseName));

    dumpCommonElements(xw, node);

    xw.endElement();
}

function dumpUADataType(xw: XmlWriter, node: UADataType) {
    _markAsVisited(xw, node);

    xw.startElement("UADataType");
    xw.writeAttribute("NodeId", n(xw, node.nodeId));
    xw.writeAttribute("BrowseName", b(xw, node.browseName));
    if (node.symbolicName !== node.browseName.name) {
        xw.writeAttribute("SymbolicName", node.symbolicName);
    }
    if (node.isAbstract) {
        xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
    }

    dumpCommonElements(xw, node);

    _dumpUADataTypeDefinition(xw, node);

    xw.endElement();
}

function _markAsVisited(xw: XmlWriter, node: BaseNode) {
    xw.visitedNode = xw.visitedNode || new Set();
    assert(!xw.visitedNode.has(_hash(node)));
    xw.visitedNode.add(_hash(node));
}

function dumpUAVariable(xw: XmlWriter, node: UAVariable) {
    assert(node.nodeClass === NodeClass.Variable);
    if (xw.visitedNode.has(_hash(node))) {
        return;
    }
    _markAsVisited(xw, node);

    const addressSpace = node.addressSpace;

    xw.startElement("UAVariable");
    {
        // attributes
        dumpCommonAttributes(xw, node);

        if (node.valueRank !== -1) {
            // -1 = Scalar
            xw.writeAttribute("ValueRank", node.valueRank);
        }

        _dumpArrayDimensionsAttribute(xw, node);

        const dataTypeNode = addressSpace.findNode(node.dataType);
        if (dataTypeNode) {
            // verify that data Type is in alias
            // xx const dataTypeName = dataTypeNode.browseName.toString();
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, dataTypeNode.nodeId));
            xw.writeAttribute("DataType", dataTypeName);
        }
    }
    {
        // sub elements
        dumpCommonElements(xw, node);

        const value = (node as UAVariableImpl).$dataValue.value;
        if (value) {
            _dumpValue(xw, node, value);
        }
    }
    xw.endElement();
}

function dumpUAVariableType(xw: XmlWriter, node: UAVariableType) {
    assert(node.nodeClass === NodeClass.VariableType);
    xw.visitedNode = xw.visitedNode || new Set();
    assert(!xw.visitedNode.has(_hash(node)));
    xw.visitedNode.add(_hash(node));

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
            // c8 ignore next
            doDebug &&
                debugLog(
                    " cannot find datatype " +
                        node.dataType +
                        " for node " +
                        node.browseName.toString() +
                        " id =" +
                        node.nodeId.toString()
                );
        } else {
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, dataTypeNode.nodeId));
            xw.writeAttribute("DataType", dataTypeName);
        }
    }
    {
        _dumpArrayDimensionsAttribute(xw, node);

        // sub elements
        dumpCommonElements(xw, node);

        const value = (node as UAVariableTypeImpl).value as Variant;
        if (value) {
            _dumpValue(xw, node, value);
        }
    }

    xw.endElement();
}

function _dumpUAObject(xw: XmlWriter, node: UAObject) {
    assert(node.nodeClass === NodeClass.Object);
    xw.visitedNode = xw.visitedNode || new Set();
    assert(!xw.visitedNode.has(_hash(node)));
    xw.visitedNode.add(_hash(node));

    // dump SubTypeOf and HasTypeDefinition

    xw.startElement("UAObject");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    // dump aggregates nodes ( Properties / components )
}

function dumpUAObjectType(xw: XmlWriter, node: UAObjectTypeImpl) {
    assert(node.nodeClass === NodeClass.ObjectType);
    assert(node instanceof UAObjectTypeImpl);
    _markAsVisited(xw, node);

    // dump SubtypeOf and HasTypeDefinition node if part of the same namespace

    xw.startElement("UAObjectType");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();
}

function dumpUAMethod(xw: XmlWriter, node: UAMethod) {
    assert(node.nodeClass === NodeClass.Method);
    _markAsVisited(xw, node);

    xw.startElement("UAMethod");
    dumpCommonAttributes(xw, node);
    if (node.methodDeclarationId) {
        xw.writeAttribute("MethodDeclarationId", n(xw, node.methodDeclarationId));
    }
    dumpCommonElements(xw, node);
    xw.endElement();
}
function resolveDataTypeName(addressSpace: IAddressSpace, dataType: string | NodeId): QualifiedName {
    let dataTypeNode = null;
    // c8 ignore next
    if (typeof dataType === "string") {
        dataTypeNode = addressSpace.findDataType(dataType);
    } else {
        assert(dataType instanceof NodeId);
        const o = addressSpace.findNode(dataType.toString());
        dataTypeNode = o ? o : null;
    }
    if (!dataTypeNode) {
        errorLog(`resolveDataTypeName: warning cannot find DataType ${dataType.toString()}`);
        return new QualifiedName({ name: "", namespaceIndex: 0 });
    }
    return dataTypeNode.browseName;
}

function _buildUpAliases(node: BaseNode, xw: XmlWriter, data: BuildAliasesData) {
    const addressSpace = node.addressSpace;

    if (!data.aliases_visited) data.aliases_visited = new Set();

    const k = _hash(node);
    // c8 ignore next
    if (data.aliases_visited.has(k)) {
        return;
    }
    data.aliases_visited.add(k);

    // put datatype into aliases list
    if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {
        const nodeV = node as UAVariableType | UAVariable;

        if (nodeV.dataType && nodeV.dataType.namespace === 0 && nodeV.dataType.value !== 0) {
            // name
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, nodeV.dataType));
            if (dataTypeName) {
                if (!data.aliases[dataTypeName]) {
                    data.aliases[dataTypeName] = n(xw, nodeV.dataType);
                }
            }
        }

        if (nodeV.dataType && nodeV.dataType.namespace !== 0 && nodeV.dataType.value !== 0) {
            // name
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, nodeV.dataType));
            if (dataTypeName) {
                if (!data.aliases[dataTypeName]) {
                    data.aliases[dataTypeName] = n(xw, nodeV.dataType);
                }
            }
        }
    }

    function collectReferenceNameInAlias(reference: UAReference) {
        // reference.referenceType
        const key = b(xw, getReferenceType(reference).browseName);
        if (!data.aliases.key) {
            if (reference.referenceType.namespace === 0) {
                data.aliases[key] = reference.referenceType.toString().replace("ns=0;", "");
            } else {
                data.aliases[key] = n(xw, reference.referenceType);
            }
        }
    }

    node.allReferences().forEach(collectReferenceNameInAlias);
}

function writeAliases(xw: XmlWriter, aliases: Record<string, NodeIdString>) {
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

function dumpReferenceType(xw: XmlWriter, referenceType: UAReferenceType) {
    _markAsVisited(xw, referenceType);

    xw.startElement("UAReferenceType");

    dumpCommonAttributes(xw, referenceType);

    const isSymmetric = !referenceType.inverseName || referenceType.inverseName?.text === referenceType.browseName?.name;
    if (isSymmetric) {
        xw.writeAttribute("Symmetric", "true");
    }

    dumpCommonElements(xw, referenceType);

    if (!isSymmetric) {
        xw.startElement("InverseName");
        xw.text(referenceType.inverseName?.text || "");
        xw.endElement();
    }

    xw.endElement();
}

export function sortByBrowseName(x: BaseNode, y: BaseNode): number {
    const x_str = x.browseName.toString();
    const y_str = y.browseName.toString();
    if (x_str > y_str) {
        return -1;
    } else if (x_str < y_str) {
        return 1;
    }
    return 0;
}
function sortByNodeId(a: { nodeId: NodeId }, b: { nodeId: NodeId }) {
    return a.nodeId.toString() < b.nodeId.toString() ? -1 : 1;
}

type NodeIdString = string;

export interface BuildAliasesData {
    aliases: Record<string, NodeIdString>;
    aliases_visited?: Set<string>;
}

export type DumpXMLOptions = Record<string, never>;

/** the element of one node, and nothing else: the walk decides what comes before and after it */
function dumpElement(xw: XmlWriter, node: BaseNode): void {
    switch (node.nodeClass) {
        case NodeClass.Method:
            dumpUAMethod(xw, node as UAMethod);
            break;
        case NodeClass.Object:
            _dumpUAObject(xw, node as UAObject);
            break;
        case NodeClass.Variable:
            dumpUAVariable(xw, node as UAVariable);
            break;
        case NodeClass.VariableType:
            dumpUAVariableType(xw, node as UAVariableType);
            break;
        case NodeClass.ReferenceType:
            dumpReferenceType(xw, node as UAReferenceType);
            break;
        case NodeClass.ObjectType:
            dumpUAObjectType(xw, node as UAObjectTypeImpl);
            break;
        case NodeClass.DataType:
            dumpUADataType(xw, node as UADataType);
            break;
        case NodeClass.View:
            dumpUAView(xw, node as UAView);
            break;
        default:
            throw new Error(`dumpElement: unexpected node class ${node.nodeClass}`);
    }
}

/** the walk's events written as XML: comments, and each node's element looked up back in the address space */
function writeWalkEvents(
    xw: XmlWriter,
    addressSpace: IAddressSpace,
    translationTable: Map<number, number>,
    events: NodesetWalkEvent[]
): void {
    const reverse = new Map<number, number>();
    for (const [index, translated] of translationTable) {
        reverse.set(translated, index);
    }
    xw.visitedNode = xw.visitedNode || new Set();
    for (const event of events) {
        if (event.kind === "section") {
            xw.writeComment(event.text);
            continue;
        }
        if (event.kind !== "node") {
            continue;
        }
        const namespace = reverse.get(event.nodeId.namespace);
        if (namespace === undefined) {
            throw new Error(`toNodeset2XML: no namespace for ${event.nodeId.toString()}`);
        }
        const node = addressSpace.findNode(new NodeId(event.nodeId.identifierType, event.nodeId.value, namespace));
        if (!node) {
            throw new Error(`toNodeset2XML: cannot find ${event.nodeId.toString()} (namespace ${namespace})`);
        }
        dumpElement(xw, node);
    }
}

/**
 * one node as XML, with what the export brings with it: its type definition and supertype when they
 * belong to the same namespace, its aggregates after it. The same walk toNodeset2XML runs, from this node.
 */
BaseNodeImpl.prototype.dumpXML = function (this: BaseNodeImpl, xw: XmlWriter) {
    const { events, translationTable } = nodeToWalkEvents(this);
    xw.translationTable = xw.translationTable || translationTable;
    writeWalkEvents(xw, this.addressSpace, translationTable, events);
};

export function makeTypeXsd(namespaceUri: string): string {
    return `${namespaceUri.replace(/\/$/, "")}/Type.xsd`;
}

NamespaceImpl.prototype.toNodeset2XML = function (this: NamespaceImpl) {
    const namespaceArrayNode = this.addressSpace.findNode(VariableIds.Server_NamespaceArray);
    const namespaceArray: string[] = namespaceArrayNode
        ? namespaceArrayNode.readAttribute(null, AttributeIds.Value).value.value
        : [];

    const xw: XmlWriter = new XMLWriter(true);

    xw.priorityTable = constructNamespacePriorityTable(this.addressSpace).priorityTable;

    const dependency = constructNamespaceDependency(this, xw.priorityTable);
    const translationTable = _constructNamespaceTranslationTable(dependency, this);
    xw.translationTable = translationTable;
    // the walk: the same records the image writer and the loader consume, plus the comments
    const events = namespaceToWalkEvents(this);
    const header = events[0];
    if (header?.kind !== "header") {
        throw new Error("toNodeset2XML: the walk must start with the header record");
    }

    xw.startDocument({ encoding: "utf-8", version: "1.0" });
    xw.startElement("UANodeSet");

    xw.writeAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:uax", "http://opcfoundation.org/UA/2008/02/Types.xsd");
    xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");

    const namespacesMap: Record<string, string> = {
        "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd": "",
        "http://opcfoundation.org/UA/2008/02/Types.xsd": "uax",
        "http://www.w3.org/2001/XMLSchema-instance": "xsi"
    };

    for (const namespace of dependency) {
        if (namespace.index === 0) {
            continue;
        }
        const translatedIndex = translationTable.get(namespace.index);

        const smallName = `ns${translatedIndex}`;
        xw.writeAttribute(`xmlns:${smallName}`, makeTypeXsd(namespace.namespaceUri));
        namespacesMap[namespace.namespaceUri] = smallName;
    }

    initXmlWriterEx(xw, namespacesMap, namespaceArray);

    xw.startElement("NamespaceUris");
    for (const namespaceUri of header.namespaceUris) {
        xw.startElement("Uri");
        xw.text(namespaceUri);
        xw.endElement();
    }
    xw.endElement();

    xw.startElement("Models");
    for (const model of header.models) {
        xw.startElement("Model");
        xw.writeAttribute("ModelUri", model.modelUri);
        xw.writeAttribute("Version", model.version);
        xw.writeAttribute("PublicationDate", (model.publicationDate ?? this.publicationDate).toISOString());
        for (const required of model.requiredModels) {
            xw.startElement("RequiredModel");
            xw.writeAttribute("ModelUri", required.modelUri);
            xw.writeAttribute("Version", required.version);
            xw.writeAttribute("PublicationDate", required.publicationDate.toISOString());
            xw.endElement();
        }
        xw.endElement();
    }
    xw.endElement();

    const aliases: Record<string, NodeIdString> = {};
    for (const [name, nodeId] of Object.entries(header.aliases)) {
        aliases[name] = nodeId.toString().replace("ns=0;", "");
    }
    writeAliases(xw, aliases);

    xw.visitedNode = new Set();
    writeWalkEvents(xw, this.addressSpace, translationTable, events.slice(1));

    xw.endElement();
    xw.endDocument();
    return xw.toString();
};
