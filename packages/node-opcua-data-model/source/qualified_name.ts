/**
 * @module opcua.datamodel
 */
import { assert } from "node-opcua-assert";
import {
    BaseUAObject,
    check_options_correctness_against_schema,
    initialize_field, registerClassDefinition,
    registerSpecialVariantEncoder,
    buildStructuredType,
    parameters,
    StructuredTypeSchema,
} from "node-opcua-factory";

import * as _ from "underscore";

import { BinaryStream } from "node-opcua-binary-stream";
import { makeExpandedNodeId, ExpandedNodeId } from "node-opcua-nodeid";

import {
    UInt16, Int32 , UAString,
    encodeUInt16, decodeUInt16,
    encodeUAString, decodeUAString
} from "node-opcua-basic-types";

export const schemaQualifiedName = buildStructuredType({
    name: "QualifiedName",
    baseType: "BaseUAObject",
    fields: [
        {
            name: "namespaceIndex",
            fieldType: "UInt16",
        },
        {
            name: "name",
            fieldType: "UAString",
            defaultValue: () => null
        },
    ]
});
schemaQualifiedName.coerce = coerceQualifiedName;

export interface QualifiedNameOptions {
    namespaceIndex?: UInt16;
    name?: UAString;
}

export class QualifiedName extends BaseUAObject {
    namespaceIndex: UInt16;
    name: UAString;
    static schema = schemaQualifiedName;

    /**
     *
     * @class QualifiedName
     * @constructor
     * @extends BaseUAObject
     * @param  options {Object}
     */
    constructor(options: QualifiedNameOptions) {

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
    encode(stream: BinaryStream): void {
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
    decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.namespaceIndex = decodeUInt16(stream);
        this.name = decodeUAString(stream);
    }

    static possibleFields: string[] = [
        "namespaceIndex",
        "name"
    ];
    static encodingDefaultBinary: ExpandedNodeId = makeExpandedNodeId(0, 0);
    static encodingDefaultXml: ExpandedNodeId = makeExpandedNodeId(0, 0);


    toString(): string {
        if (this.namespaceIndex) {
            return this.namespaceIndex + ":" + this.name;
        }
        return this.name || "<null>";
    }

    isEmpty() {
        return !this.name || this.name.length === 0;
    }

}
QualifiedName.prototype.schema = QualifiedName.schema;
// not an extension object registerClassDefinition("QualifiedName", QualifiedName);


export type QualifiedNameLike = QualifiedNameOptions | QualifiedName | string;


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
    if (!isNaN(parseFloat(splitArray[0])) && isFinite(parseInt(splitArray[0])) && isInteger(parseFloat(splitArray[0])) && splitArray.length > 1) {
        namespaceIndex = parseInt(splitArray[0]);
        splitArray.shift();
        value = splitArray.join(":");
    }
    return new QualifiedName({namespaceIndex, name: value});
}

export function coerceQualifiedName(value: any): QualifiedName | null {

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


export function encodeQualifiedName(value: QualifiedName, stream: BinaryStream): void {
    value.encode(stream);
}
export function decodeQualifiedName(stream: BinaryStream): QualifiedName {
    const value = new QualifiedName({});
    value.decode(stream);
    return value;
}