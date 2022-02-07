/**
 * @module node-opcua-data-model
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    DecodeDebugOptions,
    parameters,
    registerSpecialVariantEncoder,
    StructuredTypeSchema
} from "node-opcua-factory";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import {
    decodeByte,
    decodeInt32,
    decodeStatusCode,
    decodeString,
    encodeByte,
    encodeInt32,
    encodeStatusCode,
    encodeString,
    Int32,
    UAString
} from "node-opcua-basic-types";
import { check_options_correctness_against_schema, initialize_field } from "node-opcua-factory";

// --------------------------------------------------------------------------------------------
export const schemaDiagnosticInfo: StructuredTypeSchema = buildStructuredType({
    name: "DiagnosticInfo",

    baseType: "BaseUAObject",

    fields: [
        {
            name: "namespaceUri",

            fieldType: "Int32",

            defaultValue: -1,
            documentation: "The symbolicId is defined within the context of a namespace."
        },
        {
            name: "symbolicId",

            fieldType: "Int32",

            defaultValue: -1,
            documentation: "The symbolicId shall be used to identify a vendor-specific error or condition"
        },
        {
            name: "locale",

            fieldType: "Int32",

            defaultValue: -1,
            documentation: "The locale part of the vendor-specific localized text describing the symbolic id."
        },
        { name: "localizedText", fieldType: "Int32", defaultValue: -1 },
        {
            name: "additionalInfo",

            fieldType: "String",

            defaultValue: null,
            documentation: "Vendor-specific diagnostic information."
        },
        {
            name: "innerStatusCode",

            fieldType: "StatusCode",

            defaultValue: StatusCodes.Good,
            documentation: "The StatusCode from the inner operation."
        },
        {
            name: "innerDiagnosticInfo",

            fieldType: "DiagnosticInfo",

            defaultValue: null,
            documentation: "The diagnostic info associated with the inner StatusCode."
        }
    ]
});

export class DiagnosticInfo extends BaseUAObject {
    public static schema = schemaDiagnosticInfo;
    public static possibleFields = [
        "symbolicId",
        "namespaceURI",
        "locale",
        "localizedText",
        "additionalInfo",
        "innerStatusCode",
        "innerDiagnosticInfo"
    ];

    public symbolicId: Int32;
    public namespaceURI: Int32;
    public locale: Int32;
    public localizedText: Int32;
    public additionalInfo: UAString;
    public innerStatusCode: StatusCode;
    public innerDiagnosticInfo: DiagnosticInfo;

    /**
     *
     * @class DiagnosticInfo
     * @constructor
     * @extends BaseUAObject
     * @param  options {Object}
     */
    constructor(options: DiagnosticInfoOptions = {}) {
        super();
        const schema = schemaDiagnosticInfo;
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }
        this.symbolicId = initialize_field(schema.fields[0], options.symbolicId) as Int32;
        this.namespaceURI = initialize_field(schema.fields[1], options.namespaceURI) as Int32;
        this.locale = initialize_field(schema.fields[2], options.locale) as Int32;
        this.localizedText = initialize_field(schema.fields[3], options.localizedText) as Int32;
        this.additionalInfo = initialize_field(schema.fields[4], options.additionalInfo) as UAString;
        this.innerStatusCode = initialize_field(schema.fields[5], options.innerStatusCode) as StatusCode;
        this.innerDiagnosticInfo = initialize_field(schema.fields[6], options.innerDiagnosticInfo) as DiagnosticInfo;
    }

    public encode(stream: OutputBinaryStream): void {
        encode_DiagnosticInfo(this, stream);
    }

    public decode(stream: BinaryStream): void {
        decode_DiagnosticInfo(this, stream);
    }

    public decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void {
        decodeDebug_DiagnosticInfo(this, stream, options);
    }

    public static filterForResponse(diagnostic: DiagnosticInfo, requestedDiagnostics: number, diagnosticInfoMask: DiagnosticInfo_Mask): DiagnosticInfo {
        const options: DiagnosticInfoOptions = {
            symbolicId: (requestedDiagnostics & diagnosticInfoMask.SymbolicId) ? diagnostic.symbolicId: undefined,
            localizedText: (requestedDiagnostics & diagnosticInfoMask.LocalizedText) ? diagnostic.localizedText: undefined,
            additionalInfo: (requestedDiagnostics & diagnosticInfoMask.AdditionalInfo) ? diagnostic.additionalInfo: undefined,
            innerStatusCode: (requestedDiagnostics & diagnosticInfoMask.InnerStatusCode) ? diagnostic.innerStatusCode: undefined,
            innerDiagnosticInfo: (requestedDiagnostics & diagnosticInfoMask.InnerDiagnostics) ? diagnostic.innerDiagnosticInfo : (
                diagnostic.innerDiagnosticInfo ? DiagnosticInfo.filterForResponse(diagnostic.innerDiagnosticInfo, requestedDiagnostics, diagnosticInfoMask) : undefined
            ),
        }
        return new DiagnosticInfo(options);
    }
}

DiagnosticInfo.prototype.schema = DiagnosticInfo.schema;
DiagnosticInfo.schema.fields[6].schema = DiagnosticInfo.schema;

export interface DiagnosticInfoOptions {
    symbolicId?: Int32;
    namespaceURI?: Int32;
    locale?: Int32;
    localizedText?: Int32;
    additionalInfo?: UAString;
    innerStatusCode?: StatusCode;
    innerDiagnosticInfo?: DiagnosticInfo;
}

export enum DiagnosticInfo_ServiceLevelMask {
    None = 0x00,
    SymbolicId = 0x01,
    LocalizedText = 0x02,
    AdditionalInfo = 0x04,
    InnerStatusCode = 0x08,
    InnerDiagnostics = 0x10
}

export enum DiagnosticInfo_OperationLevelMask {
    SymbolicId = 0x020,
    LocalizedText = 0x040,
    AdditionalInfo = 0x080,
    InnerStatusCode = 0x0100,
    InnerDiagnostics = 0x0200
}

type DiagnosticInfo_Mask = typeof DiagnosticInfo_ServiceLevelMask | typeof DiagnosticInfo_OperationLevelMask;

export const RESPONSE_DIAGNOSTICS_MASK_ALL = 0x3FF;

export function filterDiagnosticInfoLevel(returnDiagnostics: number, diagnostic: DiagnosticInfo | null, diagnosticInfoMask: DiagnosticInfo_Mask): DiagnosticInfo | null {
    if (!diagnostic) {
        return null;
    }

    return DiagnosticInfo.filterForResponse(diagnostic, returnDiagnostics, diagnosticInfoMask);
}

export function filterDiagnosticOperationLevel(returnDiagnostics: number, diagnostic: DiagnosticInfo | null): DiagnosticInfo | null {
    return filterDiagnosticInfoLevel(returnDiagnostics, diagnostic, DiagnosticInfo_OperationLevelMask);
}

export function filterDiagnosticServiceLevel(returnDiagnostics: number, diagnostic: DiagnosticInfo | null): DiagnosticInfo | null {
    return filterDiagnosticInfoLevel(returnDiagnostics, diagnostic, DiagnosticInfo_ServiceLevelMask);
}

export enum DiagnosticInfo_EncodingByte {
    SymbolicId = 0x01,
    NamespaceURI = 0x02,
    LocalizedText = 0x04,
    Locale = 0x08,
    AdditionalInfo = 0x10,
    InnerStatusCode = 0x20,
    InnerDiagnosticInfo = 0x40
}

// tslint:disable:no-bitwise
function getDiagnosticInfoEncodingByte(diagnosticInfo: DiagnosticInfo): DiagnosticInfo_EncodingByte {
    assert(diagnosticInfo);

    let encodingMask = 0;

    if (diagnosticInfo.symbolicId >= 0) {
        encodingMask |= DiagnosticInfo_EncodingByte.SymbolicId;
    }
    if (diagnosticInfo.namespaceURI >= 0) {
        encodingMask |= DiagnosticInfo_EncodingByte.NamespaceURI;
    }
    if (diagnosticInfo.localizedText >= 0) {
        encodingMask |= DiagnosticInfo_EncodingByte.LocalizedText;
    }
    if (diagnosticInfo.locale >= 0) {
        encodingMask |= DiagnosticInfo_EncodingByte.Locale;
    }
    if (diagnosticInfo.additionalInfo) {
        encodingMask |= DiagnosticInfo_EncodingByte.AdditionalInfo;
    }
    if (diagnosticInfo.innerStatusCode && diagnosticInfo.innerStatusCode !== StatusCodes.Good) {
        encodingMask |= DiagnosticInfo_EncodingByte.InnerStatusCode;
    }
    if (diagnosticInfo.innerDiagnosticInfo) {
        encodingMask |= DiagnosticInfo_EncodingByte.InnerDiagnosticInfo;
    }
    return encodingMask;
}

function encode_DiagnosticInfo(diagnosticInfo: DiagnosticInfo, stream: OutputBinaryStream): void {
    const encodingMask = getDiagnosticInfoEncodingByte(diagnosticInfo);

    // write encoding byte
    encodeByte(encodingMask, stream);

    // write symbolic id
    if (encodingMask & DiagnosticInfo_EncodingByte.SymbolicId) {
        encodeInt32(diagnosticInfo.symbolicId, stream);
    }
    // write namespace uri
    if (encodingMask & DiagnosticInfo_EncodingByte.NamespaceURI) {
        encodeInt32(diagnosticInfo.namespaceURI, stream);
    }
    // write locale
    if (encodingMask & DiagnosticInfo_EncodingByte.Locale) {
        encodeInt32(diagnosticInfo.locale, stream);
    }
    // write localized text
    if (encodingMask & DiagnosticInfo_EncodingByte.LocalizedText) {
        encodeInt32(diagnosticInfo.localizedText, stream);
    }
    // write additional info
    if (encodingMask & DiagnosticInfo_EncodingByte.AdditionalInfo) {
        encodeString(diagnosticInfo.additionalInfo, stream);
    }
    // write inner status code
    if (encodingMask & DiagnosticInfo_EncodingByte.InnerStatusCode) {
        encodeStatusCode(diagnosticInfo.innerStatusCode, stream);
    }
    // write  innerDiagnosticInfo
    if (encodingMask & DiagnosticInfo_EncodingByte.InnerDiagnosticInfo) {
        assert(diagnosticInfo.innerDiagnosticInfo !== null, "missing innerDiagnosticInfo");
        if (diagnosticInfo.innerDiagnosticInfo) {
            encode_DiagnosticInfo(diagnosticInfo.innerDiagnosticInfo, stream);
        }
    }
}

function decodeDebug_DiagnosticInfo(diagnosticInfo: DiagnosticInfo, stream: BinaryStream, options: DecodeDebugOptions): void {
    const tracer = options.tracer;

    tracer.trace("start", options.name + "(" + "DiagnosticInfo" + ")", stream.length, stream.length);

    let cursorBefore = stream.length;
    const encodingMask = decodeByte(stream);

    tracer.trace("member", "encodingByte", "0x" + encodingMask.toString(16), cursorBefore, stream.length, "Mask");
    tracer.encoding_byte(encodingMask, DiagnosticInfo_EncodingByte, cursorBefore, stream.length);

    cursorBefore = stream.length;

    // read symbolic id
    if (encodingMask & DiagnosticInfo_EncodingByte.SymbolicId) {
        diagnosticInfo.symbolicId = decodeInt32(stream);
        tracer.trace("member", "symbolicId", diagnosticInfo.symbolicId, cursorBefore, stream.length, "Int32");
        cursorBefore = stream.length;
    }
    // read namespace uri
    if (encodingMask & DiagnosticInfo_EncodingByte.NamespaceURI) {
        diagnosticInfo.namespaceURI = decodeInt32(stream);
        tracer.trace("member", "symbolicId", diagnosticInfo.namespaceURI, cursorBefore, stream.length, "Int32");
        cursorBefore = stream.length;
    }
    // read locale
    if (encodingMask & DiagnosticInfo_EncodingByte.Locale) {
        diagnosticInfo.locale = decodeInt32(stream);
        tracer.trace("member", "locale", diagnosticInfo.locale, cursorBefore, stream.length, "Int32");
        cursorBefore = stream.length;
    }
    // read localized text
    if (encodingMask & DiagnosticInfo_EncodingByte.LocalizedText) {
        diagnosticInfo.localizedText = decodeInt32(stream);
        tracer.trace("member", "localizedText", diagnosticInfo.localizedText, cursorBefore, stream.length, "Int32");
        cursorBefore = stream.length;
    }
    // read additional info
    if (encodingMask & DiagnosticInfo_EncodingByte.AdditionalInfo) {
        diagnosticInfo.additionalInfo = decodeString(stream);
        tracer.trace("member", "additionalInfo", diagnosticInfo.additionalInfo, cursorBefore, stream.length, "String");
        cursorBefore = stream.length;
    }
    // read inner status code
    if (encodingMask & DiagnosticInfo_EncodingByte.InnerStatusCode) {
        diagnosticInfo.innerStatusCode = decodeStatusCode(stream);
        tracer.trace("member", "innerStatusCode", diagnosticInfo.innerStatusCode, cursorBefore, stream.length, "StatusCode");
        cursorBefore = stream.length;
    }
    // read inner status code
    if (encodingMask & DiagnosticInfo_EncodingByte.InnerDiagnosticInfo) {
        diagnosticInfo.innerDiagnosticInfo = new DiagnosticInfo({});
        if (diagnosticInfo.innerDiagnosticInfo) {
            diagnosticInfo.innerDiagnosticInfo.decodeDebug(stream, options);
        }
        tracer.trace(
            "member",
            "innerDiagnosticInfo",
            diagnosticInfo.innerDiagnosticInfo,
            cursorBefore,
            stream.length,
            "DiagnosticInfo"
        );
    }

    tracer.trace("end", options.name, stream.length, stream.length);
}

function decode_DiagnosticInfo(diagnosticInfo: DiagnosticInfo, stream: BinaryStream): void {
    const encodingMask = decodeByte(stream);

    // read symbolic id
    if (encodingMask & DiagnosticInfo_EncodingByte.SymbolicId) {
        diagnosticInfo.symbolicId = decodeInt32(stream);
    }
    // read namespace uri
    if (encodingMask & DiagnosticInfo_EncodingByte.NamespaceURI) {
        diagnosticInfo.namespaceURI = decodeInt32(stream);
    }
    // read locale
    if (encodingMask & DiagnosticInfo_EncodingByte.Locale) {
        diagnosticInfo.locale = decodeInt32(stream);
    }
    // read localized text
    if (encodingMask & DiagnosticInfo_EncodingByte.LocalizedText) {
        diagnosticInfo.localizedText = decodeInt32(stream);
    }
    // read additional info
    if (encodingMask & DiagnosticInfo_EncodingByte.AdditionalInfo) {
        diagnosticInfo.additionalInfo = decodeString(stream);
    }
    // read inner status code
    if (encodingMask & DiagnosticInfo_EncodingByte.InnerStatusCode) {
        diagnosticInfo.innerStatusCode = decodeStatusCode(stream);
    }
    // read inner status code
    if (encodingMask & DiagnosticInfo_EncodingByte.InnerDiagnosticInfo) {
        diagnosticInfo.innerDiagnosticInfo = new DiagnosticInfo({});
        if (diagnosticInfo.innerDiagnosticInfo) {
            diagnosticInfo.innerDiagnosticInfo.decode(stream);
        }
    }
}

const emptyDiagnosticInfo = new DiagnosticInfo({});

export function encodeDiagnosticInfo(value: DiagnosticInfo | null, stream: OutputBinaryStream): void {
    if (value === null) {
        emptyDiagnosticInfo.encode(stream);
    } else {
        value.encode(stream);
    }
}

export function decodeDiagnosticInfo(stream: BinaryStream, _value?: DiagnosticInfo | null): DiagnosticInfo {
    const value = _value || new DiagnosticInfo();
    value.decode(stream);
    return value;
}

// Note:
// the SymbolicId, NamespaceURI, LocalizedText and Locale fields are indexes in a string table which is returned
// in the response header. Only the index of the corresponding string in the string table is encoded. An index
// of −1 indicates that there is no value for the string.
//
registerSpecialVariantEncoder(DiagnosticInfo);
