/**
 * @module node-opcua-data-model
 */
import { assert } from "node-opcua-assert";
import {
    decodeByte,
    decodeString,
    encodeByte, encodeString,
    LocaleId, UAString
} from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters,
    registerSpecialVariantEncoder,
    StructuredTypeSchema
} from "node-opcua-factory";

export function coerceLocalizedText(value: any): LocalizedText | null {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value === "string") {
        return new LocalizedText({locale: null, text: value});
    }
    if (value instanceof LocalizedText) {
        return value;
    }
    assert(value.hasOwnProperty("locale"));
    assert(value.hasOwnProperty("text"));
    return new LocalizedText(value);
}

// --------------------------------------------------------------------------------------------
// see Part 3 - $8.5 page 63
const schemaLocalizedText = buildStructuredType({
    name: "LocalizedText",

    baseType: "BaseUAObject",

    fields: [
        {
            name: "locale",

            fieldType: "LocaleId",
        },
        {
            name: "text",

            fieldType: "UAString",

            defaultValue: () => null
        }
    ],
});
schemaLocalizedText.coerce = coerceLocalizedText;

export interface LocalizedTextOptions {
    locale?: LocaleId;
    text?: UAString;
}

export class LocalizedText extends BaseUAObject {

    static get schema(): StructuredTypeSchema {
        return schemaLocalizedText;
    }

    public get schema(): StructuredTypeSchema {
        return schemaLocalizedText;
    }

    public static possibleFields: string[] = [
        "locale",
        "text"
    ];
    // xx static encodingDefaultBinary = makeExpandedNodeId(0, 0);
    // xx static encodingDefaultXml = makeExpandedNodeId(0, 0);

    public static coerce(value: any): LocalizedText | null {
        return coerceLocalizedText(value);
    }
    public locale: LocaleId;
    public text: UAString;

    /**
     *
     * @class LocalizedText
     * @constructor
     * @extends BaseUAObject
     * @param  options {Object}
     */
    constructor(options?: LocalizedTextOptions) {

        super();

        const schema = schemaLocalizedText;
        options = options || {};
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }

        /**
         * @property locale
         * @type {UAString}
         */
        this.locale = initialize_field(schema.fields[0], options.locale);

        /**
         * @property text
         * @type {UAString}
         */
        this.text = initialize_field(schema.fields[1], options.text);
    }

    public toString(): string {
        return "locale=" + (this as any).locale + " text=" + (this as any).text;
    }

    // OPCUA Part 6 $ 5.2.2.14 : localizedText have a special encoding
    public encode(stream: BinaryStream) {

        // tslint:disable:no-bitwise
        const encodingMask = getLocalizeText_EncodingByte(this);

        encodeByte(encodingMask, stream);
        if ((encodingMask & 0x01) === 0x01) {
            encodeString(this.locale, stream);
        }

        if ((encodingMask & 0x02) === 0x02) {
            encodeString(this.text, stream);
        }
    }

    public decodeDebug(stream: BinaryStream, options: any) {

        let cursorBefore;
        const tracer = options.tracer;
        tracer.trace("start", options.name + "(" + "LocalizedText" + ")", stream.length, stream.length);
        cursorBefore = stream.length;

        const encodingMask = decodeByte(stream);
        tracer.trace("member", "encodingByte", "0x" + encodingMask.toString(16), cursorBefore, stream.length, "Mask");
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

export type LocalizedTextLike = LocalizedTextOptions | LocalizedText | string;

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
export function encodeLocalizedText(value: LocalizedText, stream: BinaryStream): void {
    if (value) {
        value.encode(stream);
    } else { emptyLocalizedText.encode(stream); }
}
export function decodeLocalizedText(stream: BinaryStream): LocalizedText {
    const value = new LocalizedText({});
    value.decode(stream);
    return value;
}
