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
import { LocalizedText } from "node-opcua-data-model";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

export interface LocalizedTextJSON {
    /** The Text portion of LocalizedText values shall be encoded as a JSON string. */
    Text: string | null;
    /** The Locale portion of LocalizedText values shall be encoded as a JSON string */
    Locale?: string;
}
export function opcuaJsonEncodeLocalizedText(
    localizedText: LocalizedText | null,
    scheme = JsonEncodingScheme.Compact,
    _namespaceArray?: string[]
): LocalizedTextJSON | string | null | undefined {
    if (!localizedText || (!localizedText.text && !localizedText.locale)) {
        if (scheme === JsonEncodingScheme.Compact) {
            // Compact encoding does not encode empty LocalizedText
            return undefined;
        }
        return null;
    }
    if (scheme === JsonEncodingScheme.DeprecatedNonReversible) {
        // For the non-reversible form, LocalizedText value shall be encoded as a JSON string containing the Text component.
        return localizedText.text || null;
    }
    const pojo: LocalizedTextJSON = {
        Text: localizedText.text || null
    };
    if (localizedText.locale) {
        pojo.Locale = localizedText.locale;
    }
    return pojo;
}

export function opcuaJsonDecodeLocalizedText(pojo: null | undefined | string | LocalizedTextJSON): LocalizedText {
    if (!pojo) {
        return new LocalizedText();
    }
    if (typeof pojo === "string") {
        return new LocalizedText({ text: pojo });
    }
    return new LocalizedText({
        text: pojo.Text,
        locale: pojo.Locale
    });
}
