/**
 * A Variant value, from the encoding Annex I embeds to the form the loader's records carry.
 *
 * Annex I does not define a value encoding of its own. It embeds the OPC UA JSON encoding of
 * clause 5.4 in its 1.05 form, which `node-opcua-json` already implements: a Variant is
 * `{ UaType, Value, Dimensions }` and an ExtensionObject is identified by `UaTypeId`. So there is
 * nothing to decode here, only to adapt.
 *
 * Two adaptations are needed, and they are the whole of this module.
 *
 * The first is structural. Annex I writes a decoded ExtensionObject body **inline**, as siblings
 * of `UaTypeId`, and reserves `UaBody` for a body it could not decode. Clause 5.4 always nests,
 * so the body is re-nested before it is handed over.
 *
 * The second is where types come from. Records are produced before any address space exists, so
 * the only constructors available are the standard ones. A nodeset that defines its own structure
 * and then uses it as a value cannot be decoded at this point; that is a real limit, and it is
 * reported rather than guessed at.
 */

import { getStandardDataTypeFactory } from "node-opcua-factory";
import type { ExtensionObjectBuilder, ExtensionObjectConstructorFuncWithSchema, VariantJSON105 } from "node-opcua-json";
import { JsonEncoderMode105, opcuaJsonDecodeVariant, opcuaJsonEncodeVariant105 } from "node-opcua-json";
import type { NodeId } from "node-opcua-nodeid";
import { Variant, type VariantOptions } from "node-opcua-variant";
import type { AnnexIVariant } from "./annex_i_types.js";

/** what a value this reader cannot turn into a record raises */
export class AnnexIValueError extends Error {}

/**
 * the constructors of the standard structures, and nothing else.
 *
 * A nodeset may define a DataType and give a Variable a value of it. The XML reader defers those:
 * it parks the body as an `XmlExtensionObjectFragment` and a later pass decodes it once the
 * DataTypes are known. There is no JSON equivalent of that placeholder in the record schema, so
 * this reader can only offer what the standard factory already knows.
 */
const standardBuilder: ExtensionObjectBuilder = {
    getExtensionObjectConstructor(dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
        const info = getStandardDataTypeFactory().getStructureInfoForDataType(dataTypeNodeId);
        const Constructor = info?.constructor;
        if (!Constructor) {
            throw new AnnexIValueError(
                `no standard structure is registered for DataType ${dataTypeNodeId.toString()}; a value whose ` +
                    "type the nodeset itself defines cannot be decoded before the address space exists"
            );
        }
        return Constructor as unknown as ExtensionObjectConstructorFuncWithSchema;
    }
};

const RESERVED = new Set(["UaTypeId", "UaEncoding", "UaBody"]);

/** whether this looks like an ExtensionObject in the Annex I form */
function isExtensionObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) && "UaTypeId" in value;
}

/**
 * the same value with every inline ExtensionObject body moved into `UaBody`.
 *
 * Applied recursively: a structure may hold another, and an array of structures is the ordinary
 * case rather than the exception.
 */
function nestBodies(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(nestBodies);
    }
    if (!isExtensionObject(value)) {
        return value;
    }
    // a body the writer could not decode is already nested, and is left exactly as it is
    if (value.UaBody !== undefined) {
        return value;
    }
    const body: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
        if (!RESERVED.has(key)) {
            body[key] = nestBodies(field);
        }
    }
    return { UaTypeId: value.UaTypeId, UaBody: body };
}

/**
 * a Variant as the loader's records carry it.
 *
 * A value with no `UaType` says nothing this reader can act on, so it is dropped rather than
 * guessed at: a wrong DataType on a Variable is worse than an absent value.
 */
export function decodeAnnexIVariant(variant: AnnexIVariant | undefined, namespaces: string[]): VariantOptions | undefined {
    if (!variant || variant.UaType === undefined || variant.UaType === null) {
        return undefined;
    }
    const prepared: VariantJSON105 = {
        UaType: variant.UaType,
        Value: nestBodies(variant.Value)
    } as VariantJSON105;
    if (variant.Dimensions?.length) {
        (prepared as { Dimensions?: number[] }).Dimensions = variant.Dimensions;
    }
    // the exported entry point routes on UaType vs Type, so it takes the 1.05 path for us
    return opcuaJsonDecodeVariant(prepared, standardBuilder, namespaces);
}

/** the text of a LocalizedText attribute, which the records carry as a plain string */
export function localizedTextValue(value: { t?: string[][] } | undefined): string | undefined {
    const pairs = value?.t;
    if (!pairs?.length) {
        return undefined;
    }
    // the records hold one string, so a document with several locales keeps the first: the loader
    // has never carried more than one either, whether it read XML or an image
    const first = pairs.find((pair) => pair.length >= 2);
    return first ? first[1] : undefined;
}

/** `ArrayDimensions` is a space-separated list in Annex I, as it is an attribute in the XML */
export function parseArrayDimensions(text: string | undefined): number[] | undefined {
    if (text === undefined || text === null || text.trim() === "") {
        return undefined;
    }
    return text
        .split(/[\s,]+/)
        .filter((part) => part.length > 0)
        .map((part) => Number.parseInt(part, 10));
}

/**
 * the same value with every nested ExtensionObject body spread back over its siblings.
 *
 * The inverse of {@link nestBodies}: clause 5.4 nests a body under `UaBody`, Annex I writes it
 * inline. A body the writer could not decode keeps `UaBody`, which is what `UaEncoding` marks.
 */
function inlineBodies(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(inlineBodies);
    }
    if (!isExtensionObject(value) || value.UaBody === undefined) {
        return value;
    }
    if (value.UaEncoding !== undefined && value.UaEncoding !== null && value.UaEncoding !== 0) {
        return value;
    }
    const body = value.UaBody as Record<string, unknown>;
    const out: Record<string, unknown> = { UaTypeId: value.UaTypeId };
    for (const [key, field] of Object.entries(body ?? {})) {
        out[key] = inlineBodies(field);
    }
    return out;
}

/** a record's value as Annex I writes it, or undefined when the record carries none */
export function encodeAnnexIVariant(value: VariantOptions | undefined, namespaces: string[]): AnnexIVariant | undefined {
    if (!value) {
        return undefined;
    }
    // Verbose is the 1.05 form that keeps UaType and the body, which is what Annex I embeds
    const encoded = opcuaJsonEncodeVariant105(new Variant(value), JsonEncoderMode105.Verbose, namespaces);
    if (!encoded || encoded.UaType === undefined || encoded.UaType === null) {
        return undefined;
    }
    const out: AnnexIVariant = { UaType: encoded.UaType, Value: inlineBodies(encoded.Value) };
    const dimensions = (encoded as { Dimensions?: number[] }).Dimensions;
    if (dimensions?.length) out.Dimensions = dimensions;
    return out;
}
