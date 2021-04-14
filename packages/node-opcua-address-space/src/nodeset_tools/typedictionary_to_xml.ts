import { assert } from "node-opcua-assert";
import { StructureDefinition, EnumDefinition, EnumDescription } from "node-opcua-types";
import { constructNamespaceDependency } from "./construct_namespace_dependency";
import { NodeId } from "node-opcua-nodeid";

import { XmlWriter, Namespace } from "../../source/address_space_ts";
import { UADataType } from "../ua_data_type";
import { AddressSpace } from "../address_space";
import { AddressSpacePrivate } from "../address_space_private";
import { UANamespace } from "../namespace";

// tslint:disable-next-line: no-var-requires
const XMLWriter = require("xml-writer");

function dumpEnumeratedType(xw: XmlWriter, e: EnumDefinition, name: string): void {
    xw.startElement("opc:EnumeratedType");
    xw.writeAttribute("Name", name);
    xw.writeAttribute("LengthInBits", "32");
    for (const f of e.fields || []) {
        xw.startElement("opc:EnumeratedValue");
        xw.writeAttribute("Name", f.name!);
        assert(f.value[0] === 0, "unsuppor 64 bit value !");
        xw.writeAttribute("Value", f.value[1].toString());
        xw.endElement();
    }
    xw.endElement();
}
function buildXmlName(addressSpace: AddressSpacePrivate, map: { [key: number]: string }, nodeId: NodeId) {
    if (NodeId.sameNodeId(nodeId, NodeId.nullNodeId)) {
        return "ua:ExtensionObject";
    }
    const node = addressSpace.findNode(nodeId);
    // istanbull ignore next
    if (!node) {
        throw new Error("Cannot find Node for" + nodeId?.toString());
    }
    const typeName = node.browseName.name!;
    const prefix = node.nodeId.namespace === 0 ? (node.nodeId.value <= 15 ? "opc" : "ua") : map[node.nodeId.namespace];
    return prefix + ":" + (typeName === "Structure" && prefix === "ua" ? "ExtensionObject" : typeName);
}
function dumpDataTypeStructure(
    xw: XmlWriter,
    addressSpace: AddressSpacePrivate,
    map: { [key: number]: string },
    structureDefinition: StructureDefinition,
    name: string,
    doc?: string
) {
    xw.startElement("opc:StructuredType");
    xw.writeAttribute("Name", name);
    xw.writeAttribute("BaseType", buildXmlName(addressSpace, map, structureDefinition.baseDataType));

    if (doc) {
        xw.startElement("opc:Documentation");
        xw.text(doc);
        xw.endElement();
    }
    let optionalsCount = 0;
    for (const f of structureDefinition.fields || []) {
        if (f.isOptional) {
            xw.startElement("opc:Field");
            xw.writeAttribute("Name", f.name + "Specified");
            xw.writeAttribute("TypeName", "opc:Bit");
            xw.endElement();
            optionalsCount++;
        }
    }

    // istanbul ignore next
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
    for (const f of structureDefinition.fields || []) {
        const isArray = f.valueRank > 0 && f.arrayDimensions?.length;

        if (isArray) {
            xw.startElement("opc:Field");
            xw.writeAttribute("Name", "NoOf" + f.name!);
            xw.writeAttribute("TypeName", "opc:Int32");
            if (f.isOptional) {
                xw.writeAttribute("SwitchField", f.name + "Specified");
            }
            xw.endElement();
        }

        xw.startElement("opc:Field");
        xw.writeAttribute("Name", f.name!);

        const typeName = buildXmlName(addressSpace, map, f.dataType);
        xw.writeAttribute("TypeName", typeName);
        if (isArray) {
            xw.writeAttribute("LengthField", "NoOf" + f.name!);
        }
        if (f.isOptional) {
            xw.writeAttribute("SwitchField", f.name + "Specified");
        }
        xw.endElement();
    }
    xw.endElement();
}

function dumpDataTypeToBSD(xw: XmlWriter, dataType: UADataType, map: { [key: number]: string }) {
    const addressSpace = dataType.addressSpace;

    const name: string = dataType.browseName.name!;

    const def = dataType._getDefinition(false);
    if (def instanceof StructureDefinition) {
        dumpDataTypeStructure(xw, addressSpace, map, def, name);
    }
    if (def instanceof EnumDefinition) {
        dumpEnumeratedType(xw, def, name);
    }
}

function shortcut(namespace: Namespace) {
    return "n" + namespace.index;
}
export function dumpToBSD(namespace: UANamespace) {
    const dependency: Namespace[] = constructNamespaceDependency(namespace);

    const addressSpace = namespace.addressSpace;

    const xw = new XMLWriter(true);

    xw.startDocument({ encoding: "utf-8", version: "1.0" });

    xw.startElement("opc:TypeDictionary");

    xw.writeAttribute("xmlns:opc", "http://opcfoundation.org/BinarySchema/");
    xw.writeAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:ua", "http://opcfoundation.org/UA/");

    const map: { [key: number]: string } = {};

    for (const dependantNamespace of dependency) {
        const namespaceIndex = dependantNamespace.index;
        if (namespaceIndex === 0) {
            //|| namespaceIndex === namespace.index) {
            continue;
        }
        const ns = shortcut(dependantNamespace);
        map[namespaceIndex] = ns;
        xw.writeAttribute(`xmlns:${ns}`, dependantNamespace.namespaceUri);
    }

    xw.writeAttribute("DefaultByteOrder", "LittleEndian");
    xw.writeAttribute("TargetNamespace", namespace.namespaceUri);

    for (const dataType of namespace._dataTypeIterator()) {
        dumpDataTypeToBSD(xw, dataType, map);
    }
    xw.endElement();
    xw.endDocument();

    return xw.toString();
}
