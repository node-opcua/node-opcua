import { JsonDataSetMessageContentMask } from "node-opcua-types";

export enum JsonEncodingScheme {
    Verbose = 2,
    Compact = 3,
    DeprecatedNonReversible = 0, // false
    DeprecatedReversible = 1
}

/**
 * JSON encoders as per 1.04
 */
export enum JsonEncoderMode104 {
    // biome-ignore lint/style/useLiteralEnumMembers: intentionally aliased to JsonEncodingScheme to keep the two enums in sync
    Reversible = JsonEncodingScheme.DeprecatedReversible,
    // biome-ignore lint/style/useLiteralEnumMembers: intentionally aliased to JsonEncodingScheme to keep the two enums in sync
    NonReversible = JsonEncodingScheme.DeprecatedNonReversible
}

/**
 * From Part 6: 1.05.4:
 *
 * - The CompactEncoding omits all fields with a value equal to the default value for the type.
 * - The VerboseEncoding includes all fields.
 * - The CompactEncoding and VerboseEncoding replace the ReversibleEncoding and
 *   NonReversibleEncoding.
 *   The differences are described in Annex H.
 *   The VerboseEncoding also supports the RawData mode defined in OPC 10000-14.
 *
 *   In RawData mode, encoders shall omit
 *        the following fields:
 *            UaType (see 5.4.2.17 and 5.4.2.18);
 *            UaTypeId (see 5.4.2.16);
 * Decoders may not be able to process streams encoding in RawData mode unless they have
 * access to the associated metadata.
 *
 * These fields are not omitted when serialization uses abstract DataTypes such as Structure
 * (i.e. ExtensionObject) or BaseDataType (i.e. Variant).
 *
 * OPC 10000-14 specifies the behaviour if a Publisher is misconfigured with metadata that
 * uses abstract DataTypes.
 */
export enum JsonEncoderMode105 {
    // biome-ignore lint/style/useLiteralEnumMembers: intentionally aliased to JsonEncodingScheme to keep the two enums in sync
    Verbose = JsonEncodingScheme.Verbose,
    /**
     *  A DataEncoding where encoding the serialized form omits optional and default values.
     *
     *  All DataEncodings are CompactEncodings unless otherwise stated.
     */
    // biome-ignore lint/style/useLiteralEnumMembers: intentionally aliased to JsonEncodingScheme to keep the two enums in sync
    Compact = JsonEncodingScheme.Compact
}

export function toJsonEncodingScheme(mode: JsonEncoderMode104 | JsonEncoderMode105): JsonEncodingScheme {
    switch (mode) {
        case JsonEncoderMode104.Reversible:
            return JsonEncodingScheme.DeprecatedReversible;
        case JsonEncoderMode104.NonReversible:
            return JsonEncodingScheme.DeprecatedNonReversible;
        case JsonEncoderMode105.Verbose:
            return JsonEncodingScheme.Verbose;
        case JsonEncoderMode105.Compact:
            return JsonEncodingScheme.Compact;
        default:
            throw new Error("Invalid JsonEncoderMode");
    }
}

export function makeDataValueEncodingEnum(fieldEncoding1: boolean, fieldEncoding2: boolean): JsonEncodingScheme {
    // https://reference.opcfoundation.org/Core/Part14/v105/docs/6.3.2.3.1#Table112

    /**
     * FieldEncoding1  FieldEncoding2   Description
     * False           True             The JSON VerboseEncoding is used for the
     *                                  DataSetMessage field encoding.
     * True            True             The JSON CompactEncoding is used for the
     *                                  DataSetMessage field encoding.
     * False           False            The deprecated JSON NonReversibleEncoding is used
     *                                  for the DataSetMessage field encoding.
     *                                  The RawData bit of the DataSetFieldContentMask shall be ignored.
     * True            False            The deprecated JSON ReversibleFieldEncoding is used
     *                                  for the DataSetMessage field encoding.
     *                                  The RawData bit of the DataSetFieldContentMask shall be ignored.
     */
    if (fieldEncoding2) {
        // CompactEncoding/VerboseEncoding
        return fieldEncoding1 ? JsonEncodingScheme.Compact : JsonEncodingScheme.Verbose;
    } else {
        return fieldEncoding1 ? JsonEncodingScheme.DeprecatedReversible : JsonEncodingScheme.DeprecatedNonReversible;
    }
}

export function JsonDataSetMessageContentMaskToJsonEncodingScheme(
    jsonDataMessageContentMask: JsonDataSetMessageContentMask
): JsonEncodingScheme {
    const fieldEncoding1 = (jsonDataMessageContentMask & JsonDataSetMessageContentMask.FieldEncoding1) !== 0;
    const fieldEncoding2 = (jsonDataMessageContentMask & JsonDataSetMessageContentMask.FieldEncoding2) !== 0;
    return makeDataValueEncodingEnum(fieldEncoding1, fieldEncoding2);
}
export function JsonEncodingSchemeToJsonDataSetMessageContentMask(scheme: JsonEncodingScheme): JsonDataSetMessageContentMask {
    switch (scheme) {
        case JsonEncodingScheme.Verbose:
            return JsonDataSetMessageContentMask.FieldEncoding2;
        case JsonEncodingScheme.Compact:
            return JsonDataSetMessageContentMask.FieldEncoding1 | JsonDataSetMessageContentMask.FieldEncoding2;
        case JsonEncodingScheme.DeprecatedReversible:
            return JsonDataSetMessageContentMask.FieldEncoding1;
        case JsonEncodingScheme.DeprecatedNonReversible:
            return 0; // no field encoding
        default:
            throw new Error("Invalid JsonEncodingScheme");
    }
}
