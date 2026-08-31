import type { IAddressSpace, INamespace, UADataType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { type INodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { EnumDefinition, StructureDefinition } from "node-opcua-types";
import XMLWriter from "xml-writer";
import type { Namespace } from "../../source/namespace.js";
import type { XmlWriter } from "../../source/xml_writer.js";
import type { AddressSpacePrivate } from "../address_space_private.js";
import type { NamespacePrivate } from "../namespace_private.js";
import { constructNamespaceDependency } from "./construct_namespace_dependency.js";

function dumpEnumeratedType(xw: XmlWriter, e: EnumDefinition, name: string): void {
    xw.startElement("opc:EnumeratedType");
    xw.writeAttribute("Name", name);
    xw.writeAttribute("LengthInBits", "32");
    for (const f of e.fields || []) {
        xw.startElement("opc:EnumeratedValue");
        xw.writeAttribute("Name", f.name || "");
        assert(f.value[0] === 0, "unsupported 64 bit value !");
        xw.writeAttribute("Value", f.value[1].toString());
        xw.endElement();
    }
    xw.endElement();
}
function buildXmlName(addressSpace: AddressSpacePrivate, map: Map<number, string>, nodeId: NodeId): string {
    if (NodeId.sameNodeId(nodeId, NodeId.nullNodeId)) {
        return "ua:ExtensionObject";
    }
    const node = addressSpace.findNode(nodeId);
    // c8 ignore next
    if (!node) {
        throw new Error(`Cannot find Node for${nodeId?.toString()}`);
    }
    const typeName = node.browseName.name || "";

    const n = node.nodeId as INodeId;
    const prefix =
        n.identifierType === NodeIdType.NUMERIC && n.namespace === 0
            ? n.value <= 15
                ? "opc"
                : "ua"
            : map.get(node.nodeId.namespace);
    return `${prefix}:${typeName === "Structure" && prefix === "ua" ? "ExtensionObject" : typeName}`;
}

function dumpDataTypeStructure(
    xw: XmlWriter,
    addressSpace: IAddressSpace,
    map: Map<number, string>,
    structureDefinition: StructureDefinition,
    structureDefinitionBase: StructureDefinition | undefined | null,
    name: string,
    doc?: string
): void {
    xw.startElement("opc:StructuredType");
    xw.writeAttribute("Name", name);
    xw.writeAttribute("BaseType", buildXmlName(addressSpace as AddressSpacePrivate, map, structureDefinition.baseDataType));

    if (doc) {
        xw.startElement("opc:Documentation");
        xw.text(doc);
        xw.endElement();
    }

    const fields = structureDefinition.fields || [];
    // get base class
    const nbFieldsInBase = structureDefinitionBase ? structureDefinitionBase.fields?.length || 0 : 0;

    let optionalsCount = 0;
    for (let index = nbFieldsInBase; index < fields.length; index++) {
        const f = fields[index];
        if (f.isOptional) {
            xw.startElement("opc:Field");
            xw.writeAttribute("Name", `${f.name}Specified`);
            xw.writeAttribute("TypeName", "opc:Bit");
            xw.endElement();
            optionalsCount++;
        }
    }

    // c8 ignore next
    if (optionalsCount >= 32) {
        throw new Error("Too many optionals fields");
    }

    if (optionalsCount) {
        /*
                const padding = optionalsCount <= 8
                    ? (8 - optionalsCount)
                    : (optionalsCount <= 16)
                        ? (16 - optionalsCount)
                        : (32 - optionalsCount)
                    ;
        */
        const padding = 32 - optionalsCount;
        if (padding !== 0) {
            xw.startElement("opc:Field");
            xw.writeAttribute("Name", "Reserved1");
            xw.writeAttribute("TypeName", "opc:Bit");
            xw.writeAttribute("Length", padding.toString());
            xw.endElement();
        }
    }
    for (let index = nbFieldsInBase; index < fields.length; index++) {
        const f = fields[index];

        const isArray = f.valueRank > 0 && f.arrayDimensions?.length;

        if (isArray) {
            xw.startElement("opc:Field");
            xw.writeAttribute("Name", `NoOf${f.name || ""}`);
            xw.writeAttribute("TypeName", "opc:Int32");
            if (f.isOptional) {
                xw.writeAttribute("SwitchField", `${f.name}Specified`);
            }
            xw.endElement();
        }

        xw.startElement("opc:Field");
        xw.writeAttribute("Name", f.name || "");

        const typeName = buildXmlName(addressSpace as AddressSpacePrivate, map, f.dataType);
        xw.writeAttribute("TypeName", typeName);
        if (isArray) {
            xw.writeAttribute("LengthField", `NoOf${f.name || ""}`);
        }
        if (f.isOptional) {
            xw.writeAttribute("SwitchField", `${f.name || ""}Specified`);
        }
        xw.endElement();
    }
    xw.endElement();
}

function dumpDataTypeToBSD(xw: XmlWriter, dataType: UADataType, map: Map<number, string>) {
    const addressSpace = dataType.addressSpace;

    const name: string = dataType.browseName.name || "";

    const definition = dataType.getDefinition();
    if (definition instanceof StructureDefinition) {
        const structureDefinitionBase = dataType.subtypeOfObj?.getStructureDefinition();
        dumpDataTypeStructure(xw, addressSpace, map, definition, structureDefinitionBase, name);
    }
    if (definition instanceof EnumDefinition) {
        dumpEnumeratedType(xw, definition, name);
    }
}

function shortcut(namespace: INamespace) {
    return `n${namespace.index}`;
}
/**
 * Takes the published Namespace, not NamespacePrivate.
 *
 * This function is exported from the package entry, and NamespacePrivate is not: asking for
 * one made it impossible to call from outside, since there is no public way to obtain the
 * argument. It needs `_dataTypeIterator`, which only the implementation has, so the narrowing
 * happens here once rather than at every call site.
 */
/**
 * The one service this file needs that a Namespace does not publish: walking the data types
 * the namespace holds.
 *
 * Everything else dumpToBSD reads - index, namespaceUri, addressSpace - is on the public
 * Namespace. Asking for the whole NamespacePrivate would have meant demanding thirteen
 * members to use one, and would have made the parameter a type no caller outside this package
 * can obtain.
 *
 * A namespace cannot be enumerated through the published API at all: both nodeIterator and
 * _dataTypeIterator are private. Everyone who needs to walk one therefore declares their own
 * copy of the internals and converts into it - node-opcua-modeler's generate_markdown_doc has
 * a ten-member `NamespacePriv2`, its tests have a `NamespaceWithInternals`, and this is the
 * third. Publishing the capability once, as a named interface in the contract package, is the
 * fix; it is tracked separately because it is an API addition, not a repair.
 *
 * @internal
 */
export interface IDataTypeIterable {
    _dataTypeIterator(): IterableIterator<UADataType>;
}

export function dumpToBSD(namespace: Namespace): string {
    const _namespace = namespace as unknown as IDataTypeIterable & NamespacePrivate;
    const dependency: INamespace[] = constructNamespaceDependency(_namespace);

    const _addressSpace = _namespace.addressSpace;

    const xw: XmlWriter = new XMLWriter(true);

    //xx xw.startDocument():// { encoding: "utf-8", version: "1.0" });

    xw.startElement("opc:TypeDictionary");

    xw.writeAttribute("xmlns:opc", "http://opcfoundation.org/BinarySchema/");
    xw.writeAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:ua", "http://opcfoundation.org/UA/");
    xw.writeAttribute("xmlns:tns", namespace.namespaceUri);

    const map: Map<number, string> = new Map();

    map.set(namespace.index, "tns");

    for (const dependantNamespace of dependency) {
        const namespaceIndex = dependantNamespace.index;
        if (namespaceIndex === 0 || namespaceIndex === namespace.index) {
            continue;
        }
        const ns = shortcut(dependantNamespace);
        map.set(namespaceIndex, ns);
        xw.writeAttribute(`xmlns:${ns}`, dependantNamespace.namespaceUri);
    }

    xw.writeAttribute("DefaultByteOrder", "LittleEndian");
    xw.writeAttribute("TargetNamespace", namespace.namespaceUri);

    // <opc:Import Namespace="http://opcfoundation.org/UA/"/>
    for (const dependantNamespace of dependency) {
        if (dependantNamespace.index === namespace.index) {
            continue;
        }
        xw.startElement("opc:Import").writeAttribute("Namespace", dependantNamespace.namespaceUri).endElement();
    }
    //
    for (const dataType of _namespace._dataTypeIterator()) {
        dumpDataTypeToBSD(xw, dataType, map);
    }
    xw.endElement();
    //    xw.endDocument();

    return xw.toString();
}
