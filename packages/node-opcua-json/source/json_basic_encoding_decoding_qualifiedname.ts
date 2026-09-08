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
import { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObjectBuilder } from "./json_basic_encoding_body_functor.js";
import { opcuaDecodeURIComponent, opcuaEncodeURIComponent } from "./json_basic_encoding_decoding_nodeid.js";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";
export interface QualifiedNameJSON {
    /** The Name component of the QualifiedName. */
    Name: string;
    /** The NamespaceIndex component of the QualifiedName encoded as a JSON number. */
    Uri?: string | number;
}
export function opcuaJsonEncodeQualifiedName(
    qualifiedName: QualifiedName,
    scheme = JsonEncodingScheme.Compact,
    namespaceArray?: string[]
): QualifiedNameJSON | undefined {
    if (!qualifiedName.name || !qualifiedName.namespaceIndex) {
        if (scheme === JsonEncodingScheme.Compact) {
            // Compact encoding does not encode empty QualifiedName
            return undefined;
        }
    }
    const pojo: QualifiedNameJSON = {
        Name: qualifiedName.name || ""
    };
    /**
     * The NamespaceIndex component of the QualifiedName encoded as a JSON number.
     * The Uri field is omitted if the NamespaceIndex equals 0.
     *  For the non-reversible form, the NamespaceUri associated with the NamespaceIndex
     *  portion of the QualifiedName is encoded as JSON string unless
     *  the NamespaceIndex is 1 or if NamespaceUri is unknown.
     *  In these cases, the NamespaceIndex is encoded as a JSON number.
     */
    if (qualifiedName.namespaceIndex === 0) {
        return pojo;
    }
    const reversible = !(scheme === JsonEncodingScheme.DeprecatedNonReversible);
    if (reversible || !namespaceArray || qualifiedName.namespaceIndex === 1) {
        pojo.Uri = qualifiedName.namespaceIndex;
        return pojo;
    }
    pojo.Uri = namespaceArray[qualifiedName.namespaceIndex];

    return pojo;
}
export function opcuaJsonEncodeQualifiedNameAsString(
    qualifiedName: QualifiedName,
    scheme = JsonEncodingScheme.Compact,
    namespaceArray?: string[]
): string {
    const pojo = opcuaJsonEncodeQualifiedName(qualifiedName, scheme, namespaceArray);
    if (!pojo) {
        return "";
    }
    if (!pojo.Uri) {
        // if Uri is not defined, it means namespaceIndex is 0
        return pojo.Name;
    }

    const namespaceIndex = typeof pojo.Uri === "number" ? (pojo.Uri as number) : namespaceArray?.indexOf(pojo.Uri);
    if (namespaceIndex !== undefined && namespaceIndex >= 0) {
        const namespaceUri = namespaceArray ? namespaceArray[namespaceIndex] : pojo.Uri;
        const encodedUri = opcuaEncodeURIComponent(namespaceUri as string);
        return `nsu=${encodedUri};${pojo.Name}`;
    }
    return pojo.Name;
}

export function opcuaJsonDecodeQualifiedName(
    pojo: null | undefined | string | QualifiedNameJSON,
    builder?: ExtensionObjectBuilder,
    namespaceArray?: string[]
): QualifiedName {
    builder; // unused parameter,

    if (!pojo) {
        return new QualifiedName();
    }
    if (typeof pojo === "string") {
        // example:
        // - Hello
        // - Hello;World
        // - 3:Hello:World
        // - nsu=http://widgets.com/schemas/hello;Hello;World
        // - nsu=tag:acme.com,2023:schemas:data#off%3B;Boiler2

        // check if starts with number + ":"
        if (/^\d+:/.test(pojo)) {
            const parts = pojo.split(":");
            const namespaceIndex = parseInt(parts[0], 10);
            const name = parts.slice(1).join(":");
            return new QualifiedName({
                name,
                namespaceIndex
            });
        }
        // check if starts with "nsu=" up tot he next ";"
        if (pojo.startsWith("nsu=")) {
            const endIndex = pojo.indexOf(";");
            if (endIndex === -1) {
                throw new Error(`Invalid QualifiedName format: ${pojo}`);
            }
            const namespaceUri = opcuaDecodeURIComponent(pojo.substring(4, endIndex));
            const name = pojo.substring(endIndex + 1);
            const namespaceIndex = namespaceArray ? namespaceArray.indexOf(namespaceUri) : 0;
            return new QualifiedName({
                name,
                namespaceIndex
            });
        }
        // otherwise, treat as a simple name
        return new QualifiedName({
            name: pojo,
            namespaceIndex: 0
        });
    }
    const namespaceIndex: number = pojo.Uri && typeof pojo.Uri === "number" ? pojo.Uri : 0;
    return new QualifiedName({
        name: pojo.Name,
        namespaceIndex
    });
}
