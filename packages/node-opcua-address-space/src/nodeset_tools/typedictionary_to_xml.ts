import { UANamespace } from "../namespace";
import * as _ from "underscore";
import { XmlWriter, Namespace } from "../../source/address_space_ts";
import { UADataType } from "../ua_data_type";
import { StructureDefinition, EnumDefinition, EnumDescription } from "node-opcua-types";
import { Xml2Json } from "node-opcua-xml2json/source";
import { constructNamespaceDependency } from "./construct_namespace_dependency";
import { AddressSpace } from "../address_space";
import { AddressSpacePrivate } from "../address_space_private";
// tslint:disable-next-line: no-var-requires
const XMLWriter = require("xml-writer");

function dumpEnumeratedType(xw: XmlWriter, e: EnumDefinition) {
    xw.startElement("opc:EnumeratedType");
    xw.writeAttribute("Name", e.schema.name);
    for (const f of e.fields || []) {
        xw.startElement("opc:EnumeratedValue");
        xw.writeAttribute("Name", f.name!);
        xw.writeAttribute("Value", f.value.toString());
        xw.endElement();
    }
    xw.endElement();
}
function dumpDataTypeStructure(
    xw: XmlWriter,
    addressSpace: AddressSpacePrivate,
    map: { [key: number]: string },
    structureDefinition: StructureDefinition
) {
    xw.startElement("opc:StructuredType");
    xw.writeAttribute("Name", structureDefinition.schema.name);
    xw.writeAttribute("BaseType", "ua:ExtensionObject");

    for (const f of structureDefinition.fields || []) {

        const isArray = f.valueRank > 0 && f.arrayDimensions?.length;
        if (isArray) {
            xw.startElement("opc:Field");
            xw.writeAttribute("Name", "NoOf" + f.name!);
            xw.writeAttribute("TypeName", "opc:Int32");
            xw.endElement();
        }

        xw.startElement("opc:Field");
        xw.writeAttribute("Name", f.name!);

        const dataTypeNode = addressSpace.findNode(f.dataType);
        // istanbull ignore next
        if (!dataTypeNode) {
            throw new Error("Cannot find DataType for" + f.dataType?.toString());
        }
        const typeName = dataTypeNode.browseName.name!;
        const prefix = dataTypeNode.nodeId.namespace === 0 ? "opc" : map[dataTypeNode.nodeId.namespace];

        xw.writeAttribute("TypeName", prefix + ":" + typeName);
        if (isArray) {
            xw.writeAttribute("LengthField", "NoOf" + f.name!);
        }
        xw.endElement();
    }
    xw.endElement();
}

function dumpDataTypeToBSD(xw: XmlWriter, dataType: UADataType, map: { [key: number]: string }) {

    const addressSpace = dataType.addressSpace;

    const def = dataType._getDefinition();
    if (def instanceof StructureDefinition) {
        dumpDataTypeStructure(xw, addressSpace, map, def);
    }
    if (def instanceof EnumDefinition) {
        dumpEnumeratedType(xw, def);
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

    xw.writeAttribute(
        "xmlns:opc", "http://opcfoundation.org/BinarySchema/");
    xw.writeAttribute(
        "xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute(
        "xmlns:ua", "http://opcfoundation.org/UA/");

    const map: { [key: number]: string } = {};

    for (const dependantNamespace of dependency) {
        const namespaceIndex = dependantNamespace.index;
        if (namespaceIndex === 0) { //|| namespaceIndex === namespace.index) {
            continue;
        }
        const ns = shortcut(dependantNamespace);
        map[namespaceIndex] = ns;
        xw.writeAttribute(
            `xmlns:${ns}`, dependantNamespace.namespaceUri);
    }

    xw.writeAttribute(
        "DefaultByteOrder", "LittleEndian");
    xw.writeAttribute(
        "TargetNamespace", namespace.namespaceUri);

    const dataTypes = _.values(namespace._dataTypeMap);
    for (const dataType of dataTypes) {
        dumpDataTypeToBSD(xw, dataType, map)
    }
    xw.endElement();
    xw.endDocument();

    return xw.toString();
}
