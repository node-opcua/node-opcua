/**
 * @module node-opcua-address-space
 *
 * Records back to a NodeSet2 XML document, with no address space anywhere in the loop.
 *
 * This is the other half of {@link makeXmlNodesetRecordReader}: that one reads a NodeSet2 document
 * into records, this one writes records back out as one. Together they make the conversion between
 * NodeSet2 XML and NodeSet-NDJSON a transcription between two spellings of the same document,
 * which is what the format claims to be.
 *
 * The alternative is to load the records into an address space and export that namespace
 * (`NamespaceImpl.toNodeset2XML`). It answers a different question, and it is lossy in the way an
 * information model is bound to be: the address space keeps what it needs to serve a session, not
 * what a document happened to say, so anything it does not model has to be carried alongside the
 * nodes for the sake of the export alone. This writer needs none of that, because it never leaves
 * the document.
 *
 * Two things fall out of staying inside the document, and they are the whole reason it is exact:
 *
 * - **No namespace translation.** A record carries the indices of the file's own table, and this
 *   writer declares that same table, so the mapping is the identity. The address-space path has to
 *   rebuild a table out of a namespace and its dependencies, which is where a namespace can be
 *   dropped, added, or reordered.
 * - **No DataType definitions.** A value reaches a record either as one of the four types the XML
 *   reader decodes (Argument, EUInformation, Range, EnumValueType) or as the XML it could not
 *   decode, kept verbatim. Nothing else can be in there -- the image codec refuses to carry a
 *   decoded anything-else -- so writing a value back never needs to look a structure up.
 */
import type { Int64 } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { make_errorLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import { Argument, EnumValueType, EUInformation, Range } from "node-opcua-types";
import { DataType, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import XMLWriter from "xml-writer";
import type { XmlWriter } from "../xml_writer.js";
import type { NodesetHeaderRecord, NodesetNodeRecord, NodesetRecord, NodesetReferenceRecord } from "./nodeset_record.js";
import { XmlExtensionObjectFragment } from "./nodeset_record.js";
import {
    _dumpLocalizedText,
    _dumpNodeId,
    _dumpQualifiedName,
    b,
    getPrefix,
    identityTranslationTable,
    initXmlWriterEx,
    int64ToDecimalString,
    makeTypeXsd,
    n,
    restoreDefaultNamespace,
    startElementEx,
    UAX_TYPES_XSD
} from "./nodeset_xml_primitives.js";

const errorLog = make_errorLog("nodeset_records_to_xml");

const UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";

/**
 * the alias each id is written under, per writer. `<Aliases>` exists so that a document can say
 * ReferenceType="HasProperty" instead of i=46, and every document that declares an alias uses it,
 * so writing the bare id back would be a different document saying the same thing. The header
 * carries the aliases; this is that map inverted.
 */
const aliasTables = new WeakMap<XmlWriter, Map<string, string>>();

/** an id as the document spells it: its alias when it has one, the id itself otherwise */
function a(xw: XmlWriter, nodeId: NodeId): string {
    const spelling = n(xw, nodeId);
    return aliasTables.get(xw)?.get(spelling) ?? spelling;
}

export interface RecordsToNodeset2XMLOptions {
    /**
     * emit the `<!--DataTypes-->` style comments the address-space exporter writes between groups
     * of node classes. Off by default: a document's own records arrive in the document's order and
     * there are no groups to announce.
     */
    sectionComments?: boolean;
}

/** the element name of each node class, as the UANodeSet schema names it */
const ELEMENT_OF_NODE_CLASS: Partial<Record<NodeClass, string>> = {
    [NodeClass.Object]: "UAObject",
    [NodeClass.Variable]: "UAVariable",
    [NodeClass.Method]: "UAMethod",
    [NodeClass.ObjectType]: "UAObjectType",
    [NodeClass.VariableType]: "UAVariableType",
    [NodeClass.ReferenceType]: "UAReferenceType",
    [NodeClass.DataType]: "UADataType",
    [NodeClass.View]: "UAView"
};

/**
 * a NodeSet2 document from the records it was read into.
 *
 * The records must be one document's worth, the header first, the nodes after it in the order the
 * document is to list them. Ids are written with the indices the records carry.
 */
export function recordsToNodeset2XML(records: readonly NodesetRecord[], options: RecordsToNodeset2XMLOptions = {}): string {
    const header = records[0];
    if (header?.kind !== "header") {
        throw new Error("recordsToNodeset2XML: the records must start with the header record");
    }
    // index 0 is always the UA namespace and is never listed in <NamespaceUris>; the declared uris
    // follow it in order. This is the table the records index into and the table we write back.
    const namespaceArray = [UA_NAMESPACE_URI, ...header.namespaceUris];

    const xw: XmlWriter = new XMLWriter(true);
    xw.translationTable = identityTranslationTable(namespaceArray.length);
    xw.priorityTable = namespaceArray.map((_, index) => index);
    xw.visitedNode = new Set();

    xw.startDocument({ encoding: "utf-8", version: "1.0" });
    xw.startElement("UANodeSet");
    xw.writeAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:uax", UAX_TYPES_XSD);
    xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");

    const namespacesMap: Record<string, string> = {
        "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd": "",
        [UAX_TYPES_XSD]: "uax",
        "http://www.w3.org/2001/XMLSchema-instance": "xsi"
    };
    for (let index = 1; index < namespaceArray.length; index++) {
        const smallName = `ns${index}`;
        xw.writeAttribute(`xmlns:${smallName}`, makeTypeXsd(namespaceArray[index]));
        namespacesMap[namespaceArray[index]] = smallName;
    }
    initXmlWriterEx(xw, namespacesMap, namespaceArray);

    const aliasOf = new Map<string, string>();
    for (const [name, nodeId] of Object.entries(header.aliases)) {
        aliasOf.set(nodeId.toString().replace("ns=0;", ""), name);
    }
    aliasTables.set(xw, aliasOf);

    writeHeader(xw, header);

    for (const record of records.slice(1)) {
        if (record.kind !== "node") {
            continue;
        }
        writeNode(xw, record, options);
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
}

/**
 * a date that can be written back. The reader keeps an unparseable PublicationDate as an invalid
 * Date rather than dropping it, so a document that said something bad still says it was there;
 * `toISOString` throws on one, and there is nothing to write.
 */
function isUsableDate(date: Date | undefined | null): date is Date {
    return date instanceof Date && !Number.isNaN(date.getTime());
}

function writeHeader(xw: XmlWriter, header: NodesetHeaderRecord): void {
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
        if (isUsableDate(model.publicationDate)) {
            xw.writeAttribute("PublicationDate", model.publicationDate.toISOString());
        }
        for (const required of model.requiredModels) {
            xw.startElement("RequiredModel");
            xw.writeAttribute("ModelUri", required.modelUri);
            // both are optional in the XSD, and a document that leaves them out means it: ISA95
            // requires the UA namespace with no version and no date at all
            if (required.version) {
                xw.writeAttribute("Version", required.version);
            }
            if (isUsableDate(required.publicationDate)) {
                xw.writeAttribute("PublicationDate", required.publicationDate.toISOString());
            }
            xw.endElement();
        }
        xw.endElement();
    }
    xw.endElement();

    xw.startElement("Aliases");
    // in the order the document declared them, which the record kept. The address-space exporter
    // sorts because it synthesizes the list and has no order to preserve; here there is one, and
    // sorting it would make the document a rearrangement of itself rather than a copy
    for (const name of Object.keys(header.aliases)) {
        xw.startElement("Alias");
        xw.writeAttribute("Alias", name);
        xw.text(header.aliases[name].toString().replace("ns=0;", ""));
        xw.endElement();
    }
    xw.endElement();

    // whatever a tool stamped on the document, back as the XML it was, prefix included: the
    // reader keeps the qualified name for the fragment cloner precisely so that this survives
    if (header.extensions?.length) {
        xw.startElement("Extensions");
        for (const extension of header.extensions) {
            xw.startElement("Extension");
            writeRaw(xw, extension);
            xw.endElement();
        }
        xw.endElement();
    }
}

// #region nodes

function writeNode(xw: XmlWriter, record: NodesetNodeRecord, options: RecordsToNodeset2XMLOptions): void {
    const element = ELEMENT_OF_NODE_CLASS[record.nodeClass];
    if (!element) {
        errorLog(`recordsToNodeset2XML: no element for node class ${record.nodeClass} on ${record.nodeId.toString()}`);
        return;
    }
    if (options.sectionComments) {
        xw.writeComment(element.replace(/^UA/, ""));
    }
    xw.startElement(element);
    writeCommonAttributes(xw, record);
    writeClassAttributes(xw, record);
    writeCommonElements(xw, record);
    writeDefinition(xw, record);
    writeValue(xw, record.value);
    xw.endElement();
}

function writeCommonAttributes(xw: XmlWriter, record: NodesetNodeRecord): void {
    xw.writeAttribute("NodeId", n(xw, record.nodeId));
    xw.writeAttribute("BrowseName", b(xw, record.browseName));
    if (record.parentNodeId) {
        xw.writeAttribute("ParentNodeId", n(xw, record.parentNodeId));
    }
    if (record.symbolicName !== undefined) {
        xw.writeAttribute("SymbolicName", record.symbolicName);
    }
    if (record.releaseStatus) {
        xw.writeAttribute("ReleaseStatus", record.releaseStatus);
    }
    if (record.isAbstract) {
        xw.writeAttribute("IsAbstract", "true");
    }
    if (record.accessLevel !== undefined) {
        xw.writeAttribute("AccessLevel", record.accessLevel);
    }
    if (record.userAccessLevel !== undefined) {
        xw.writeAttribute("UserAccessLevel", record.userAccessLevel);
    }
    if (record.accessRestrictions !== undefined) {
        xw.writeAttribute("AccessRestrictions", record.accessRestrictions);
    }
    if (record.hasNoPermissions) {
        xw.writeAttribute("HasNoPermissions", "true");
    }
    if (record.minimumSamplingInterval !== undefined && record.minimumSamplingInterval > 0) {
        xw.writeAttribute("MinimumSamplingInterval", record.minimumSamplingInterval);
    }
    if (record.historizing) {
        xw.writeAttribute("Historizing", "true");
    }
}

function writeClassAttributes(xw: XmlWriter, record: NodesetNodeRecord): void {
    switch (record.nodeClass) {
        case NodeClass.Object:
        case NodeClass.ObjectType:
        case NodeClass.View:
            if (record.eventNotifier) {
                xw.writeAttribute("EventNotifier", record.eventNotifier.toString());
            }
            if (record.nodeClass === NodeClass.View && record.containsNoLoops) {
                xw.writeAttribute("ContainsNoLoops", "true");
            }
            break;
        case NodeClass.Variable:
        case NodeClass.VariableType:
            if (record.dataType) {
                xw.writeAttribute("DataType", a(xw, record.dataType));
            }
            if (record.valueRank !== undefined) {
                xw.writeAttribute("ValueRank", record.valueRank.toString());
            }
            if (record.arrayDimensions) {
                xw.writeAttribute("ArrayDimensions", record.arrayDimensions.join(","));
            }
            break;
        case NodeClass.Method:
            if (record.methodDeclarationId) {
                xw.writeAttribute("MethodDeclarationId", n(xw, record.methodDeclarationId));
            }
            break;
        case NodeClass.ReferenceType:
            if (record.symmetric) {
                xw.writeAttribute("Symmetric", "true");
            }
            break;
        default:
            break;
    }
}

// the UANode sequence is DisplayName, Description, Category, Documentation, References,
// RolePermissions: InverseName sits with DisplayName and Description, RolePermissions after
// References.
function writeCommonElements(xw: XmlWriter, record: NodesetNodeRecord): void {
    if (record.displayName !== undefined) {
        xw.startElement("DisplayName").text(record.displayName).endElement();
    }
    if (record.description !== undefined) {
        xw.startElement("Description").text(record.description).endElement();
    }
    if (record.nodeClass === NodeClass.ReferenceType && record.inverseName !== undefined) {
        xw.startElement("InverseName").text(record.inverseName).endElement();
    }
    for (const category of record.category ?? []) {
        xw.startElement("Category").text(category).endElement();
    }
    if (record.documentation !== undefined) {
        xw.startElement("Documentation").text(record.documentation).endElement();
    }
    writeReferences(xw, record.references);
    if (record.rolePermissions && record.rolePermissions.length > 0) {
        xw.startElement("RolePermissions");
        for (const rolePermission of record.rolePermissions) {
            xw.startElement("RolePermission");
            xw.writeAttribute("Permissions", rolePermission.permissions.toString());
            xw.text(n(xw, rolePermission.roleId));
            xw.endElement();
        }
        xw.endElement();
    }
}

function writeReferences(xw: XmlWriter, references: NodesetReferenceRecord[]): void {
    if (!references || references.length === 0) {
        return;
    }
    xw.startElement("References");
    for (const reference of references) {
        xw.startElement("Reference");
        xw.writeAttribute("ReferenceType", a(xw, reference.referenceType));
        if (!reference.isForward) {
            xw.writeAttribute("IsForward", "false");
        }
        xw.text(n(xw, reference.nodeId));
        xw.endElement();
    }
    xw.endElement();
}

function writeDefinition(xw: XmlWriter, record: NodesetNodeRecord): void {
    const definition = record.definition;
    if (!definition) {
        return;
    }
    xw.startElement("Definition");
    if (definition.name !== undefined) {
        xw.writeAttribute("Name", definition.name);
    }
    if (definition.isUnion) {
        xw.writeAttribute("IsUnion", "true");
    }
    if (definition.isOptionSet) {
        xw.writeAttribute("IsOptionSet", "true");
    }
    for (const field of definition.fields || []) {
        xw.startElement("Field");
        xw.writeAttribute("Name", field.name || "");
        // a field whose Name is not an identifier carries the identifier separately: "N/S
        // Hemisphere" is declared with SymbolicName="N_S_Hemisphere", and a generator needs it
        if (field.symbolicName) {
            xw.writeAttribute("SymbolicName", field.symbolicName);
        }
        if (field.arrayDimensions && field.arrayDimensions.length > 0) {
            xw.writeAttribute("ArrayDimensions", field.arrayDimensions.join(","));
        }
        if (field.valueRank !== undefined && field.valueRank !== -1) {
            xw.writeAttribute("ValueRank", field.valueRank);
        }
        if (field.value !== undefined && field.value !== null) {
            xw.writeAttribute("Value", field.value as number);
        }
        if (field.isOptional) {
            xw.writeAttribute("IsOptional", "true");
        }
        if (field.allowSubTypes) {
            xw.writeAttribute("AllowSubTypes", "true");
        }
        if (field.maxStringLength !== undefined && field.maxStringLength !== 0) {
            xw.writeAttribute("MaxStringLength", field.maxStringLength);
        }
        if (field.dataType) {
            xw.writeAttribute("DataType", a(xw, field.dataType));
        }
        if (field.description) {
            const text = typeof field.description === "string" ? field.description : (field.description as { text?: string }).text;
            if (text) {
                xw.startElement("Description").text(text).endElement();
            }
        }
        xw.endElement();
    }
    xw.endElement();
}

// #endregion

// #region values

function writeValue(xw: XmlWriter, variant: VariantOptions | undefined): void {
    if (!variant || variant.value === null || variant.value === undefined) {
        return;
    }
    const dataType = variant.dataType as DataType;
    if (dataType === undefined || dataType === DataType.Null) {
        return;
    }
    const builtInName = DataType[dataType];
    xw.startElement("Value");
    const uax = getPrefix(xw, UAX_TYPES_XSD);
    const isArray = variant.arrayType === VariantArrayType.Array || variant.arrayType === VariantArrayType.Matrix;
    if (isArray) {
        // the built-in type, never a nodeset's own DataType name: uax defines ListOfInt32, and a
        // reader that meets a ListOfSomethingElse walks past it into the first child
        startElementEx(xw, uax, `ListOf${builtInName}`, UAX_TYPES_XSD);
        for (const element of variant.value as unknown[]) {
            writeOneValue(xw, dataType, element, builtInName);
        }
        restoreDefaultNamespace(xw);
        xw.endElement();
    } else {
        writeOneValue(xw, dataType, variant.value, builtInName);
    }
    xw.endElement();
}

/** one value of the built-in type, wrapped in its own `uax:` element unless it is an extension object */
function writeOneValue(xw: XmlWriter, dataType: DataType, value: unknown, builtInName: string): void {
    if (dataType === DataType.ExtensionObject) {
        writeExtensionObject(xw, value as ExtensionObject | XmlExtensionObjectFragment);
        return;
    }
    const uax = getPrefix(xw, UAX_TYPES_XSD);
    xw.startElement(`${uax}${builtInName}`);
    writeScalar(xw, dataType, value);
    xw.endElement();
}

function writeScalar(xw: XmlWriter, dataType: DataType, value: unknown): void {
    if (value === null || value === undefined) {
        return;
    }
    const uax = getPrefix(xw, UAX_TYPES_XSD);
    switch (dataType) {
        case DataType.LocalizedText:
            _dumpLocalizedText(xw, value as Parameters<typeof _dumpLocalizedText>[1]);
            break;
        case DataType.QualifiedName:
            _dumpQualifiedName(xw, value as Parameters<typeof _dumpQualifiedName>[1]);
            break;
        case DataType.NodeId:
        case DataType.ExpandedNodeId:
            _dumpNodeId(xw, value as NodeId);
            break;
        case DataType.DateTime:
            xw.text((value as Date).toISOString());
            break;
        case DataType.Int64:
        case DataType.UInt64:
            xw.text(int64ToDecimalString(value as Int64, dataType === DataType.Int64));
            break;
        case DataType.ByteString: {
            const base64 = Buffer.from(value as Uint8Array).toString("base64");
            const chunks = base64.match(/.{0,80}/g);
            xw.text(base64.length > 80 && chunks ? chunks.join("\n") : base64);
            break;
        }
        case DataType.Guid:
            xw.startElement(`${uax}String`).text(String(value)).endElement();
            break;
        case DataType.StatusCode:
            xw.text(String((value as { value: number }).value));
            break;
        case DataType.XmlElement:
            writeRaw(xw, String(value));
            break;
        default:
            // every remaining built-in is a scalar the XSD writes as text
            xw.text(String(value));
            break;
    }
}

/**
 * an extension object: the XML the reader kept, or one of the four types it decodes. There is no
 * fifth case -- the image codec will not carry a decoded anything else -- so no DataType definition
 * is ever needed to write one back.
 */
function writeExtensionObject(xw: XmlWriter, value: ExtensionObject | XmlExtensionObjectFragment): void {
    const uax = getPrefix(xw, UAX_TYPES_XSD);
    if (value instanceof XmlExtensionObjectFragment) {
        startElementEx(xw, uax, "ExtensionObject", UAX_TYPES_XSD);
        writeTypeId(xw, value.typeId);
        startElementEx(xw, uax, "Body", UAX_TYPES_XSD);
        writeRaw(xw, value.bodyXML);
        restoreDefaultNamespace(xw);
        xw.endElement();
        restoreDefaultNamespace(xw);
        xw.endElement();
        return;
    }
    const encodingId = value.schema?.encodingDefaultXml;
    if (!encodingId || encodingId.isEmpty()) {
        errorLog(`recordsToNodeset2XML: ${value.schema?.name ?? "extension object"} has no XML encoding`);
        return;
    }
    startElementEx(xw, uax, "ExtensionObject", UAX_TYPES_XSD);
    writeTypeId(xw, encodingId);
    startElementEx(xw, uax, "Body", UAX_TYPES_XSD);
    writeDecodedExtensionObject(xw, value);
    restoreDefaultNamespace(xw);
    xw.endElement();
    restoreDefaultNamespace(xw);
    xw.endElement();
}

function writeTypeId(xw: XmlWriter, typeId: NodeId): void {
    const uax = getPrefix(xw, UAX_TYPES_XSD);
    xw.startElement(`${uax}TypeId`);
    xw.startElement(`${uax}Identifier`);
    xw.text(n(xw, typeId));
    xw.endElement();
    xw.endElement();
}

function writeDecodedExtensionObject(xw: XmlWriter, value: ExtensionObject): void {
    const uax = getPrefix(xw, UAX_TYPES_XSD);
    const element = (name: string, write: () => void) => {
        xw.startElement(`${uax}${name}`);
        write();
        xw.endElement();
    };
    const text = (name: string, content: string) => element(name, () => xw.text(content));
    const localizedText = (name: string, v: { locale?: string | null; text?: string | null } | null | undefined) => {
        // null, not undefined: a LocalizedText that carried nothing comes back from the codec with
        // null fields rather than absent ones, and testing for undefined wrote an empty
        // <Description> onto every Argument that never had one
        if (!v || (!v.text && !v.locale)) return;
        element(name, () => _dumpLocalizedText(xw, v as Parameters<typeof _dumpLocalizedText>[1]));
    };

    if (value instanceof Argument) {
        xw.startElement(`${uax}Argument`);
        text("Name", value.name ?? "");
        element("DataType", () => _dumpNodeId(xw, value.dataType));
        text("ValueRank", String(value.valueRank));
        // an empty ArrayDimensions is an empty element, which is what a scalar argument declares
        element("ArrayDimensions", () => {
            for (const dimension of value.arrayDimensions ?? []) {
                text("UInt32", String(dimension));
            }
        });
        localizedText("Description", value.description);
        xw.endElement();
        return;
    }
    if (value instanceof EUInformation) {
        xw.startElement(`${uax}EUInformation`);
        text("NamespaceUri", value.namespaceUri ?? "");
        text("UnitId", String(value.unitId));
        localizedText("DisplayName", value.displayName);
        localizedText("Description", value.description);
        xw.endElement();
        return;
    }
    if (value instanceof Range) {
        xw.startElement(`${uax}Range`);
        text("Low", String(value.low));
        text("High", String(value.high));
        xw.endElement();
        return;
    }
    if (value instanceof EnumValueType) {
        xw.startElement(`${uax}EnumValueType`);
        text("Value", Array.isArray(value.value) ? String(value.value[1]) : String(value.value));
        localizedText("DisplayName", value.displayName);
        localizedText("Description", value.description);
        xw.endElement();
        return;
    }
    errorLog(
        `recordsToNodeset2XML: a record cannot hold a decoded ${value.constructor?.name ?? "extension object"}; ` +
            "the reader keeps anything but the four known types as its XML"
    );
}

/** raw XML, unescaped: a fragment the reader kept is already a document, not text to be quoted */
function writeRaw(xw: XmlWriter, content: string): void {
    const raw = (xw as unknown as { writeRaw?: (s: string) => void }).writeRaw;
    if (typeof raw === "function") {
        raw.call(xw, content);
    } else {
        xw.text(content);
    }
}

// #endregion
