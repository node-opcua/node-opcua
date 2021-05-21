/**
 * @module node-opcua-address-space
 */
// produce nodeset xml files
import { AddressSpacePrivate } from "../address_space_private";

// tslint:disable:no-var-requires
const XMLWriter = require("xml-writer");
import { assert } from "node-opcua-assert";
import {
    BrowseDirection,
    LocalizedText,
    makeNodeClassMask,
    makeResultMask,
    NodeClass,
    makeAccessLevelFlag
} from "node-opcua-data-model";
import { QualifiedName } from "node-opcua-data-model";
import { getStructureTypeConstructor, StructuredTypeField, StructuredTypeSchema, hasStructuredType } from "node-opcua-factory";
import { getStructuredTypeSchema } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import * as utils from "node-opcua-utils";
import { Variant } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

import { Namespace, XmlWriter } from "../../source";

import { Int64, minOPCUADate } from "node-opcua-basic-types";
import { BrowseDescription, EnumDefinition, StructureDefinition, StructureField, StructureType } from "node-opcua-types";
import { BaseNode } from "../base_node";
import { UANamespace } from "../namespace";
import { NamespacePrivate } from "../namespace_private";
import { Reference } from "../reference";
import { UADataType } from "../ua_data_type";
import { UAMethod } from "../ua_method";
import { UAObject } from "../ua_object";
import { UAObjectType } from "../ua_object_type";
import { UAReferenceType } from "../ua_reference_type";
import { UAVariable } from "../ua_variable";
import { UAVariableType } from "../ua_variable_type";
import { constructNamespaceDependency } from "./construct_namespace_dependency";
import { ExtensionObject } from "node-opcua-extension-object";
import { make_debugLog, make_errorLog } from "node-opcua-debug";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

function _hash(node: BaseNode | Reference): string {
    return node.nodeId.toString();
}

function _dumpDisplayName(xw: XmlWriter, node: BaseNode): void {
    if (node.displayName && node.displayName[0]) {
        xw.startElement("DisplayName").text(node.displayName[0].text!).endElement();
    }
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

        // get the direct backward reference to a external namespace
        if (referenceType.isSupertypeOf(aggregateReferenceType) && !reference.isForward) {
            if (reference.nodeId.namespace !== node.nodeId.namespace) {
                // todo: may be check that reference.nodeId.namespace is one of the namespace
                // on which our namespace is build and not a derived one !
                // xx console.log("xxxxxxxxxxxxxx Keeping => ", referenceType.toString(), reference.node?.nodeId.toString());
                return true;
            }
        }

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
        } else if (connectsToReferenceType && referenceType.isSupertypeOf(connectsToReferenceType) && reference.isForward) {
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
function _dumpLocalizedText(xw: XmlWriter, v: LocalizedText) {
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
}
function _dumpQualifiedName(xw: XmlWriter, v: QualifiedName) {

    const t = translateBrowseName(xw, v);
    if (t.name) {
        xw.startElement("Name");
        xw.text(t.name);
        xw.endElement();
    }
    if (t.namespaceIndex) {
        xw.startElement("NamespaceIndex");
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

function _dumpExtensionObject(xw: XmlWriter, v: ExtensionObject) {
    if (!v) {
        return;
    }
    xw.startElement("TypeId");
    _dumpNodeId(xw, v.schema.encodingDefaultXml!);
    xw.endElement();
    xw.startElement("Body");

    xw.endElement();
}
function _dumpNodeId(xw: XmlWriter, v: NodeId) {
    xw.startElement("Identifier");
    xw.text(v.toString());
    xw.endElement();
}

// tslint:disable:no-console
function _dumpVariantValue(xw: XmlWriter, dataType: DataType, value: any) {
    if (value === undefined || value === null) {
        return;
    }
    switch (dataType) {
        case DataType.Null:
            break;
        case DataType.LocalizedText:
            xw.startElement(DataType[dataType]);
            // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            _dumpLocalizedText(xw, value as LocalizedText);
            xw.endElement();
            break;
        case DataType.NodeId:
            xw.startElement(DataType[dataType]);
            // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            _dumpNodeId(xw, value as NodeId);
            xw.endElement();
            break;
        case DataType.DateTime:
            xw.startElement(DataType[dataType]);
            // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            xw.text(value.toISOString());
            xw.endElement();
            break;
        case DataType.Int64:
        case DataType.UInt64:
            xw.startElement(DataType[dataType]);
            // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            xw.text(value[1].toString());
            xw.endElement();
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
            if (value !== undefined && value !== null) {
                xw.startElement(DataType[dataType]);
                // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
                xw.text(value.toString());
                xw.endElement();
            }
            break;
        case DataType.ByteString:
            if (value !== undefined && value !== null) {
                xw.startElement(DataType[dataType]);
                // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
                const base64 = value.toString("base64");
                xw.text(base64.match(/.{0,80}/g).join("\n"));
                xw.endElement();
            }
            break;
        case DataType.Guid:
            /*
             <uax:Guid>
                <uax:String>947c29a7-490d-4dc9-adda-1109e3e8fcb7</uax:String>
            </uax:Guid>
            */
            if (value !== undefined && value !== null) {
                xw.startElement(DataType[dataType]);
                // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
                xw.startElement("String");
                xw.text(value.toString());
                xw.endElement();
                xw.endElement();
            }
            break;
        case DataType.ExtensionObject:
            xw.startElement(DataType[dataType]);
            _dumpExtensionObject(xw, value as ExtensionObject);
            xw.endElement();
            break;
        case DataType.QualifiedName:
            xw.startElement(DataType[dataType]);
            // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            _dumpQualifiedName(xw, value as QualifiedName);
            xw.endElement();
            break;
        case DataType.XmlElement:
            xw.startElement(DataType[dataType]);
            // xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            _dumpXmlElement(xw, value as string);
            xw.endElement();
            break;

        case DataType.StatusCode:
        default:
            errorLog( "_dumpVariantValue!! incomplete  dataType=" + dataType + " - v=" + DataType[dataType] + "  value = " + value);
            /*
            throw new Error(
                "_dumpVariantValue!! incomplete  dataType=" + dataType + " - v=" + DataType[dataType] + "  value = " + value
            );
            */
    }
}

// tslint:disable:no-console
function _dumpVariantInnerValue(xw: XmlWriter, dataType: DataType, value: any) {
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
        case DataType.StatusCode:
        default:
            errorLog("_dumpVariantInnerValue incomplete " + value + " " + "DataType=" + dataType + "=" + DataType[dataType]);
            //  throw new Error("_dumpVariantInnerValue incomplete " + value + " " + "DataType=" + dataType + "=" + DataType[dataType]);
    }
}

/**
 *
 * @param field
 */
function findBaseDataType(field: StructuredTypeField): DataType {
    if (field.fieldType === "UAString") {
        return DataType.String;
    }
    const result = (DataType as any)[field.fieldType] as DataType;
    if (!result) {
        throw new Error("cannot find baseDataType of " + field.name + "= " + field.fieldType);
    }
    return result;
}

/**
 *
 * @param xw
 * @param schema
 * @param value
 * @private
 */
function _dumpVariantExtensionObjectValue_Body(xw: XmlWriter, schema: StructuredTypeSchema, value: any) {
    if (value) {
        xw.startElement(schema.name);
        if (value) {
            for (const field of schema.fields) {
                const v = value[field.name];
                if (v !== null && v !== undefined) {
                    xw.startElement(utils.capitalizeFirstLetter(field.name));
                    try {
                        const baseType = findBaseDataType(field);
                        _dumpVariantInnerValue(xw, baseType, v);
                    } catch (err) {
                        console.log("Error in _dumpVariantExtensionObjectValue_Body !!!", err.message);
                        console.log(schema.name);
                        console.log(field);
                        // throw err;
                    }
                    xw.endElement();
                }
            }
        }
        xw.endElement();
    }
}
/* encode object as XML */
function _dumpVariantExtensionObjectValue(xw: XmlWriter, schema: StructuredTypeSchema, value: any) {
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
                if (!value.value || value.value.getTime() === minOPCUADate) {
                    return true;
                }
                break;
            case DataType.ByteString:
                if (!value.value || value.value.length === 0) {
                    return true;
                }
                break;
            case DataType.Boolean:
                if (!value.value) {
                    return true;
                }
                break;
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
            case DataType.UInt64:
            case DataType.UInt64:
                if (0 === coerceInt64ToInt32(value.value)) {
                    return true;
                }
                break;
            case DataType.LocalizedText:
                if (!value.value) {
                    return true;
                }
                const l = value.value as LocalizedText;
                if (!l.locale && !l.text) {
                    return true;
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
function _dumpValue(xw: XmlWriter, node: UAVariable | UAVariableType, value: Variant) {
    const addressSpace = node.addressSpace;

    // istanbul ignore next
    if (value === null || value === undefined) {
        return;
    }
    assert(value instanceof Variant);

    const dataTypeNode = addressSpace.findNode(node.dataType);
    if (!dataTypeNode) {
        console.log("Cannot find dataType:", node.dataType);
        return;
    }
    const dataTypeName = dataTypeNode.browseName.name!.toString();

    const baseDataTypeName = DataType[value.dataType];

    if (baseDataTypeName === "Null") {
        return;
    }
    assert(typeof baseDataTypeName === "string");

    // determine if dataTypeName is a ExtensionObject
    const isExtensionObject = value.dataType === DataType.ExtensionObject;

    if (_isDefaultValue(value)) {
        return;
    }
    xw.startElement("Value");

    if (isExtensionObject) {
        if (hasStructuredType(dataTypeName)) {
            const schema = getStructuredTypeSchema(dataTypeName);
            const encodeXml = _dumpVariantExtensionObjectValue.bind(null, xw, schema);
            if (value.arrayType === VariantArrayType.Array) {
                xw.startElement("ListOf" + baseDataTypeName);
                value.value.forEach(encodeXml);
                xw.endElement();
            } else if (value.arrayType === VariantArrayType.Scalar) {
                encodeXml(value.value);
            } else {
                errorLog(node.toString());
                errorLog("_dumpValue : unsupported case , Matrix of ExtensionObjects")
                // throw new Error("Unsupported case");
            }
        }
    } else {
        const encodeXml = _dumpVariantValue.bind(null, xw, value.dataType);
        if (value.arrayType === VariantArrayType.Matrix) {
            console.log("Warning _dumpValue : Matrix not supported yet");
            xw.startElement("ListOf" + dataTypeName);
            xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            value.value.forEach(encodeXml);
            xw.endElement();
        } else if (value.arrayType === VariantArrayType.Array) {
            xw.startElement("ListOf" + dataTypeName);
            xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");
            value.value.forEach(encodeXml);
            xw.endElement();
        } else if (value.arrayType === VariantArrayType.Scalar) {
            encodeXml(value.value);
        } else {
            errorLog(node.toString());
            errorLog("_dumpValue : unsupported case , Matrix");
            // xx throw new Error("Unsupported case");
        }
    }

    xw.endElement();
}

function _dumpArrayDimensionsAttribute(xw: XmlWriter, node: UAVariableType | UAVariable) {
    if (node.arrayDimensions) {
        if (node.arrayDimensions.length === 1 && node.arrayDimensions[0] === 0) {
            return;
        }
        xw.writeAttribute("ArrayDimensions", node.arrayDimensions.join(","));
    }
}

function visitUANode(node: BaseNode, options: any, forward: boolean) {
    assert(typeof forward === "boolean");

    const addressSpace = node.addressSpace;
    options.elements = options.elements || [];
    options.index_el = options.index_el || {};

    // visit references
    function process_reference(reference: Reference) {
        //  only backward or forward references
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

    node.ownReferences().forEach(process_reference);
    options.elements.push(node);
    return node;
}

function dumpReferencedNodes(xw: XmlWriter, node: BaseNode, forward: boolean) {
    const addressSpace = node.addressSpace;
    if (!forward) {
        {
            const r = node.findReferencesEx("HasTypeDefinition");
            if (r && r.length) {
                assert(r.length === 1);
                const typeDefinitionObj = Reference.resolveReferenceNode(addressSpace, r[0])! as BaseNode;
                if (!typeDefinitionObj) {
                    console.log(node.toString());
                    console.log("Warning : " + node.browseName.toString() + " unknown typeDefinition, ", r[0].toString());
                } else {
                    assert(typeDefinitionObj instanceof BaseNode);
                    if (typeDefinitionObj.nodeId.namespace === node.nodeId.namespace) {
                        // only output node if it is on the same namespace
                        if (!xw.visitedNode[_hash(typeDefinitionObj)]) {
                            typeDefinitionObj.dumpXML(xw);
                        }
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
                    console.log(
                        node.nodeId.toString(),
                        " dumping child ",
                        nodeChild.browseName.toString(),
                        nodeChild.nodeId.toString()
                    );
                    nodeChild.dumpXML(xw);
                }
            }
        }
    }
}

const currentReadFlag = makeAccessLevelFlag("CurrentRead");
function dumpCommonAttributes(xw: XmlWriter, node: BaseNode) {
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
    if (node.hasOwnProperty("accessLevel")) {
        // CurrentRead is by default
        if ((node as UAVariable).accessLevel !== currentReadFlag) {
            xw.writeAttribute("AccessLevel", (node as UAVariable).accessLevel.toString());
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
    if (int64[0] === 4294967295 && int64[1] === 4294967295) {
        return 0xffffffff;
    }
    if (int64[0] !== 0) {
        debugLog("coerceInt64ToInt32 , loosing high word in conversion");
    };
    return int64[1];
}

function _dumpEnumDefinition(xw: XmlWriter, enumDefinition: EnumDefinition) {
    enumDefinition.fields = enumDefinition.fields || [];

    for (const defItem of enumDefinition.fields!) {
        xw.startElement("Field");
        xw.writeAttribute("Name", defItem.name as string);
        if (!utils.isNullOrUndefined(defItem.value)) {
            xw.writeAttribute("Value", coerceInt64ToInt32(defItem.value));
        }
        if (defItem.description && defItem.description.text) {
            xw.startElement("Description");
            xw.text(defItem.description.text.toString());
            xw.endElement();
        }
        xw.endElement();
    }
}
function _dumpStructureDefinition(xw: XmlWriter, structureDefinition: StructureDefinition) {
    /*
     * note: baseDataType and defaultEncodingId are implicit and not stored in the XML file ??
     *
     */
    const baseDataType = structureDefinition.baseDataType;
    const defaultEncodingId = structureDefinition.defaultEncodingId;

    structureDefinition.fields = structureDefinition.fields || [];
    for (const defItem /*: StructureField*/ of structureDefinition.fields) {
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
        if (defItem.description && defItem.description.text) {
            xw.startElement("Description");
            xw.text(defItem.description.text.toString());
            xw.endElement();
        }
        xw.endElement();
    }
}
function _dumpUADataTypeDefinition(xw: XmlWriter, node: UADataType) {
    
    // to do remove DataType from base class

    const definition = node._getDefinition(false);
    if (!definition) {
        return;
    }
    if (definition instanceof EnumDefinition) {
        xw.startElement("Definition");
        xw.writeAttribute("Name", node.browseName.name!);
        _dumpEnumDefinition(xw, definition);
        xw.endElement();
        return;
    }
    if (definition instanceof StructureDefinition) {
        xw.startElement("Definition");
        xw.writeAttribute("Name", node.browseName.name!);
        if (definition.structureType === StructureType.Union) {
            xw.writeAttribute("IsUnion", "true");
        }
        _dumpStructureDefinition(xw, definition);
        xw.endElement();
        return;
    }
    // throw new Error("_dumpUADataTypeDefinition: Should not get here !");
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

    _dumpDisplayName(xw, node);

    _dumpReferences(xw, node);

    _dumpUADataTypeDefinition(xw, node);

    xw.endElement();

    dumpAggregates(xw, node);
}

UADataType.prototype.dumpXML = function (xw: XmlWriter) {
    dumpUADataType(xw, this);
};

function _markAsVisited(xw: XmlWriter, node: BaseNode) {
    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;
}

function dumpUAVariable(xw: XmlWriter, node: UAVariable) {
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
        _dumpValue(xw, node, node.readValue().value);
    }
    xw.endElement();

    dumpAggregates(xw, node);
}

UAVariable.prototype.dumpXML = function (xw) {
    dumpUAVariable(xw, this);
};

UAReferenceType.prototype.dumpXML = function (xw) {
    dumpReferenceType(xw, this);
};

function dumpUAVariableType(xw: XmlWriter, node: UAVariableType) {
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
            console.log(
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
        _dumpValue(xw, node, node.value);
    }

    xw.endElement();

    dumpAggregates(xw, node);
}

UAVariableType.prototype.dumpXML = function (xw) {
    dumpUAVariableType(xw, this);
};

function dumpUAObject(xw: XmlWriter, node: UAObject) {
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

UAObject.prototype.dumpXML = function (xw) {
    dumpUAObject(xw, this);
};

function dumpElementInFolder(xw: XmlWriter, node: BaseNode) {
    const aggregates = node
        .getFolderElements()
        .sort((x: BaseNode, y: BaseNode) => (x.browseName.name!.toString() > y.browseName.name!.toString() ? 1 : -1));
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

function dumpAggregates(xw: XmlWriter, node: BaseNode) {
    // Xx xw.writeComment("Aggregates {{ ");
    const aggregates = node
        .getAggregates()
        .sort((x: BaseNode, y: BaseNode) => (x.browseName.name!.toString() > y.browseName.name!.toString() ? 1 : -1));
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

function dumpUAObjectType(xw: XmlWriter, node: UAObjectType) {
    assert(node instanceof UAObjectType);
    xw.writeComment("ObjectType - " + b(xw, node.browseName) + " {{{{ ");
    _markAsVisited(xw, node);

    // dump SubtypeOf and HasTypeDefinition
    dumpReferencedNodes(xw, node, false);

    xw.startElement("UAObjectType");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    dumpAggregates(xw, node);

    xw.writeComment("ObjectType - " + b(xw, node.browseName) + " }}}}");
}

UAObjectType.prototype.dumpXML = function (xw) {
    dumpUAObjectType(xw, this);
};

function dumpUAMethod(xw: XmlWriter, node: UAMethod) {
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

UAMethod.prototype.dumpXML = function (xw) {
    dumpUAMethod(xw, this);
};

function resolveDataTypeName(addressSpace: AddressSpacePrivate, dataType: string | NodeId): QualifiedName {
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
        throw new Error("Cannot find dataTypeName " + dataType);
    }
    return dataTypeNode.browseName;
}

function buildUpAliases(node: BaseNode, xw: XmlWriter, options: any) {
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
        const nodeV = node as UAVariableType | UAVariable;

        if (nodeV.dataType && nodeV.dataType.namespace === 0 && nodeV.dataType.value !== 0) {
            // name
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, nodeV.dataType));
            if (dataTypeName) {
                if (!options.aliases[dataTypeName]) {
                    options.aliases[dataTypeName] = n(xw, nodeV.dataType);
                }
            }
        }

        if (nodeV.dataType && nodeV.dataType.namespace !== 0 && nodeV.dataType.value !== 0) {
            // name
            const dataTypeName = b(xw, resolveDataTypeName(addressSpace, nodeV.dataType));
            if (dataTypeName) {
                if (!options.aliases[dataTypeName]) {
                    options.aliases[dataTypeName] = n(xw, nodeV.dataType);
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

    node.allReferences().forEach(collectReferenceNameInAlias);
}

function writeAliases(xw: XmlWriter, aliases: any) {
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
interface ITranslationTable {
    [key: number]: number;
}

function constructNamespaceTranslationTable(dependency: Namespace[]): ITranslationTable {
    const translationTable: ITranslationTable = {};
    for (let i = 0; i < dependency.length; i++) {
        translationTable[dependency[i].index] = i;
    }
    return translationTable;
}

function dumpReferenceType(xw: XmlWriter, referenceType: UAReferenceType) {
    _markAsVisited(xw, referenceType);

    xw.startElement("UAReferenceType");

    dumpCommonAttributes(xw, referenceType);

    dumpCommonElements(xw, referenceType);

    if (referenceType.inverseName /* LocalizedText*/) {
        xw.startElement("InverseName");
        xw.text(referenceType.inverseName!.text || "");
        xw.endElement();
    }

    xw.endElement();
}

function sortByBrowseName(x: BaseNode, y: BaseNode): number {
    const x_str = x.browseName.toString();
    const y_str = y.browseName.toString();
    if (x_str > y_str) {
        return -1;
    } else if (x_str < y_str) {
        return 1;
    }
    return 0;
}

export function dumpXml(node: BaseNode, options: any) {
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
    xw.writeAttribute("LastModified", new Date().toISOString());
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

UANamespace.prototype.toNodeset2XML = function (this: UANamespace) {
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
        if (depend.index === 0) {
            continue; // ignore namespace 0
        }
        xw.startElement("Uri");
        xw.text(depend.namespaceUri);
        xw.endElement();
    }

    xw.endElement();

    // ------------- Namespace Uris
    xw.startElement("Models");
    xw.endElement();

    const s: any = {};
    for (const node of this.nodeIterator()) {
        buildUpAliases(node, xw, s);
    }
    writeAliases(xw, s.aliases);

    xw.visitedNode = {};

    // -------------- writeReferences
    xw.writeComment("ReferenceTypes");
    const referenceTypes = [...this._referenceTypeIterator()].sort(sortByBrowseName);
    for (const referenceType of referenceTypes) {
        dumpReferenceType(xw, referenceType);
    }

    // -------------- Dictionaries
    const addressSpace = this.addressSpace;
    const opcBinaryTypeSystem = addressSpace.findNode("OPCBinarySchema_TypeSystem") as UAObject;
    if (opcBinaryTypeSystem) {
        // let find all DataType dictionary node corresponding to a given namespace
        // (have DataTypeDictionaryType)
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
        if (result.length === 1) {
            xw.writeComment("DataSystem");
            const dataSystemType = addressSpace.findNode(result[0].nodeId)! as UAVariable;
            dataSystemType.dumpXML(xw);
        }
    }
    // -------------- DataTypes
    const dataTypes = [...this._dataTypeIterator()].sort(sortByBrowseName);
    if (dataTypes.length) {
        xw.writeComment("DataTypes");
        // xx xw.writeComment(" "+ objectTypes.map(x=>x.browseName.name.toString()).join(" "));
        for (const dataType of dataTypes) {
            if (!xw.visitedNode[_hash(dataType)]) {
                dataType.dumpXML(xw);
            }
        }
    }
    // -------------- ObjectTypes
    xw.writeComment("ObjectTypes");
    const objectTypes = [...this._objectTypeIterator()].sort(sortByBrowseName);
    // xx xw.writeComment(" "+ objectTypes.map(x=>x.browseName.name.toString()).join(" "));
    for (const objectType of objectTypes) {
        if (!xw.visitedNode[_hash(objectType)]) {
            objectType.dumpXML(xw);
        }
    }

    // -------------- VariableTypes
    xw.writeComment("VariableTypes");
    const variableTypes = [...this._variableTypeIterator()].sort(sortByBrowseName);
    // xx xw.writeComment("ObjectTypes "+ variableTypes.map(x=>x.browseName.name.toString()).join(" "));
    for (const variableType of variableTypes) {
        if (!xw.visitedNode[_hash(variableType)]) {
            variableType.dumpXML(xw);
        }
    }

    // -------------- Any   thing else
    xw.writeComment("Other Nodes");
    const nodes = [...this.nodeIterator()].sort(sortByBrowseName);
    for (const node of nodes) {
        if (!xw.visitedNode[_hash(node)]) {
            node.dumpXML(xw);
        }
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
};
