/**
 * @module node-opcua-data-model
 */
import { assert } from "node-opcua-assert";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema, initialize_field,
    parameters,
    registerSpecialVariantEncoder,
    StructuredTypeSchema
} from "node-opcua-factory";

import * as _ from "underscore";

import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { ExpandedNodeId, makeExpandedNodeId } from "node-opcua-nodeid";

import {
    decodeUAString, decodeUInt16, encodeUAString,
    encodeUInt16, Int32,
    UAString, UInt16
} from "node-opcua-basic-types";

export const schemaQualifiedName = buildStructuredType({
    baseType: "BaseUAObject",
    name: "QualifiedName",

    fields: [
        {
            name: "namespaceIndex",

            fieldType: "UInt16"
        },
        {
            name: "name",

            fieldType: "UAString",

            defaultValue: () => null
        }
    ]
});
schemaQualifiedName.coerce = coerceQualifiedName;

export interface QualifiedNameOptions {
    namespaceIndex?: UInt16;
    name?: UAString;
}

export class QualifiedName extends BaseUAObject {

    public static schema: StructuredTypeSchema = schemaQualifiedName;

    public static possibleFields: string[] = [
        "namespaceIndex",
        "name"
    ];
    public static encodingDefaultBinary: ExpandedNodeId = makeExpandedNodeId(0, 0);
    public static encodingDefaultXml: ExpandedNodeId = makeExpandedNodeId(0, 0);
    public namespaceIndex: UInt16;
    public name: UAString;

    /**
     *
     * @class QualifiedName
     * @constructor
     * @extends BaseUAObject
     * @param  options {Object}
     */
    constructor(options?: QualifiedNameOptions) {

        super();

        const schema = QualifiedName.schema;
        options = options || {};
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }

        /**
         * @property namespaceIndex
         * @type {Int32}
         */
        this.namespaceIndex = initialize_field(schema.fields[0], options.namespaceIndex);

        /**
         * @property name
         * @type {UAString}
         */
        this.name = initialize_field(schema.fields[1], options.name);
    }

    /**
     * encode the object into a binary stream
     * @method encode
     *
     * @param stream {BinaryStream}
     */
    public encode(stream: OutputBinaryStream): void {
        // call base class implementation first
        super.encode(stream);
        encodeUInt16(this.namespaceIndex, stream);
        encodeUAString(this.name, stream);
    }

    /**
     * decode the object from a binary stream
     * @method decode
     *
     * @param stream {BinaryStream}
     */
    public decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.namespaceIndex = decodeUInt16(stream);
        this.name = decodeUAString(stream);
    }

    public toString(): string {
        if (this.namespaceIndex) {
            return this.namespaceIndex + ":" + this.name;
        }
        return this.name || "<null>";
    }

    public isEmpty() {
        return !this.name || this.name.length === 0;
    }

}

QualifiedName.prototype.schema = QualifiedName.schema;
// not an extension object registerClassDefinition("QualifiedName", QualifiedName);

export type QualifiedNameLike = QualifiedNameOptions | string;

// xx QualifiedName.prototype.isEmpty = function (): boolean {
// xx    return !this.name || this.name.length === 0;
// xx}

function isInteger(value: any): boolean {
    return typeof value === "number" &&
        isFinite(value) &&
        Math.floor(value) === value;
}

/**
 * @method stringToQualifiedName
 * @param value {String}
 * @return {{namespaceIndex: Number, name: String}}
 *
 * @example
 *
 *  stringToQualifiedName("Hello")   => {namespaceIndex: 0, name: "Hello"}
 *  stringToQualifiedName("3:Hello") => {namespaceIndex: 3, name: "Hello"}
 */
export function stringToQualifiedName(value: string): QualifiedName {

    const splitArray = value.split(":");
    let namespaceIndex = 0;

    if (!isNaN(parseFloat(splitArray[0])) &&
        isFinite(parseInt(splitArray[0], 10)) &&
        isInteger(parseFloat(splitArray[0])) &&
        splitArray.length > 1) {
        namespaceIndex = parseInt(splitArray[0], 10);
        splitArray.shift();
        value = splitArray.join(":");
    }
    return new QualifiedName({ namespaceIndex, name: value });
}

export function coerceQualifiedName(value: null): null;
export function coerceQualifiedName(value: QualifiedNameLike): QualifiedName;
export function coerceQualifiedName(value: string): QualifiedName;
export function coerceQualifiedName(value: null | QualifiedNameLike): QualifiedName | null {

    if (!value) {
        return null;
    } else if (value instanceof QualifiedName) {
        return value;
    } else if (_.isString(value)) {
        return stringToQualifiedName(value);
    } else {
        assert(value.hasOwnProperty("namespaceIndex"));
        assert(value.hasOwnProperty("name"));
        return new exports.QualifiedName(value);
    }
}

registerSpecialVariantEncoder(QualifiedName);

export function encodeQualifiedName(value: QualifiedName, stream: OutputBinaryStream): void {
    value.encode(stream);
}

export function decodeQualifiedName(stream: BinaryStream): QualifiedName {
    const value = new QualifiedName({});
    value.decode(stream);
    return value;
}
