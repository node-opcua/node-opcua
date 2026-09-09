/**
 * ==========================================================================
 * Copyright (c) 2021-2026 Sterfive - etienne.rossignon@sterfive.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 * ==========================================================================
 */
import { DiagnosticInfo } from "node-opcua-data-model";
import type { StatusCode } from "node-opcua-status-code";
import type { ExtensionObjectBuilder } from "./json_basic_encoding_body_functor.js";
import {
    opcuaJsonDecodeStatusCode,
    opcuaJsonEncodeStatusCode,
    type StatusCodeJSON
} from "./json_basic_encoding_decoding_statuscode.js";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

/**
 * JSON form of a DiagnosticInfo
 *
 * reference: https://reference.opcfoundation.org/Core/Part6/v105/docs/5.4.2.13
 *
 * Each field is omitted when it holds its default value (-1 for the string
 * table indexes, null for AdditionalInfo, Good for InnerStatusCode and null for
 * InnerDiagnosticInfo), except in the Verbose encoding where every field is present.
 */
export interface DiagnosticInfoJSON {
    /** index into the string table of the response header, -1 when not set */
    SymbolicId?: number;
    /** index into the string table of the response header, -1 when not set */
    NamespaceUri?: number;
    /** index into the string table of the response header, -1 when not set */
    Locale?: number;
    /** index into the string table of the response header, -1 when not set */
    LocalizedText?: number;
    AdditionalInfo?: string | null;
    InnerStatusCode?: StatusCodeJSON | number | null;
    InnerDiagnosticInfo?: DiagnosticInfoJSON | null;
}

function isEmptyDiagnosticInfo(d: DiagnosticInfo): boolean {
    return (
        d.symbolicId === -1 &&
        d.namespaceURI === -1 &&
        d.locale === -1 &&
        d.localizedText === -1 &&
        !d.additionalInfo &&
        (!d.innerStatusCode || d.innerStatusCode.value === 0) &&
        (!d.innerDiagnosticInfo || isEmptyDiagnosticInfo(d.innerDiagnosticInfo))
    );
}

export function opcuaJsonEncodeDiagnosticInfo(
    diagnosticInfo: DiagnosticInfo | null | undefined,
    scheme = JsonEncodingScheme.Compact,
    namespaceArray?: string[]
): DiagnosticInfoJSON | null | undefined {
    const verbose = scheme === JsonEncodingScheme.Verbose;

    if (!diagnosticInfo || (!verbose && isEmptyDiagnosticInfo(diagnosticInfo))) {
        // an empty DiagnosticInfo is treated like a null value:
        // omitted in the Compact encoding, encoded as null in the deprecated encodings
        return scheme === JsonEncodingScheme.Compact ? undefined : null;
    }
    const d = diagnosticInfo;
    const pojo: DiagnosticInfoJSON = {};

    const setIndex = (key: "SymbolicId" | "NamespaceUri" | "Locale" | "LocalizedText", value: number) => {
        if (verbose || value !== -1) {
            pojo[key] = value;
        }
    };
    setIndex("SymbolicId", d.symbolicId);
    setIndex("NamespaceUri", d.namespaceURI);
    setIndex("Locale", d.locale);
    setIndex("LocalizedText", d.localizedText);

    if (verbose || d.additionalInfo) {
        pojo.AdditionalInfo = d.additionalInfo ?? null;
    }
    const innerStatusCode: StatusCode | null = d.innerStatusCode ?? null;
    if (verbose || (innerStatusCode && innerStatusCode.value !== 0)) {
        const encoded = innerStatusCode ? opcuaJsonEncodeStatusCode(innerStatusCode, scheme) : null;
        pojo.InnerStatusCode = encoded === undefined ? null : encoded;
    }
    if (verbose || d.innerDiagnosticInfo) {
        const inner = opcuaJsonEncodeDiagnosticInfo(d.innerDiagnosticInfo ?? null, scheme, namespaceArray);
        if (verbose || inner) {
            pojo.InnerDiagnosticInfo = inner === undefined ? null : inner;
        }
    }
    return pojo;
}

export function opcuaJsonDecodeDiagnosticInfo(
    pojo: DiagnosticInfoJSON | null | undefined,
    _builder?: ExtensionObjectBuilder,
    _namespaceArray?: string[]
): DiagnosticInfo {
    if (!pojo || typeof pojo !== "object") {
        return new DiagnosticInfo();
    }
    const index = (value: number | undefined | null): number => (typeof value === "number" ? value : -1);
    return new DiagnosticInfo({
        symbolicId: index(pojo.SymbolicId),
        namespaceURI: index(pojo.NamespaceUri),
        locale: index(pojo.Locale),
        localizedText: index(pojo.LocalizedText),
        additionalInfo: pojo.AdditionalInfo ?? null,
        innerStatusCode: opcuaJsonDecodeStatusCode(pojo.InnerStatusCode),
        innerDiagnosticInfo: pojo.InnerDiagnosticInfo ? opcuaJsonDecodeDiagnosticInfo(pojo.InnerDiagnosticInfo) : undefined
    });
}
