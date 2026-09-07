/**
 * @module node-opcua-address-space
 *
 * The parts of writing a NodeSet2 document that are about XML and nothing else: the namespace
 * prefix bookkeeping an `XmlWriter` carries around, the id and browse-name spellings, and the few
 * `uax:` elements a value is built from.
 *
 * They live here, below the address space, because there are two writers and neither should own
 * them: `impl/nodeset_tools/nodeset_to_xml.ts` writes a live namespace, and
 * `nodeset_records_to_xml.ts` writes a record stream with no address space anywhere in sight. A
 * helper that reached for a node would be usable by only one of them.
 */
import { assert } from "node-opcua-assert";
import type { Int64 } from "node-opcua-basic-types";
import { type LocalizedText, QualifiedName } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import type { XmlWriter } from "../xml_writer.js";

const warningLog = make_warningLog("nodeset_xml_primitives");

export type XmlNamespaceUri = string;
export type NamespaceUri = string;
export type XmlNs = string;

export const UAX_TYPES_XSD = "http://opcfoundation.org/UA/2008/02/Types.xsd";

/** the `<xmlns:nsN>` a namespace's own types are declared under, derived from its uri */
export function makeTypeXsd(namespaceUri: string): string {
    return `${namespaceUri.replace(/\/$/, "")}/Type.xsd`;
}

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

export function findXsdNamespaceUri(xw: XmlWriter, nodeId: NodeId): string {
    const xwe = xw as XmlWriterEx;
    if (!xwe.namespaceArray) {
        return "";
    }
    const namespace = xwe.namespaceArray[nodeId.namespace];
    if (namespace === "http://opcfoundation.org/UA/") {
        return UAX_TYPES_XSD;
    }
    // c8 ignore next
    if (!namespace) {
        return "";
    }
    return `${namespace.replace(/\/$/, "")}/Types.xsd`;
}

export function getPrefix(xw: XmlWriter, namespace: XmlNamespaceUri): XmlNs {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return "";
    const p = xwe.map[namespace] || "";
    return p ? `${p}:` : "";
}

export function restoreDefaultNamespace(xw: XmlWriter): void {
    const xwe = xw as XmlWriterEx;
    if (!xwe.map) return;
    const previousMap = xwe.stackMap.pop();
    if (previousMap) {
        xwe.map = previousMap;
    }
}

export function setDefaultNamespace(xw: XmlWriter, namespace: XmlNamespaceUri): void {
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

export function startElementEx(xw: XmlWriter, _ns: XmlNs, name: string, defaultNamespace: XmlNamespaceUri): void {
    xw.startElement(name);
    setDefaultNamespace(xw, defaultNamespace);
}

// #region ids and names
//
// every id written goes through the writer's translationTable, which maps the index a node carries
// to the index the document being written declares. A writer whose document keeps the indices it
// was given -- the record writer -- installs the identity and these are then spelling functions.

export function translateNodeId(xw: XmlWriter, nodeId: NodeId): NodeId {
    assert(nodeId instanceof NodeId);
    const nn = xw.translationTable.get(nodeId.namespace);
    return new NodeId(nodeId.identifierType, nodeId.value, nn);
}

/** an id as a document spells it: translated, and with the `ns=0;` that every document leaves out */
export function n(xw: XmlWriter, nodeId: NodeId): string {
    return translateNodeId(xw, nodeId).toString().replace("ns=0;", "");
}

export function translateBrowseName(xw: XmlWriter, browseName: QualifiedName): QualifiedName {
    assert(browseName instanceof QualifiedName);
    const nn = xw.translationTable.get(browseName.namespaceIndex);
    return new QualifiedName({ namespaceIndex: nn, name: browseName.name });
}

export function b(xw: XmlWriter, browseName: QualifiedName): string {
    return translateBrowseName(xw, browseName).toString().replace("ns=0;", "");
}

/** the identity table, for a writer that keeps the namespace indices its input already carries */
export function identityTranslationTable(size: number): Map<number, number> {
    const table = new Map<number, number>();
    for (let i = 0; i < size; i++) {
        table.set(i, i);
    }
    return table;
}

// #endregion

export function coerceInt64ToInt32(int64: Int64): number {
    if (typeof int64 === "number") {
        return int64;
    }
    if (int64[0] === 0xffffffff && int64[1] === 0xffffffff) {
        return 0xffffffff;
    }
    if (int64[0] !== 0) {
        warningLog("coerceInt64ToInt32 , loosing high word in conversion");
    }
    return int64[1];
}

// #region the `uax:` elements a value is built from

export function _dumpLocalizedText(xw: XmlWriter, v: LocalizedText): void {
    const uax = getPrefix(xw, UAX_TYPES_XSD);
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

export function _dumpQualifiedName(xw: XmlWriter, v: QualifiedName): void {
    const uax = getPrefix(xw, UAX_TYPES_XSD);
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

export function _dumpXmlElement(xw: XmlWriter, v: string): void {
    xw.text(v);
}

export function _dumpNodeId(xw: XmlWriter, v: NodeId): void {
    const xmlns = getPrefix(xw, UAX_TYPES_XSD);
    xw.startElement(`${xmlns}Identifier`);
    xw.text(n(xw, v));
    xw.endElement();
}

// #endregion
