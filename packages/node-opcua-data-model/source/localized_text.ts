import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import {
    registerSpecialVariantEncoder,
    parameters,
    buildStructuredType,
    BaseUAObject,
    check_options_correctness_against_schema,
    initialize_field,
    StructuredTypeSchema
} from "node-opcua-factory";
import {
    UAString,
    LocaleId,
    encodeByte, decodeByte,
    decodeString, encodeString
} from "node-opcua-basic-types";



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
    locale: LocaleId;
    text: UAString;

    static get schema(): StructuredTypeSchema {
        return schemaLocalizedText;
    }

    get schema(): StructuredTypeSchema {
        return schemaLocalizedText;
    }

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

    toString(): string {
        return "locale=" + (this as any).locale + " text=" + (this as any).text;
    }

    // OPCUA Part 6 $ 5.2.2.14 : localizedText have a special encoding
    encode(stream: BinaryStream) {

        const encodingMask = getLocalizeText_EncodingByte(this);

        encodeByte(encodingMask, stream);
        if ((encodingMask & 0x01) === 0x01) {
            encodeString(this.locale, stream);
        }

        if ((encodingMask & 0x02) === 0x02) {
            encodeString(this.text, stream);
        }
    }

    decodeDebug(stream: BinaryStream, options: any) {

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

    decode(stream: BinaryStream): void {

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

    static possibleFields: string[] = [
        "locale",
        "text"
    ];
    // xx static encodingDefaultBinary = makeExpandedNodeId(0, 0);
    // xx static encodingDefaultXml = makeExpandedNodeId(0, 0);

    static coerce(value: any): LocalizedText | null {
        return coerceLocalizedText(value);
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
    }
    else emptyLocalizedText.encode(stream);
}
export function decodeLocalizedText(stream: BinaryStream): LocalizedText
{
    const value = new LocalizedText({});
    value.decode(stream);
    return value;
}