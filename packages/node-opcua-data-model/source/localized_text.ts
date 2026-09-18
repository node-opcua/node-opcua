/**
 * @module node-opcua-data-model
 */
import { decodeByte, decodeString, encodeByte, encodeString, type LocaleId, type UAString } from "node-opcua-basic-types";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    type DecodeDebugOptions,
    FieldCategory,
    type IStructuredTypeSchema,
    parameters,
    registerSpecialVariantEncoder
} from "node-opcua-factory";

/**
 *
 * @param value
 * @returns
 */
export function coerceLocalizedText(value?: null | string | LocalizedTextOptions): LocalizedText | null {
    if (value === undefined || value === null) {
        return null;
    }
    if (value instanceof LocalizedText) {
        return value;
    }
    return new LocalizedText(value);
}
export function coerceLocalizedTextStrict(value?: null | string | LocalizedTextOptions): LocalizedText {
    let result = coerceLocalizedText(value);
    if (!result) {
        result = new LocalizedText({ locale: null, text: null });
    }
    return result;
}

/**
 * Picks the entry of `texts` that best matches `preferredLocales`.
 *
 * OPC 10000-4 v1.05.07 §5.7.3 ActivateSession: "When a Server returns a string to the
 * Client, it first determines if there are available translations for it. If there are,
 * then the Server returns the string whose locale id exactly matches the locale id with
 * the highest priority in the Client-supplied list. If there are no exact matches, then
 * the Server ignores the <country/region> component of the locale id, and returns the
 * string whose <language> component matches the <language> component of the locale id
 * with the highest priority in the Client supplied list. If there still are no matches,
 * then the Server returns the string that it has along with the locale id." See also
 * §5.4 Locale Negotiation.
 *
 * Matching is case-insensitive. `preferredLocales` in priority order (most preferred
 * first); a `null`/empty entry is skipped. Returns the first element of `texts` when
 * nothing matches or `preferredLocales` is null/empty, and `undefined` when `texts`
 * itself is null/empty.
 */
export function selectLocalizedText(
    texts: readonly LocalizedText[] | null | undefined,
    preferredLocales: readonly (string | null | undefined)[] | null | undefined
): LocalizedText | undefined {
    if (!texts || texts.length === 0) {
        return undefined;
    }
    const language = (locale: string) => locale.split("-")[0];
    for (const wanted of preferredLocales ?? []) {
        if (!wanted) {
            continue;
        }
        const w = wanted.toLowerCase();
        const exact = texts.find((t) => (t.locale ?? "").toLowerCase() === w);
        if (exact) {
            return exact;
        }
        const sameLanguage = texts.find((t) => t.locale && language(t.locale.toLowerCase()) === language(w));
        if (sameLanguage) {
            return sameLanguage;
        }
    }
    return texts[0];
}

// --------------------------------------------------------------------------------------------
// see Part 3 - $8.5 page 63
const schemaLocalizedText = buildStructuredType({
    name: "LocalizedText",

    baseType: "BaseUAObject",
    category: FieldCategory.basic,
    fields: [
        {
            name: "Locale",
            fieldType: "LocaleId",

            defaultValue: null
        },
        {
            name: "Text",
            fieldType: "String",

            defaultValue: null
        }
    ]
});
schemaLocalizedText.coerce = coerceLocalizedText;

export interface LocalizedTextOptions {
    locale?: LocaleId;
    text?: UAString;
}

export class LocalizedText extends BaseUAObject {
    static get schema(): IStructuredTypeSchema {
        return schemaLocalizedText;
    }

    public get schema(): IStructuredTypeSchema {
        return schemaLocalizedText;
    }

    public static possibleFields: string[] = ["locale", "text"];

    public static coerce(value?: null | string | LocalizedTextOptions): LocalizedText | null {
        return coerceLocalizedText(value);
    }

    public locale: LocaleId;
    public text: UAString;

    constructor(options?: LocalizedTextOptions | string | null) {
        super();
        if (options === null) {
            this.locale = null;
            this.text = null;
            return;
        }
        if (typeof options === "string") {
            this.locale = null;
            this.text = options;
            return;
        }
        /* c8 ignore next */
        if (parameters.debugSchemaHelper) {
            const schema = schemaLocalizedText;
            check_options_correctness_against_schema(this, schema, options);
        }
        this.locale = options?.locale || null;
        this.text = options?.text || null;
    }

    public toString(): string {
        return `locale=${this.locale} text=${this.text}`;
    }

    // OPCUA Part 6 $ 5.2.2.14 : localizedText have a special encoding
    public encode(stream: OutputBinaryStream): void {
        const encodingMask = getLocalizeText_EncodingByte(this);

        encodeByte(encodingMask, stream);
        if ((encodingMask & 0x01) === 0x01) {
            encodeString(this.locale, stream);
        }

        if ((encodingMask & 0x02) === 0x02) {
            encodeString(this.text, stream);
        }
    }

    public decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void {
        let cursorBefore: number = 0;
        const tracer = options.tracer;
        tracer.trace("start", `${options.name}(LocalizedText)`, stream.length, stream.length);
        cursorBefore = stream.length;

        const encodingMask = decodeByte(stream);
        tracer.trace("member", "encodingByte", `0x${encodingMask.toString(16)}`, cursorBefore, stream.length, "Mask");
        cursorBefore = stream.length;

        if ((encodingMask & 0x01) === 0x01) {
            this.locale = decodeString(stream);
            tracer.trace("member", "locale", this.locale, cursorBefore, stream.length, "locale");
            cursorBefore = stream.length;
        } else {
            this.locale = null;
        }
        if ((encodingMask & 0x02) === 0x02) {
            this.text = decodeString(stream);
            tracer.trace("member", "text", this.text, cursorBefore, stream.length, "text");
            // cursor_before = stream.length;
        } else {
            this.text = null;
        }
        tracer.trace("end", options.name, stream.length, stream.length);
    }

    public decode(stream: BinaryStream): void {
        const encodingMask = decodeByte(stream);
        if ((encodingMask & 0x01) === 0x01) {
            this.locale = decodeString(stream);
        } else {
            this.locale = null;
        }
        if ((encodingMask & 0x02) === 0x02) {
            this.text = decodeString(stream);
        } else {
            this.text = null;
        }
    }
}

// not an extension object registerClassDefinition("LocalizedText", LocalizedText);
registerSpecialVariantEncoder(LocalizedText);

export type LocalizedTextLike = LocalizedTextOptions | string;

function getLocalizeText_EncodingByte(localizedText: LocalizedText): number {
    let encodingMask = 0;
    if (localizedText.locale) {
        encodingMask |= 0x01;
    }
    if (localizedText.text) {
        encodingMask |= 0x02;
    }
    return encodingMask;
}

const emptyLocalizedText = new LocalizedText({});

// null is supported and always has been - the body falls back to emptyLocalizedText -
// but the parameter did not say so
export function encodeLocalizedText(value: LocalizedText | null, stream: OutputBinaryStream): void {
    if (value) {
        value.encode(stream);
    } else {
        emptyLocalizedText.encode(stream);
    }
}

export function decodeLocalizedText(stream: BinaryStream, value?: LocalizedText): LocalizedText {
    value = value || new LocalizedText(null);
    value.decode(stream);
    return value;
}
