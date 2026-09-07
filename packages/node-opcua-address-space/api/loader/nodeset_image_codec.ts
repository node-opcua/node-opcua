/**
 * @module node-opcua-address-space
 *
 * The JSON form of a {@link NodesetRecord}: one object per line of a precompiled image. JSON has
 * no Date, Buffer, 64-bit integer or NodeId, so every value type has one written rule here,
 * versioned by {@link NODESET_RECORD_SCHEMA}:
 *
 * - NodeId: the number alone when numeric in namespace 0, `[namespaceIndex, value]` when numeric
 *   elsewhere, `[namespaceIndex, "i" | "s" | "g" | "b", value]` otherwise, the index being the
 *   file's own table; an ExpandedNodeId adds `namespaceUri` and `serverIndex` around it
 * - a reference: `[isForward ? 1 : 0, referenceType, target]`, with a fourth element `0` when the
 *   target's record does not declare the inverse (the loader adds a back reference for those)
 * - QualifiedName: `[namespaceIndex, name]`; LocalizedText: `{ locale, text }`
 * - DateTime: ISO-8601 string, or `{ iso, picoseconds }` when sub-millisecond precision is carried
 * - ByteString: base64; Guid, String, XmlElement: the string
 * - Int64 and UInt64: a decimal string; Float and Double: JSON numbers, `NaN`, `Infinity` and
 *   `-Infinity` as strings; StatusCode: the numeric code
 * - the extension objects the XML reader decodes itself (Argument, EUInformation, Range,
 *   EnumValueType): `{ "$class": name, ...fields }` with the rules above; every other extension
 *   object is the XML fragment the reader captured: `{ "$xml": [typeId, body] }`
 *
 * A value is `{ dataType, arrayType?, dimensions?, value }`; `arrayType` is omitted for a scalar.
 *
 * Every key whose value is the one it would take anyway is left out; {@link NODE_DEFAULTS} is the
 * table, and a reader that does not find a key applies the default from it. gzip already codes a
 * key repeated verbatim in a couple of bits, so this is worth far less compressed than it looks
 * on the raw text -- except for `displayName`, which repeats the browse name on 97% of the nodes
 * of the published nodesets and is the one omission that carries real entropy away.
 */
import type { Int64, UInt64 } from "node-opcua-basic-types";
import { int64ToDecimalString } from "./nodeset_xml_primitives.js";
import { Range } from "node-opcua-data-access";
import {
    coerceLocalizedText,
    coerceQualifiedName,
    type LocalizedText,
    type LocalizedTextOptions,
    NodeClass,
    QualifiedName,
    type QualifiedNameOptions
} from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import { ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { coerceStatusCode, StatusCode } from "node-opcua-status-code";
import { Argument, EnumValueType, EUInformation } from "node-opcua-types";
import { DataType, Variant, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import {
    NODESET_RECORD_SCHEMA,
    type NodesetDataTypeDefinitionRecord,
    type NodesetDefinitionField,
    type NodesetHeaderRecord,
    type NodesetModelRecord,
    type NodesetNodeRecord,
    type NodesetReferenceRecord,
    XmlExtensionObjectFragment
} from "./nodeset_record.js";

/**
 * a NodeId: the number alone when numeric in namespace 0 (nearly every id of a nodeset),
 * `[namespaceIndex, value]` when numeric elsewhere, `[namespaceIndex, kind, value]` otherwise
 */
export type JsonNodeId = number | [number, number] | [number, "i" | "s" | "g" | "b", number | string];
/** a reference: `[isForward ? 1 : 0, referenceType, target]`, plus `0` when the inverse is not declared by the target */
export type JsonReference = [0 | 1, JsonNodeId, JsonNodeId] | [0 | 1, JsonNodeId, JsonNodeId, 0];
export type JsonQualifiedName = [number, string];

/** what a corrupt or foreign image raises; the loader discards such an image and rebuilds it */
export class NodesetImageError extends Error {}

// #region ids
const KIND_OF_TYPE: Record<number, "i" | "s" | "g" | "b"> = {
    [NodeIdType.NUMERIC]: "i",
    [NodeIdType.STRING]: "s",
    [NodeIdType.GUID]: "g",
    [NodeIdType.BYTESTRING]: "b"
};
const TYPE_OF_KIND = { i: NodeIdType.NUMERIC, s: NodeIdType.STRING, g: NodeIdType.GUID, b: NodeIdType.BYTESTRING } as const;

export function encodeNodeId(nodeId: NodeId): JsonNodeId {
    const kind = KIND_OF_TYPE[nodeId.identifierType];
    if (kind === "i") {
        return nodeId.namespace === 0 ? (nodeId.value as number) : [nodeId.namespace, nodeId.value as number];
    }
    const value = kind === "b" ? Buffer.from(nodeId.value as Buffer).toString("base64") : (nodeId.value as number | string);
    return [nodeId.namespace, kind, value];
}
export function decodeNodeId(json: unknown): NodeId {
    if (typeof json === "number") {
        return new NodeId(NodeIdType.NUMERIC, json, 0);
    }
    if (Array.isArray(json) && json.length === 2 && typeof json[0] === "number" && typeof json[1] === "number") {
        return new NodeId(NodeIdType.NUMERIC, json[1], json[0]);
    }
    if (!Array.isArray(json) || json.length !== 3 || typeof json[0] !== "number" || !(json[1] in TYPE_OF_KIND)) {
        throw new NodesetImageError(`not a NodeId: ${JSON.stringify(json)}`);
    }
    const [namespace, kind, value] = json as [number, "i" | "s" | "g" | "b", number | string];
    const identifier = kind === "b" ? Buffer.from(value as string, "base64") : value;
    return new NodeId(TYPE_OF_KIND[kind], identifier, namespace);
}
const encodeNodeIdOrNull = (nodeId: NodeId | null | undefined): JsonNodeId | null => (nodeId ? encodeNodeId(nodeId) : null);
const decodeNodeIdOrNull = (json: unknown): NodeId | null => (json === null || json === undefined ? null : decodeNodeId(json));

export function encodeQualifiedName(name: QualifiedNameOptions): JsonQualifiedName {
    return [name.namespaceIndex ?? 0, name.name ?? ""];
}
export function decodeQualifiedName(json: unknown): QualifiedName {
    if (!Array.isArray(json) || json.length !== 2) {
        throw new NodesetImageError(`not a QualifiedName: ${JSON.stringify(json)}`);
    }
    return new QualifiedName({ namespaceIndex: json[0] as number, name: json[1] as string });
}

interface JsonLocalizedText {
    locale?: string | null;
    text?: string | null;
}
function encodeLocalizedText(text: LocalizedTextOptions | LocalizedText | null | undefined): JsonLocalizedText | null {
    if (text === null || text === undefined) return null;
    const out: JsonLocalizedText = {};
    if (text.locale !== undefined && text.locale !== null) out.locale = text.locale;
    if (text.text !== undefined && text.text !== null) out.text = text.text;
    return out;
}
function decodeLocalizedText(json: unknown): LocalizedText {
    const j = (json || {}) as JsonLocalizedText;
    return coerceLocalizedText({ locale: j.locale ?? undefined, text: j.text ?? undefined }) as LocalizedText;
}
// #endregion

// #region values
type Json = unknown;

function encodeDate(date: Date): Json {
    const picoseconds = (date as Date & { picoseconds?: number }).picoseconds;
    return picoseconds !== undefined ? { iso: date.toISOString(), picoseconds } : date.toISOString();
}
function decodeDate(json: Json): Date {
    if (typeof json === "string") return new Date(json);
    const j = json as { iso: string; picoseconds?: number };
    const date = new Date(j.iso);
    if (j.picoseconds !== undefined) (date as Date & { picoseconds?: number }).picoseconds = j.picoseconds;
    return date;
}
function encodeFloat(value: number): Json {
    if (Number.isNaN(value)) return "NaN";
    if (value === Number.POSITIVE_INFINITY) return "Infinity";
    if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
    return value;
}
function decodeFloat(json: Json): number {
    if (typeof json === "string") return Number(json);
    return json as number;
}

// #region defaults
/**
 * what a key of a node record means when the image leaves it out: the value the reader would have
 * produced anyway. A writer omits a key whose encoded value is its default here; a reader that
 * does not find a key applies the default. The XML reader synthesizes every one of these from an
 * absent attribute (see `nodeset_xml_producer`) and the address space export already omitted most
 * of them, so this table is also what makes the two record producers agree.
 *
 * `displayName` is not in the table: its default is the node's own browse name rather than a
 * constant, and it is the only key a reader must put back rather than infer, since a consumer
 * reads it directly. It is also the only omission worth much once gzipped -- a constant repeated
 * verbatim on every line costs a couple of bits, a browse name repeated does not.
 */
const NODE_DEFAULTS: Readonly<Record<string, unknown>> = {
    valueRank: -1,
    arrayDimensions: null,
    minimumSamplingInterval: 0,
    historizing: false,
    isAbstract: false,
    symmetric: false,
    containsNoLoops: false,
    hasNoPermissions: false,
    eventNotifier: 0,
    parentNodeId: null,
    dataType: null,
    methodDeclarationId: null
};

/** the same, for one field of a DataType definition; an absent DataType attribute is BaseDataType */
const FIELD_DEFAULT_VALUE_RANK = -1;
const FIELD_DEFAULT_ALLOW_SUBTYPES = false;
const FIELD_DEFAULT_DATA_TYPE: JsonNodeId = 24; // i=24, BaseDataType

/** an absent ValueRank on an Argument, as on any other node */
const ARGUMENT_DEFAULT_VALUE_RANK = -1;

/** drop from `out` every key whose value is the one a reader would assume anyway */
function omitDefaults(out: Record<string, unknown>): void {
    for (const [key, fallback] of Object.entries(NODE_DEFAULTS)) {
        if (key in out && out[key] === fallback) {
            delete out[key];
        }
    }
}

/** whether a localized text carries nothing: the reader's `{}` for an absent Description */
const isEmptyText = (text: JsonLocalizedText | null | undefined): boolean =>
    text === null || text === undefined || (text.locale === undefined && text.text === undefined);

// #endregion

// #region 64-bit integers
//
// on the wire a 64-bit integer is a decimal string, the spelling Part 6 uses and the only one that
// says what it means. In memory it stays node-opcua's `[high, low]` pair, whose halves are
// unsigned: Int64 -1 and UInt64 18446744073709551615 are the *same* pair, so the pair cannot be
// read without knowing the signedness from somewhere else, and Int64 min has two equally defensible
// spellings ([2147483648,0] and [-2147483648,0]) which would give one value two documents.

const TWO_64 = 1n << 64n;

const encodeInt64 = int64ToDecimalString;

function decodeInt64(json: Json): Int64 {
    let unsigned = BigInt(json as string);
    if (unsigned < 0n) unsigned += TWO_64;
    return [Number(unsigned >> 32n), Number(unsigned & 0xffffffffn)] as Int64;
}

// #endregion

function encodeExtensionObject(value: unknown): Json {
    if (value instanceof XmlExtensionObjectFragment) {
        return { $xml: [encodeNodeId(value.typeId), value.bodyXML] };
    }
    if (value instanceof Argument) {
        const out: Record<string, Json> = { $class: "Argument", name: value.name, dataType: encodeNodeId(value.dataType) };
        if (value.valueRank !== ARGUMENT_DEFAULT_VALUE_RANK) out.valueRank = value.valueRank;
        // an empty arrayDimensions is what a scalar argument carries and is left out; a `null` one
        // is not the same thing to the reader that put it there, and is written
        if (value.arrayDimensions === null || value.arrayDimensions.length > 0) out.arrayDimensions = value.arrayDimensions;
        const description = encodeLocalizedText(value.description);
        if (!isEmptyText(description)) out.description = description;
        return out;
    }
    if (value instanceof EUInformation) {
        const out: Record<string, Json> = {
            $class: "EUInformation",
            namespaceUri: value.namespaceUri,
            unitId: value.unitId
        };
        const displayName = encodeLocalizedText(value.displayName);
        const description = encodeLocalizedText(value.description);
        if (!isEmptyText(displayName)) out.displayName = displayName;
        if (!isEmptyText(description)) out.description = description;
        return out;
    }
    if (value instanceof Range) {
        return { $class: "Range", low: encodeFloat(value.low), high: encodeFloat(value.high) };
    }
    if (value instanceof EnumValueType) {
        const out: Record<string, Json> = { $class: "EnumValueType", value: encodeInt64(value.value, true) };
        const displayName = encodeLocalizedText(value.displayName);
        const description = encodeLocalizedText(value.description);
        if (!isEmptyText(displayName)) out.displayName = displayName;
        if (!isEmptyText(description)) out.description = description;
        return out;
    }
    const name = (value as ExtensionObject).constructor?.name ?? typeof value;
    throw new NodesetImageError(
        `an image cannot carry a decoded ${name}: only the XML reader's fragments and its four decoded types`
    );
}
function decodeExtensionObject(json: Json): ExtensionObject | XmlExtensionObjectFragment | null {
    const j = json as Record<string, unknown>;
    if (Array.isArray(j.$xml)) {
        return new XmlExtensionObjectFragment(decodeNodeId(j.$xml[0]), j.$xml[1] as string);
    }
    switch (j.$class) {
        case "Argument": {
            // built the way the XML reader builds one: an empty instance whose fields are assigned,
            // so that an empty arrayDimensions stays empty instead of being normalised by the constructor
            const argument = new Argument({});
            argument.name = j.name as string;
            argument.dataType = decodeNodeId(j.dataType);
            argument.valueRank = (j.valueRank as number | undefined) ?? ARGUMENT_DEFAULT_VALUE_RANK;
            // an absent arrayDimensions is the empty one the reader leaves on a scalar argument;
            // an explicit `null` is the one the address space export writes, and is kept apart
            argument.arrayDimensions = j.arrayDimensions === undefined ? [] : (j.arrayDimensions as number[] | null);
            argument.description = decodeLocalizedText(j.description);
            return argument;
        }
        case "EUInformation":
            return new EUInformation({
                namespaceUri: j.namespaceUri as string,
                unitId: j.unitId as number,
                displayName: decodeLocalizedText(j.displayName),
                description: decodeLocalizedText(j.description)
            });
        case "Range": {
            const range = new Range({});
            range.low = decodeFloat(j.low);
            range.high = decodeFloat(j.high);
            return range;
        }
        case "EnumValueType":
            return new EnumValueType({
                value: decodeInt64(j.value as Json),
                displayName: decodeLocalizedText(j.displayName),
                description: decodeLocalizedText(j.description)
            });
        default:
            throw new NodesetImageError(`unknown extension object form ${JSON.stringify(json).slice(0, 80)}`);
    }
}

function encodeElement(dataType: DataType, value: unknown): Json {
    if (value === null || value === undefined) return null;
    switch (dataType) {
        case DataType.Null:
            return null;
        case DataType.Float:
        case DataType.Double:
            return encodeFloat(value as number);
        case DataType.DateTime:
            return value instanceof Date ? encodeDate(value) : value;
        case DataType.ByteString:
            return Buffer.isBuffer(value) ? value.toString("base64") : value;
        case DataType.NodeId:
            return value instanceof NodeId ? encodeNodeId(value) : value;
        case DataType.ExpandedNodeId: {
            if (!(value instanceof NodeId)) return value;
            const expanded = value as ExpandedNodeId;
            return { id: encodeNodeId(value), namespaceUri: expanded.namespaceUri ?? null, serverIndex: expanded.serverIndex ?? 0 };
        }
        case DataType.QualifiedName:
            return encodeQualifiedName(value as QualifiedNameOptions);
        case DataType.LocalizedText:
            return encodeLocalizedText(value as LocalizedTextOptions);
        case DataType.StatusCode:
            return value instanceof StatusCode ? value.value : value;
        case DataType.ExtensionObject:
            return encodeExtensionObject(value);
        case DataType.Variant:
            return value instanceof Variant ? encodeValue(value) : encodeValue(value as VariantOptions);
        case DataType.DataValue:
        case DataType.DiagnosticInfo:
            throw new NodesetImageError(`an image cannot carry a ${DataType[dataType]} value`);
        case DataType.Int64:
            return encodeInt64(value as Int64, true);
        case DataType.UInt64:
            return encodeInt64(value as UInt64, false);
        default:
            // Boolean, the 32-bit-and-under integer families, String, Guid, XmlElement
            return value;
    }
}
function decodeElement(dataType: DataType, json: Json): unknown {
    if (json === null || json === undefined) return null;
    switch (dataType) {
        case DataType.Null:
            return null;
        case DataType.Float:
        case DataType.Double:
            return decodeFloat(json);
        case DataType.DateTime:
            return decodeDate(json);
        case DataType.ByteString:
            return Buffer.from(json as string, "base64");
        case DataType.NodeId:
            return decodeNodeId(json);
        case DataType.ExpandedNodeId: {
            const j = json as { id: JsonNodeId; namespaceUri: string | null; serverIndex: number };
            const nodeId = decodeNodeId(j.id);
            return new ExpandedNodeId(nodeId.identifierType, nodeId.value, nodeId.namespace, j.namespaceUri, j.serverIndex);
        }
        case DataType.QualifiedName:
            return coerceQualifiedName(decodeQualifiedName(json));
        case DataType.LocalizedText:
            return decodeLocalizedText(json);
        case DataType.StatusCode:
            return coerceStatusCode(json as number);
        case DataType.ExtensionObject:
            return decodeExtensionObject(json);
        case DataType.Variant:
            return new Variant(decodeValue(json as JsonValue));
        case DataType.Int64:
        case DataType.UInt64:
            return decodeInt64(json);
        default:
            return json;
    }
}

export interface JsonValue {
    dataType: DataType;
    arrayType?: VariantArrayType;
    dimensions?: number[] | null;
    value: Json;
}

export function encodeValue(options: VariantOptions | Variant): JsonValue {
    const dataType = (options.dataType ?? DataType.Null) as DataType;
    const arrayType = (options.arrayType ??
        (Array.isArray(options.value) && dataType !== DataType.Int64 && dataType !== DataType.UInt64
            ? VariantArrayType.Array
            : VariantArrayType.Scalar)) as VariantArrayType;
    const out: JsonValue = { dataType, value: null };
    if (arrayType !== VariantArrayType.Scalar) {
        out.arrayType = arrayType;
        if (arrayType === VariantArrayType.Matrix && options.dimensions) {
            out.dimensions = options.dimensions;
        }
        const array = options.value as ArrayLike<unknown> | null;
        out.value = array === null || array === undefined ? null : Array.from(array, (e) => encodeElement(dataType, e));
    } else {
        out.value = encodeElement(dataType, options.value);
    }
    return out;
}

export function decodeValue(json: JsonValue): VariantOptions {
    const dataType = json.dataType;
    const arrayType = json.arrayType ?? VariantArrayType.Scalar;
    const out: VariantOptions = { dataType, arrayType };
    if (arrayType !== VariantArrayType.Scalar) {
        out.value = json.value === null ? null : (json.value as Json[]).map((e) => decodeElement(dataType, e));
        if (arrayType === VariantArrayType.Matrix) {
            out.dimensions = json.dimensions ?? null;
        }
    } else {
        out.value = decodeElement(dataType, json.value);
    }
    return out;
}
// #endregion

// #region records
export interface NodesetImageHeader {
    kind: "header";
    schema: number;
    addressSpaceVersion: string;
    createdAt: string;
    /** the byte length of the XML source, when the image comes from one */
    sourceLength?: number;
    namespaceUris: string[];
    models: Array<{
        modelUri: string;
        version: string;
        publicationDate: string | null;
        requiredModels: Array<{ modelUri: string; version: string; publicationDate: string | null }>;
        symbolicName?: string;
        accessRestrictions?: string;
    }>;
    aliases: Record<string, JsonNodeId>;
    extensions?: string[];
}

export interface NodesetImageTrailer {
    kind: "trailer";
    nodes: number;
    sourceDigest: string;
}

export interface EncodeHeaderOptions {
    addressSpaceVersion?: string;
    sourceLength?: number;
    createdAt?: Date;
}

/** a date as the XML reader leaves it: an absent or unparsable one is an invalid Date, written as null */
const encodeDateOrNull = (date: Date | undefined): string | null =>
    date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
const decodeDateOrInvalid = (iso: string | null | undefined): Date => (iso ? new Date(iso) : new Date(Number.NaN));

export function encodeHeader(record: NodesetHeaderRecord, options: EncodeHeaderOptions = {}): NodesetImageHeader {
    const aliases: Record<string, JsonNodeId> = {};
    for (const [name, nodeId] of Object.entries(record.aliases)) {
        aliases[name] = encodeNodeId(nodeId);
    }
    const header: NodesetImageHeader = {
        kind: "header",
        schema: NODESET_RECORD_SCHEMA,
        addressSpaceVersion: options.addressSpaceVersion ?? "unknown",
        createdAt: (options.createdAt ?? new Date()).toISOString(),
        namespaceUris: record.namespaceUris,
        models: record.models.map((m) => {
            const model: NodesetImageHeader["models"][number] = {
                modelUri: m.modelUri,
                version: m.version,
                publicationDate: encodeDateOrNull(m.publicationDate),
                requiredModels: m.requiredModels.map((r) => ({
                    modelUri: r.modelUri,
                    version: r.version,
                    publicationDate: encodeDateOrNull(r.publicationDate)
                }))
            };
            if (m.symbolicName !== undefined) model.symbolicName = m.symbolicName;
            if (m.accessRestrictions !== undefined) model.accessRestrictions = m.accessRestrictions;
            return model;
        }),
        aliases
    };
    if (record.extensions?.length) header.extensions = record.extensions;
    if (options.sourceLength !== undefined) header.sourceLength = options.sourceLength;
    return header;
}

export function decodeHeader(json: NodesetImageHeader): NodesetHeaderRecord {
    if (json.kind !== "header") {
        throw new NodesetImageError("the first line of an image must be its header");
    }
    if (json.schema !== NODESET_RECORD_SCHEMA) {
        throw new NodesetImageError(`image schema ${json.schema} is not the schema ${NODESET_RECORD_SCHEMA} this loader reads`);
    }
    const aliases: Record<string, NodeId> = {};
    for (const [name, id] of Object.entries(json.aliases || {})) {
        aliases[name] = decodeNodeId(id);
    }
    const models: NodesetModelRecord[] = (json.models || []).map((m) => {
        const model: NodesetModelRecord = {
            modelUri: m.modelUri,
            version: m.version,
            publicationDate: m.publicationDate ? new Date(m.publicationDate) : undefined,
            requiredModels: (m.requiredModels || []).map((r) => ({
                modelUri: r.modelUri,
                version: r.version,
                publicationDate: decodeDateOrInvalid(r.publicationDate)
            }))
        };
        if (m.symbolicName !== undefined) model.symbolicName = m.symbolicName;
        if (m.accessRestrictions !== undefined) model.accessRestrictions = m.accessRestrictions;
        return model;
    });
    const header: NodesetHeaderRecord = { kind: "header", namespaceUris: json.namespaceUris || [], models, aliases };
    if (json.extensions?.length) header.extensions = json.extensions;
    return header;
}

interface JsonField extends Omit<NodesetDefinitionField, "dataType"> {
    dataType?: JsonNodeId | null;
}
export interface NodesetImageNode {
    nodeClass: NodeClass;
    nodeId: JsonNodeId;
    browseName: JsonQualifiedName;
    displayName?: string;
    description?: string;
    category?: string[];
    documentation?: string;
    references: JsonReference[];
    releaseStatus?: "Draft" | "Deprecated";
    symbolicName?: string;
    accessRestrictions?: string;
    hasNoPermissions?: boolean;
    rolePermissions?: Array<{ roleId: JsonNodeId; permissions: number }>;
    isAbstract?: boolean;
    eventNotifier?: number;
    inverseName?: string;
    symmetric?: boolean;
    containsNoLoops?: boolean;
    parentNodeId?: JsonNodeId | null;
    dataType?: JsonNodeId | null;
    valueRank?: number;
    arrayDimensions?: number[] | null;
    minimumSamplingInterval?: number;
    historizing?: boolean;
    accessLevel?: string;
    userAccessLevel?: string;
    value?: JsonValue;
    methodDeclarationId?: JsonNodeId | null;
    definition?: { name?: string; isUnion?: boolean; isOptionSet?: boolean; fields: JsonField[] };
}

const OPTIONAL_PLAIN: Array<keyof NodesetNodeRecord & keyof NodesetImageNode> = [
    "displayName",
    "description",
    "category",
    "documentation",
    "releaseStatus",
    "symbolicName",
    "accessRestrictions",
    "hasNoPermissions",
    "isAbstract",
    "eventNotifier",
    "inverseName",
    "symmetric",
    "containsNoLoops",
    "valueRank",
    "arrayDimensions",
    "minimumSamplingInterval",
    "historizing",
    "accessLevel",
    "userAccessLevel"
];

export function encodeNode(record: NodesetNodeRecord): NodesetImageNode {
    const out: NodesetImageNode = {
        nodeClass: record.nodeClass,
        nodeId: encodeNodeId(record.nodeId),
        browseName: encodeQualifiedName(record.browseName),
        references: record.references.map(
            (r): JsonReference =>
                r.inverseDeclared
                    ? [r.isForward ? 1 : 0, encodeNodeId(r.referenceType), encodeNodeId(r.nodeId)]
                    : [r.isForward ? 1 : 0, encodeNodeId(r.referenceType), encodeNodeId(r.nodeId), 0]
        )
    };
    for (const key of OPTIONAL_PLAIN) {
        const v = record[key];
        if (v !== undefined) {
            (out as unknown as Record<string, unknown>)[key] = v;
        }
    }
    if (record.rolePermissions) {
        out.rolePermissions = record.rolePermissions.map((p) => ({ roleId: encodeNodeId(p.roleId), permissions: p.permissions }));
    }
    if (record.parentNodeId !== undefined) out.parentNodeId = encodeNodeIdOrNull(record.parentNodeId);
    if (record.dataType !== undefined) out.dataType = encodeNodeIdOrNull(record.dataType);
    if (record.methodDeclarationId !== undefined) out.methodDeclarationId = encodeNodeIdOrNull(record.methodDeclarationId);
    if (record.value !== undefined) out.value = encodeValue(record.value);
    if (record.definition) {
        out.definition = { fields: record.definition.fields.map(encodeDefinitionField) };
        if (record.definition.name !== undefined) out.definition.name = record.definition.name;
        if (record.definition.isUnion !== undefined) out.definition.isUnion = record.definition.isUnion;
        if (record.definition.isOptionSet !== undefined) out.definition.isOptionSet = record.definition.isOptionSet;
    }
    if (out.displayName !== undefined && out.displayName === out.browseName[1]) {
        // the browse name over again on nearly every node of a published nodeset; a reader puts it back
        delete out.displayName;
    }
    omitDefaults(out as unknown as Record<string, unknown>);
    return out;
}

function encodeDefinitionField(field: NodesetDefinitionField): JsonField {
    const out = { ...field, dataType: encodeNodeIdOrNull(field.dataType) } as JsonField & Record<string, unknown>;
    if (out.valueRank === FIELD_DEFAULT_VALUE_RANK) delete out.valueRank;
    if (out.allowSubTypes === FIELD_DEFAULT_ALLOW_SUBTYPES) delete out.allowSubTypes;
    if (out.dataType === FIELD_DEFAULT_DATA_TYPE) delete out.dataType;
    return out;
}

function decodeDefinitionField(json: JsonField): NodesetDefinitionField {
    const field = {
        ...json,
        valueRank: json.valueRank ?? FIELD_DEFAULT_VALUE_RANK,
        allowSubTypes: json.allowSubTypes ?? FIELD_DEFAULT_ALLOW_SUBTYPES,
        dataType: decodeNodeIdOrNull(json.dataType ?? FIELD_DEFAULT_DATA_TYPE)
    };
    return field as unknown as NodesetDefinitionField;
}

export function decodeNode(json: NodesetImageNode): NodesetNodeRecord {
    if (typeof json.nodeClass !== "number" || !(json.nodeClass in NodeClass)) {
        throw new NodesetImageError(`not a node record: ${JSON.stringify(json).slice(0, 80)}`);
    }
    const record: NodesetNodeRecord = {
        kind: "node",
        nodeClass: json.nodeClass,
        nodeId: decodeNodeId(json.nodeId),
        browseName: decodeQualifiedName(json.browseName),
        references: (json.references || []).map(
            (r): NodesetReferenceRecord => ({
                isForward: r[0] === 1,
                referenceType: decodeNodeId(r[1]),
                nodeId: decodeNodeId(r[2]),
                inverseDeclared: r.length === 3
            })
        )
    };
    for (const key of OPTIONAL_PLAIN) {
        const v = (json as unknown as Record<string, unknown>)[key];
        if (v !== undefined) {
            (record as unknown as Record<string, unknown>)[key] = v;
        }
    }
    // an absent displayName is the browse name: what the writer left out because it was the same
    if (record.displayName === undefined) {
        record.displayName = record.browseName.name ?? "";
    }
    if (json.rolePermissions) {
        record.rolePermissions = json.rolePermissions.map((p) => ({ roleId: decodeNodeId(p.roleId), permissions: p.permissions }));
    }
    if (json.parentNodeId !== undefined) record.parentNodeId = decodeNodeIdOrNull(json.parentNodeId);
    if (json.dataType !== undefined) record.dataType = decodeNodeIdOrNull(json.dataType);
    if (json.methodDeclarationId !== undefined) record.methodDeclarationId = decodeNodeIdOrNull(json.methodDeclarationId);
    if (json.value !== undefined) record.value = decodeValue(json.value);
    if (json.definition) {
        const definition: NodesetDataTypeDefinitionRecord = {
            fields: json.definition.fields.map(decodeDefinitionField)
        };
        if (json.definition.name !== undefined) definition.name = json.definition.name;
        if (json.definition.isUnion !== undefined) definition.isUnion = json.definition.isUnion;
        if (json.definition.isOptionSet !== undefined) definition.isOptionSet = json.definition.isOptionSet;
        record.definition = definition;
    }
    return record;
}
// #endregion
