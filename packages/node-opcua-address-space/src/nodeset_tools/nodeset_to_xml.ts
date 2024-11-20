/* eslint-disable complexity */
/**
 * @module node-opcua-address-space
 */
// produce nodeset xml files
import { types } from "util";
import { assert } from "node-opcua-assert";
import { ObjectIds, VariableIds } from "node-opcua-constants";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import {
    BrowseDirection,
    LocalizedText,
    makeNodeClassMask,
    makeResultMask,
    NodeClass,
    makeAccessLevelFlag,
    QualifiedName
} from "node-opcua-data-model";
import { NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { lowerFirstLetter, isNullOrUndefined } from "node-opcua-utils";
import { Variant, VariantArrayType, DataType } from "node-opcua-variant";
import {
    IAddressSpace,
    BaseNode,
    UADataType,
    UAMethod,
    UAObject,
    UAReference,
    UAReferenceType,
    UAVariable,
    UAVariableType,
    UAView
} from "node-opcua-address-space-base";
import { AttributeIds, Int64, isMinDate, StatusCode } from "node-opcua-basic-types";
import { BrowseDescription, EnumDefinition, StructureDefinition, StructureType } from "node-opcua-types";

import { XmlWriter } from "../../source/xml_writer";
import { ReferenceImpl } from "../reference_impl";
import { BaseNodeImpl, getReferenceType } from "../base_node_impl";
import { UAReferenceTypeImpl } from "../ua_reference_type_impl";
import { UAObjectTypeImpl } from "../ua_object_type_impl";
import { UAVariableImpl } from "../ua_variable_impl";
import { UAObjectImpl } from "../ua_object_impl";
import { NamespaceImpl } from "../namespace_impl";
import { UAMethodImpl } from "../ua_method_impl";
import { UADataTypeImpl } from "../ua_data_type_impl";
import { UAVariableTypeImpl } from "../ua_variable_type_impl";
import { AddressSpace, SessionContext } from "../index_current";
import { UAViewImpl } from "../ua_view_impl";

import { DefinitionMap2 } from "../../source/loader/make_xml_extension_object_parser";
import { makeDefinitionMap } from "../../source/loader/decode_xml_extension_object";
import {
    _constructNamespaceTranslationTable,
    constructNamespaceDependency,
    constructNamespacePriorityTable
} from "./construct_namespace_dependency";
import { start } from "repl";

// tslint:disable:no-var-requires
const XMLWriter = require("xml-writer");

const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = false;

function _hash(node: BaseNode | UAReference): string {
    return node.nodeId.toString();
}

function _dumpDisplayName(xw: XmlWriter, node: BaseNode): void {
    if (node.displayName && node.displayName[0]) {
        xw.startElement("DisplayName").text(node.displayName[0].text!).endElement();
    }
}
function _dumpDescription(xw: XmlWriter, node: { description?: LocalizedText }): void {
    if (node.description && node.description.text && node.description.text.length) {
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

function _dumpReferences(xw: XmlWriter, node: BaseNode) {
    xw.startElement("References");

    const addressSpace = node.addressSpace;

    const aggregateReferenceType = addressSpace.findReferenceType("Aggregates")!;
    // const hasChildReferenceType = addressSpace.findReferenceType("HasChild")!;
    const hasSubtypeReferenceType = addressSpace.findReferenceType("HasSubtype")!;
    const hasTypeDefinitionReferenceType = addressSpace.findReferenceType("HasTypeDefinition")!;
    const nonHierarchicalReferencesType = addressSpace.findReferenceType("NonHierarchicalReferences")!;
    const organizesReferencesType = addressSpace.findReferenceType("Organizes")!;
    const connectsToReferenceType = addressSpace.findReferenceType("ConnectsTo")!;
    const hasEventSourceReferenceType = addressSpace.findReferenceType("HasEventSource")!;

    function referenceToKeep(reference: UAReference): boolean {
        const referenceType = (reference as ReferenceImpl)._referenceType!;
        const targetedNamespaceIndex = reference.nodeId.namespace;
        if (_hasHigherPriorityThan(xw, targetedNamespaceIndex, node.nodeId.namespace)) {
            // this reference has nothing to do here ! drop it
            // because the target namespace is higher in the hierarchy
            return false;
        }

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
            return true;
        } else if (referenceType.isSubtypeOf(hasSubtypeReferenceType) && !reference.isForward) {
            return true;
        } else if (referenceType.isSubtypeOf(hasTypeDefinitionReferenceType) && reference.isForward) {
            return true;
        } else if (referenceType.isSubtypeOf(nonHierarchicalReferencesType) && reference.isForward) {
            return true;
        } else if (referenceType.isSubtypeOf(organizesReferencesType) && !reference.isForward) {
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
    if (v.locale && v.locale.length) {
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
function initXmlWriterEx(xw: XmlWriter, map: Record<XmlNamespaceUri, XmlNs>, namespaceArray: NamespaceUri[]): void {
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
    // istanbul ignore next
    if (!namespace) {
        return "";
    }
    return namespace.replace(/\/$/, "") + "/Types.xsd";
}

function getPrefix(xw: XmlWriter, namespace: XmlNamespaceUri): XmlNs {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return "";
    const p = xwe.map[namespace] || "";
    return p ? p + ":" : "";
}

function restoreDefaultNamespace(xw: XmlWriter) {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return;
    xwe.map = xwe.stackMap.pop()!;
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

function startElementEx(xw: XmlWriter, ns: XmlNs, name: string, defaultNamespace: XmlNamespaceUri) {
    const xwe = xw as XmlWriterEx;
    xw.startElement(name);
    setDefaultNamespace(xw, defaultNamespace);
}

function _dumpNodeId(xw: XmlWriter, v: NodeId) {
    const xmlns = getPrefix(xw, "http://opcfoundation.org/UA/2008/02/Types.xsd");
    xw.startElement(`${xmlns}Identifier`);
    xw.text(n(xw, v));
    xw.endElement();
}

function _dumpVariantValue(
    xw: XmlWriter,
    dataTypeNodeId: NodeId,
    dataType: DataType,
    addressSpace: IAddressSpace,
    value: any
) {
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

    const isUnion = definition.structureType === StructureType.Union || definition.structureType === StructureType.UnionWithSubtypedValues;

    for (const field of definition.fields || []) {
        const dataTypeNodeId = field.dataType;

        const fieldName = field.name!;
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

            let fun: (value: any) => void = (value: any) => {
                /** */
            };
            if (definition instanceof StructureDefinition) {
                fun = _dumpVariantInnerExtensionObject.bind(null, xw, definitionMap, definition, addressSpace);
            } else if (definition instanceof EnumDefinition) {
                fun = _dumpVariantInnerValueEnum.bind(null, xw, definition);
            } else if (definition?.dataType == DataType.Variant) {
                fun = (value: Variant)=> {
                    
                    xw.startElement("Value");
                    _dumpVariantValue(xw, field.dataType, value.dataType, addressSpace, value.value);
                    xw.endElement();
                }
            } else {
                const baseType = definition.dataType;
                fun = _dumpVariantInnerValue.bind(null, xw, baseType, dataTypeNodeId, definitionMap, addressSpace);
            }
            try {
                if (field.valueRank === -1) {
                    fun(v);
                } else {
                    // array
                    for (const arrayItem of v as any[]) {
                        xw.startElement(name);
                        fun(arrayItem);
                        xw.endElement();
                    }
                }
            } catch (err) {
                // eslint-disable-next-line max-depth
                if (types.isNativeError(err)) {
                    errorLog("Error in _dumpVariantExtensionObjectValue_Body !!!", err.message);
                }
                debugLog(name);
                debugLog(field);
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

function _dumpVariantInnerValueEnum(xw: XmlWriter, definition: EnumDefinition, value: any): void {
    if (!definition.fields) {
        return;
    }
    const field = definition.fields.find((f) => f.value[1] === value || f.name === value);
    xw.text(`${field?.name}_${field?.value[1]}`);
}

// eslint-disable-next-line complexity
function _dumpVariantInnerValue(
    xw: XmlWriter,
    dataType: DataType,
    dataTypeNodeId: NodeId,
    definitionMap: DefinitionMap2,
    addressSpace: IAddressSpace,
    value: any
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
            xw.text(value.toISOString());
            break;
        case DataType.Int64:
        case DataType.UInt64:
            xw.text(value[1].toString());
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
            xw.text(value.toString());
            break;
        case DataType.ByteString:
            {
                const base64 = value.toString("base64");
                xw.text(base64.length > 80 ? base64.match(/.{0,80}/g).join("\n") : base64);
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
                xw.text(value.toString());
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
        case DataType.Variant:
            _dumpVariantInnerValue(xw, value.dataType, dataTypeNodeId, definitionMap, addressSpace, value.value);
            break;
        default:
            errorLog("_dumpVariantInnerValue incomplete " + value + " " + "DataType=" + dataType + "=" + DataType[dataType]);
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
function _dumpVariantExtensionObjectValue_Body(
    xw: XmlWriter,
    definitionMap: DefinitionMap2,
    name: string,
    definition: StructureDefinition,
    addressSpace: IAddressSpace,
    value: any
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
        {
            // find HasEncoding node
            // xx var encodingDefaultXml = schema.encodingDefaultXml;
            xw.startElement(`${uax}Identifier`);
            xw.text(n(xw, encodingDefaultXml));
            xw.endElement();
        }
        xw.endElement();
        startElementEx(xw, uax, "Body", "http://opcfoundation.org/UA/2008/02/Types.xsd");

        _dumpVariantExtensionObjectValue_Body(
            xw,
            definitionMap,
            name,
            definition as StructureDefinition,
            addressSpace,
            value);

        restoreDefaultNamespace(xw);
        xw.endElement();
    }
    restoreDefaultNamespace(xw);
    xw.endElement();
}

function _dumpVariantExtensionObjectValue2(xw: XmlWriter, addressSpace: IAddressSpace, value: ExtensionObject) {
    const dataTypeNodeId = value.schema.dataTypeNodeId;
    const definitionMap = makeDefinitionMap(addressSpace);
    const dataTypeNode = addressSpace.findDataType(dataTypeNodeId)!;
    if (!dataTypeNode) {
        warningLog("_dumpVariantExtensionObjectValue2: Cannot find dataType for  ", dataTypeNodeId.toString());
        return;
    }
    _dumpVariantExtensionObjectValue(xw, dataTypeNode.nodeId, definitionMap,addressSpace, value);
}

// eslint-disable-next-line complexity
function _isDefaultValue(value: Variant): boolean {
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

// eslint-disable-next-line max-statements
function _dumpValue(xw: XmlWriter, node: UAVariable | UAVariableType, variant: Variant) {
    const addressSpace = node.addressSpace;

    // istanbul ignore next
    if (variant === null || variant === undefined) {
        return;
    }
    assert(variant instanceof Variant);

    const dataTypeNode = addressSpace.findDataType(node.dataType);

    // istanbul ignore next
    if (!dataTypeNode) {
        debugLog("Cannot find dataType:", node.dataType.toString());
        return;
    }

    const dataTypeName = dataTypeNode.browseName.name!.toString();
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

function visitUANode(node: BaseNode, data: DumpData, forward: boolean) {
    const addressSpace = node.addressSpace;

    // visit references
    function process_reference(reference: UAReference) {
        //  only backward or forward references
        if (reference.isForward !== forward) {
            return;
        }

        if (reference.nodeId.namespace === 0) {
            return; // skip OPCUA namespace
        }
        const k = _hash(reference);
        if (!data.index_el[k]) {
            data.index_el[k] = 1;

            const o = addressSpace.findNode(k)! as BaseNode;
            if (o) {
                visitUANode(o, data, forward);
            }
        }
    }

    (node as BaseNodeImpl).ownReferences().forEach(process_reference);
    data.elements.push(node as BaseNodeImpl);
    return node;
}

function dumpNodeInXml(xw: XmlWriter, node: BaseNode) {
    return (node as BaseNodeImpl).dumpXML(xw);
}
function dumpReferencedNodes(xw: XmlWriter, node: BaseNode, forward: boolean) {
    const addressSpace = node.addressSpace;
    if (!forward) {
        {
            const r = node.findReferencesEx("HasTypeDefinition");
            if (r && r.length) {
                assert(r.length === 1);
                const typeDefinitionObj = ReferenceImpl.resolveReferenceNode(addressSpace, r[0])! as BaseNode;
                if (!typeDefinitionObj) {
                    warningLog(node.toString());
                    warningLog(
                        "dumpReferencedNodes: Warning : " + node.browseName.toString() + " unknown typeDefinition, ",
                        r[0].toString()
                    );
                } else {
                    assert(typeDefinitionObj instanceof BaseNodeImpl);
                    if (typeDefinitionObj.nodeId.namespace === node.nodeId.namespace) {
                        // only output node if it is on the same namespace
                        if (!xw.visitedNode.has(_hash(typeDefinitionObj))) {
                            dumpNodeInXml(xw, typeDefinitionObj);
                        }
                    }
                }
            }
        }

        //
        {
            const r = node.findReferencesEx("HasSubtype", BrowseDirection.Inverse);
            if (r && r.length) {
                const subTypeOf = ReferenceImpl.resolveReferenceNode(addressSpace, r[0])! as BaseNode;
                assert(r.length === 1);
                if (subTypeOf.nodeId.namespace === node.nodeId.namespace) {
                    // only output node if it is on the same namespace
                    if (!xw.visitedNode.has(_hash(subTypeOf))) {
                        dumpNodeInXml(xw, subTypeOf);
                    }
                }
            }
        }
    } else {
        const r = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
        for (const reference of r) {
            const nodeChild = ReferenceImpl.resolveReferenceNode(addressSpace, reference) as BaseNode;
            assert(nodeChild instanceof BaseNodeImpl);
            if (nodeChild.nodeId.namespace === node.nodeId.namespace) {
                if (!xw.visitedNode.has(_hash(nodeChild))) {
                    debugLog(
                        node.nodeId.toString(),
                        " dumping child ",
                        nodeChild.browseName.toString(),
                        nodeChild.nodeId.toString()
                    );
                    dumpNodeInXml(xw, nodeChild);
                }
            }
        }
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
    if (Object.prototype.hasOwnProperty.call(node, "symbolicName")) {
        xw.writeAttribute("SymbolicName", (node as any).symbolicName);
    }
    if (Object.prototype.hasOwnProperty.call(node, "isAbstract")) {
        if ((node as any).isAbstract) {
            xw.writeAttribute("IsAbstract", (node as any).isAbstract ? "true" : "false");
        }
    }
    if (Object.prototype.hasOwnProperty.call(node, "accessLevel")) {
        // CurrentRead is by default
        if ((node as UAVariable).accessLevel !== currentReadFlag) {
            xw.writeAttribute("AccessLevel", (node as UAVariable).accessLevel.toString());
        }
    }
    if (Object.prototype.hasOwnProperty.call(node, "minimumSamplingInterval")) {
        const minimumSamplingInterval = (node as UAVariable).minimumSamplingInterval;
        if (minimumSamplingInterval > 0) {
            xw.writeAttribute("MinimumSamplingInterval", minimumSamplingInterval);
        }
    }
}

function dumpCommonElements(xw: XmlWriter, node: BaseNode) {
    _dumpDisplayName(xw, node);
    _dumpDescription(xw, node);
    _dumpReferences(xw, node);
}

function coerceInt64ToInt32(int64: Int64): number {
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

    for (const defItem of enumDefinition.fields!) {
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
        xw.writeAttribute("Name", defItem.name!);

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
function _dumpEncodings(xw: XmlWriter, uaDataType: UADataType) {
    const encodings = uaDataType.findReferencesExAsObject("HasEncoding", BrowseDirection.Forward);
    for (const uaEncoding of encodings) {
        if (uaEncoding.nodeClass !== NodeClass.Object) {
            continue;
        }
        _dumpEncoding(xw, uaEncoding as UAObject);
    }
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

        if (true || dataValue.statusCode.isGood()) {
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

    dumpAggregates(xw, node);
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

    _dumpEncodings(xw, node);

    dumpAggregates(xw, node);
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

    dumpReferencedNodes(xw, node, false);

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

    dumpAggregates(xw, node);
}

function dumpUAVariableType(xw: XmlWriter, node: UAVariableType) {
    assert(node.nodeClass === NodeClass.VariableType);
    xw.visitedNode = xw.visitedNode || new Set();
    assert(!xw.visitedNode.has(_hash(node)));
    xw.visitedNode.add(_hash(node));

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

    dumpAggregates(xw, node);
}

function dumpUAObject(xw: XmlWriter, node: UAObject) {
    xw.writeComment("Object - " + b(xw, node.browseName) + " {{{{ ");
    _dumpUAObject(xw, node);
    xw.writeComment("Object - " + b(xw, node.browseName) + " }}}} ");
}

function _dumpUAObject(xw: XmlWriter, node: UAObject) {
    assert(node.nodeClass === NodeClass.Object);
    xw.visitedNode = xw.visitedNode || new Set();
    assert(!xw.visitedNode.has(_hash(node)));
    xw.visitedNode.add(_hash(node));

    // dump SubTypeOf and HasTypeDefinition
    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAObject");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    // dump aggregates nodes ( Properties / components )

    dumpAggregates(xw, node);

    dumpElementInFolder(xw, node as UAObjectImpl);
}
function dumpElementInFolder(xw: XmlWriter, node: BaseNodeImpl) {
    const aggregates = node
        .getFolderElements()
        .sort((x: BaseNode, y: BaseNode) => (x.browseName.name!.toString() > y.browseName.name!.toString() ? 1 : -1));
    for (const aggregate of aggregates.sort(sortByNodeId)) {
        // do not export node that do not belong to our namespace
        if (node.nodeId.namespace !== aggregate.nodeId.namespace) {
            return;
        }

        if (!xw.visitedNode.has(_hash(aggregate))) {
            aggregate.dumpXML(xw);
        }
    }
}

function dumpAggregates(xw: XmlWriter, node: BaseNode) {
    // Xx xw.writeComment("Aggregates {{ ");
    const aggregates = node.getAggregates().sort(sortByBrowseName);
    // const aggregates = node.findReferencesExAsObject("Aggregates", BrowseDirection.Forward);

    for (const aggregate of aggregates.sort(sortByNodeId)) {
        // do not export node that do not belong to our namespace
        if (node.nodeId.namespace !== aggregate.nodeId.namespace) {
            continue;
        }
        // even further! we should export here the children
        // that have been added later by a namespace with higher index
        if (_hasHigherPriorityThan(xw, aggregate.nodeId.namespace, node.nodeId.namespace)) {
            continue;
        }
        if (!xw.visitedNode.has(_hash(aggregate))) {
            (<BaseNodeImpl>aggregate).dumpXML(xw);
        }
    }
    // Xx xw.writeComment("Aggregates }} ");
}

function dumpUAObjectType(xw: XmlWriter, node: UAObjectTypeImpl) {
    assert(node.nodeClass === NodeClass.ObjectType);
    assert(node instanceof UAObjectTypeImpl);
    xw.writeComment("ObjectType - " + b(xw, node.browseName) + " {{{{ ");
    _markAsVisited(xw, node);

    // dump SubtypeOf and HasTypeDefinition node if part of the same namespace
    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAObjectType");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    dumpAggregates(xw, node);

    xw.writeComment("ObjectType - " + b(xw, node.browseName) + " }}}}");
}

function dumpUAMethod(xw: XmlWriter, node: UAMethod) {
    assert(node.nodeClass === NodeClass.Method);
    _markAsVisited(xw, node);

    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAMethod");
    dumpCommonAttributes(xw, node);
    if (node.methodDeclarationId) {
        xw.writeAttribute("MethodDeclarationId", n(xw, node.methodDeclarationId));
    }
    dumpCommonElements(xw, node);
    xw.endElement();

    dumpAggregates(xw, node);
}
function resolveDataTypeName(addressSpace: IAddressSpace, dataType: string | NodeId): QualifiedName {
    let dataTypeNode = null;
    // istanbul ignore next
    if (typeof dataType === "string") {
        dataTypeNode = addressSpace.findDataType(dataType);
    } else {
        assert(dataType instanceof NodeId);
        const o = addressSpace.findNode(dataType.toString());
        dataTypeNode = o ? o : null;
    }
    if (!dataTypeNode) {
        errorLog("resolveDataTypeName: warning cannot find DataType " + dataType.toString());
        return new QualifiedName({ name: "", namespaceIndex: 0 });
    }
    return dataTypeNode.browseName;
}

function buildUpAliases(node: BaseNode, xw: XmlWriter, data: BuildAliasesData) {
    const addressSpace = node.addressSpace;

    if (!data.aliases_visited) data.aliases_visited = new Set();

    const k = _hash(node);
    // istanbul ignore next
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
        xw.text(referenceType.inverseName!.text || "");
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

interface Dumpable {
    dumpXML(xw: typeof XMLWriter): void;
}
type NodeIdString = string;

export interface BuildAliasesData {
    aliases: Record<string, NodeIdString>;
    aliases_visited?: Set<string>;
}
interface DumpData extends BuildAliasesData {
    elements: Dumpable[];
    index_el: Record<string, number>;
}

export interface DumpXMLOptions {
    /** */
}

UAMethodImpl.prototype.dumpXML = function (xw) {
    dumpUAMethod(xw, this);
};

UAObjectImpl.prototype.dumpXML = function (xw) {
    dumpUAObject(xw, this);
};
UAVariableImpl.prototype.dumpXML = function (xw: XmlWriter) {
    dumpUAVariable(xw, this);
};
UAVariableTypeImpl.prototype.dumpXML = function (xw) {
    dumpUAVariableType(xw, this);
};
UAReferenceTypeImpl.prototype.dumpXML = function (xw: XmlWriter) {
    dumpReferenceType(xw, this);
};
UAObjectTypeImpl.prototype.dumpXML = function (xw) {
    dumpUAObjectType(xw, this);
};
UADataTypeImpl.prototype.dumpXML = function (xw: XmlWriter) {
    dumpUADataType(xw, this);
};

UAViewImpl.prototype.dumpXML = function (xw: XmlWriter) {
    dumpUAView(xw, this);
};

function makeTypeXsd(namespaceUri: string): string {
    return namespaceUri.replace(/\/$/, "") + "/Type.xsd";
}

// eslint-disable-next-line max-statements
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
    // xx xw.writeAttribute("Version", "1.02");
    // xx xw.writeAttribute("LastModified", (new Date()).toISOString());

    // ------------- INamespace Uris
    initXmlWriterEx(xw, namespacesMap, namespaceArray);

    xw.startElement("NamespaceUris");

    // let's sort the dependencies in the same order as the translation table
    const sortedDependencies = dependency.sort(
        (a, b) => 
            (translationTable.get(a.index)! > translationTable.get(b.index)! ? 1 : -1));

    doDebug && debugLog(sortedDependencies.map((a) => a.index + " + " + a.namespaceUri).join("\n"));
    doDebug && debugLog("translation table ", translationTable.entries());

    for (const depend of sortedDependencies) {
        if (depend.index === 0) {
            continue; // ignore namespace 0
        }
        xw.startElement("Uri");
        xw.text(depend.namespaceUri);
        xw.endElement();
    }
    xw.endElement();

    // ------------- INamespace Uris
    xw.startElement("Models");
    {
        xw.startElement("Model");
        xw.writeAttribute("ModelUri", this.namespaceUri);
        xw.writeAttribute("Version", this.version);
        xw.writeAttribute("PublicationDate", this.publicationDate.toISOString());
        for (const depend of sortedDependencies) {
            if (depend.index === this.index) {
                continue; // ignore our namespace 0
            }
            xw.startElement("RequiredModel");
            xw.writeAttribute("ModelUri", depend.namespaceUri);
            xw.writeAttribute("Version", depend.version);
            xw.writeAttribute("PublicationDate", depend.publicationDate.toISOString());
            xw.endElement();
        }
        xw.endElement();
    }
    xw.endElement();

    const data: BuildAliasesData = { aliases: {} };
    for (const node of this.nodeIterator()) {
        buildUpAliases(node, xw, data);
    }
    writeAliases(xw, data.aliases);

    xw.visitedNode = new Set();

    // -------------- writeReferences
    xw.writeComment("ReferenceTypes");
    const referenceTypes = [...this._referenceTypeIterator()].sort(sortByBrowseName);
    for (const referenceType of referenceTypes) {
        dumpReferenceType(xw, referenceType);
    }

    // -------------- Dictionaries
    const addressSpace = this.addressSpace;

    const getDataTypeDescription = (opcBinaryTypeSystem: UAObject) => {
        const nodeToBrowse = new BrowseDescription({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: false,
            nodeClassMask: makeNodeClassMask("Variable"),
            nodeId: opcBinaryTypeSystem.nodeId,
            referenceTypeId: resolveNodeId("HasComponent"),
            resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
        });
        const result = opcBinaryTypeSystem.browseNode(nodeToBrowse).filter((r) => r.nodeId.namespace === this.index);
        assert(result.length <= 1);
        return result;
    };

    // -------------- DataTypes
    const dataTypes = [...this._dataTypeIterator()].sort(sortByBrowseName);
    if (dataTypes.length) {
        xw.writeComment("DataTypes");
        // xx xw.writeComment(" "+ objectTypes.map(x=>x.browseName.name.toString()).join(" "));
        for (const dataType of dataTypes.sort(sortByNodeId)) {
            if (!xw.visitedNode.has(_hash(dataType))) {
                dumpNodeInXml(xw, dataType);
            }
        }

        // --------------
        const opcBinaryTypeSystem = addressSpace.findNode(ObjectIds.OPCBinarySchema_TypeSystem) as UAObject;
        const opcXmlSchemaTypeSystem = addressSpace.findNode(ObjectIds.XmlSchema_TypeSystem) as UAObject;

        if (opcBinaryTypeSystem) {
            // let find all DataType dictionary node corresponding to a given namespace
            // (have DataTypeDictionaryType)
            const result = getDataTypeDescription(opcBinaryTypeSystem);
            if (result.length === 1) {
                xw.writeComment("DataSystem - Binary");
                const dataSystemType = addressSpace.findNode(result[0].nodeId)! as UAVariable;
                const types = dataSystemType.getComponents();
                for (const f of types) {
                    dumpNodeInXml(xw, f);
                }
                dumpNodeInXml(xw, dataSystemType);
            }
        }

        if (opcXmlSchemaTypeSystem) {
            const result = getDataTypeDescription(opcXmlSchemaTypeSystem);
            if (result.length === 1) {
                xw.writeComment("DataSystem - Xml");
                const dataSystemType = addressSpace.findNode(result[0].nodeId)! as UAVariable;

                const types = dataSystemType.getComponents();
                for (const f of types) {
                    dumpNodeInXml(xw, f);
                }

                dumpNodeInXml(xw, dataSystemType);
            }
        }
    }

    // -------------- ObjectTypes
    xw.writeComment("ObjectTypes");
    const objectTypes = [...this._objectTypeIterator()].sort(sortByBrowseName);
    // xx xw.writeComment(" "+ objectTypes.map(x=>x.browseName.name.toString()).join(" "));
    for (const objectType of objectTypes.sort(sortByNodeId)) {
        if (!xw.visitedNode.has(_hash(objectType))) {
            dumpNodeInXml(xw, objectType);
        }
    }

    // -------------- VariableTypes
    xw.writeComment("VariableTypes");
    const variableTypes = [...this._variableTypeIterator()].sort(sortByBrowseName);
    // xx xw.writeComment("ObjectTypes "+ variableTypes.map(x=>x.browseName.name.toString()).join(" "));
    for (const variableType of variableTypes.sort(sortByNodeId)) {
        if (!xw.visitedNode.has(_hash(variableType))) {
            dumpNodeInXml(xw, variableType);
        }
    }

    // -------------- Any   thing else
    xw.writeComment("Other Nodes");
    const nodes = [...this.nodeIterator()].sort(sortByBrowseName);
    for (const node of nodes.sort(sortByNodeId)) {
        if (!xw.visitedNode.has(_hash(node))) {
            dumpNodeInXml(xw, node);
        }
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
};
