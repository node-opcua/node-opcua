/**
 * @module node-opcua-factory
 */
// tslint:disable:no-shadowed-variable
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { BinaryStream, BinaryStreamSizeCalculator, OutputBinaryStream } from "node-opcua-binary-stream";
import { hexDump } from "node-opcua-debug";
import * as utils from "node-opcua-utils";
import * as  _ from "underscore";

import { ExpandedNodeId, makeExpandedNodeId } from "node-opcua-nodeid";
import { getBuildInType } from "./factories_builtin_types";
import { getEnumeration, hasEnumeration } from "./factories_enumerations";
import { callConstructor, getStructureTypeConstructor } from "./factories_factories";
import { get_base_schema, StructuredTypeSchema } from "./factories_structuredTypeSchema";
import { EnumerationDefinition, FieldCategory, StructuredTypeField } from "./types";

function r(str: string, length = 30) {
    return (str + "                                ").substr(0, length);
}

function _decode_member_(value: any, field: StructuredTypeField, stream: BinaryStream, options: any) {

    const tracer = options.tracer;
    const cursorBefore = stream.length;
    const fieldType = field.fieldType;

    switch (field.category) {
        case FieldCategory.basic:
            if (field.schema.decode) {
                value = field.schema.decode(stream);
            }
            tracer.trace("member", options.name, value, cursorBefore, stream.length, fieldType);
            break;
        case FieldCategory.enumeration:
            if (field.schema.decode) {
                value = field.schema.decode(stream);
            }
            tracer.trace("member", options.name, value, cursorBefore, stream.length, fieldType);
            break;
        case FieldCategory.complex: {
            assert(field.category === FieldCategory.complex);

            if (!field.fieldTypeConstructor) {
                field.fieldTypeConstructor = getStructureTypeConstructor(field.fieldType);
            }
            if (!_.isFunction(field.fieldTypeConstructor)) {
                throw new Error("Cannot find constructor for  " + field.name + "of type " + field.fieldType);
            }
            // assert(_.isFunction(field.fieldTypeConstructor));
            const constructor = field.fieldTypeConstructor;
            value = callConstructor(constructor);
            value.decodeDebug(stream, options);
        }
    }

    return value;
}

type Func1 = (a: any, field: StructuredTypeField, data: any, args: any) => void;

function applyOnAllSchemaFields(self: any, schema: StructuredTypeSchema, data: any, functor: Func1, args: any) {
    for (const field of schema.fields) {
        functor(self, field, data, args);
    }
}

const _nbElements = process.env.ARRAYLENGTH ? parseInt(process.env.ARRAYLENGTH, 10) : 10;

function _arrayEllipsis(value: any[] | null) {

    if (!value) {
        return "null []";
    } else {
        if (value.length === 0) {
            return "[ /* empty*/ ]";
        }
        assert(_.isArray(value));
        const v = [];
        const m = Math.min(_nbElements, value.length);
        for (let i = 0; i < m; i++) {
            let element = value[i];
            if (element instanceof Buffer) {
                element = hexDump(element, 32, 16);
            }
            v.push(!utils.isNullOrUndefined(element) ? element.toString() : null);
        }
        return "[ " + v.join(",") + (value.length > 10 ? " ... " : "") + "] (l=" + value.length + ")";
    }
}

function _exploreObject(self: any, field: StructuredTypeField, data: any, args: any) {

    if (!self) {
        return;
    }
    assert(self);

    const fieldType = field.fieldType;

    const fieldName = field.name;
    const category = field.category;

    const padding = data.padding;

    let value = self[fieldName];

    let str;

    const fieldNameF = chalk.yellow(r(padding + fieldName, 30));
    const fieldTypeF = chalk.cyan(("/* " + r(fieldType, 10) + (field.isArray ? "[]" : "  ") + " */"));

    // compact version of very usual objects
    if (fieldType === "QualifiedName" && !field.isArray && value) {

        value = value.toString() || "<null>";
        str = fieldNameF + " " + fieldTypeF + ": " + chalk.green(value.toString());
        data.lines.push(str);
        return;
    }
    if (fieldType === "LocalizedText" && !field.isArray && value) {
        value = value.toString() || "<null>";
        str = fieldNameF + " " + fieldTypeF + ": " + chalk.green(value.toString());
        data.lines.push(str);
        return;
    }

    function _dump_simple_value(self: any, field: StructuredTypeField, data: any, value: any, fieldType: string) {

        let str = "";
        if (value instanceof Buffer) {
            const _hexDump = hexDump(value);
            data.lines.push(fieldNameF + " " + fieldTypeF);
            data.lines.push("BUFFER{" + _hexDump + "}");

        } else {

            if (field.isArray) {
                str = fieldNameF + " " + fieldTypeF + ": " + _arrayEllipsis(value);
            } else {
                if (fieldType === "IntegerId" || fieldType === "UInt32") {
                    value = "" + value + "               0x" + value.toString(16);
                } else if (fieldType === "DateTime" || fieldType === "UtcTime") {
                    value = (value && value.toISOString) ? value.toISOString() : value;
                } else if (typeof value === "object" && value !== null && value !== undefined) {
                    value = value.toString.apply(value, args);
                }
                str = fieldNameF + " " + fieldTypeF + ": "
                  + ((value === null || value === undefined) ? chalk.blue("null") : value.toString());
            }
            data.lines.push(str);
        }
    }

    function _dump_complex_value(self: any, field: StructuredTypeField, data: any, value: any, fieldType: string) {
        if (field.subType) {
            // this is a synonymous
            fieldType = field.subType;
            _dump_simple_value(self, field, data, value, fieldType);

        } else {

            field.fieldTypeConstructor = field.fieldTypeConstructor || getStructureTypeConstructor(fieldType);
            const fieldTypeConstructor = field.fieldTypeConstructor;

            const _newDesc = fieldTypeConstructor.prototype.schema || (fieldTypeConstructor as any).schema;

            if (field.isArray) {
                if (value === null) {
                    data.lines.push(fieldNameF + " " + fieldTypeF + ": null []");
                } else if (value.length === 0) {
                    data.lines.push(fieldNameF + " " + fieldTypeF + ": [ /* empty */ ]");
                } else {
                    data.lines.push(fieldNameF + " " + fieldTypeF + ": [");

                    const m = Math.min(_nbElements, value.length);

                    for (let i = 0; i < m; i++) {
                        const element = value[i];
                        data.lines.push(padding + chalk.cyan("  { " + ("/*" + i + "*/")));

                        const data1 = { padding: padding + "    ", lines: [] };
                        applyOnAllSchemaFields(element, _newDesc, data1, _exploreObject, args);
                        data.lines = data.lines.concat(data1.lines);

                        data.lines.push(padding + "  }" + ((i === value.length - 1) ? "" : ","));
                    }
                    if (m < value.length) {
                        data.lines.push(padding + " ..... ( " + value.length + " elements )");
                    }
                    data.lines.push(padding + "]");
                }

            } else {

                data.lines.push(fieldNameF + " " + fieldTypeF + ": {");
                const data1 = { padding: padding + "  ", lines: [] };
                applyOnAllSchemaFields(value, _newDesc, data1, _exploreObject, args);
                data.lines = data.lines.concat(data1.lines);

                data.lines.push(padding + "}");
            }
        }
    }

    switch (category) {

        case FieldCategory.enumeration:
            const s = field.schema as EnumerationDefinition;
            str = fieldNameF + " " + fieldTypeF + ": " + s.typedEnum.get(value) + " ( " + value + ")";
            data.lines.push(str);
            break;
        case FieldCategory.basic:
            _dump_simple_value(self, field, data, value, fieldType);
            break;
        case FieldCategory.complex:
            _dump_complex_value(self, field, data, value, fieldType);
            break;
        default:
            throw new Error("internal error: unknown kind_of_field " + category);
    }
}

function json_ify(t: any, f: any, field: any, value: any) {

    if (_.isFunction(field.toJSON)) {
        return field.toJSON(value);
    } else if (t && t.toJSON) {
        return t.toJSON(value);
    } else if (value.toJSON) {
        return value.toJSON();
    } else {
        return f;
    }

}

function _JSONify(self: BaseUAObject, schema: StructuredTypeSchema, options: any) {

    /* jshint validthis: true */
    for (const field of schema.fields) {
        const f = (self as any)[field.name];
        if (f === null || f === undefined) {
            continue;
        }

        if (hasEnumeration(field.fieldType)) {
            const enumeration = getEnumeration(field.fieldType);
            assert(enumeration !== null);
            if (field.isArray) {
                options[field.name] = f.map((value: any) => enumeration.enumValues[value.toString()]);
            } else {
                options[field.name] = enumeration.enumValues[f.toString()];
            }

            continue;

        }
        const t = getBuildInType(field.fieldType);

        if (field.isArray) {
            options[field.name] = f.map((value: any) => json_ify(t, value, field, value));
        } else {
            options[field.name] = json_ify(t, f, field, f);
        }
    }
}

export interface DecodeDebugOptions {
    tracer: any;
    name: string;
}

/* tslint:disable:no-empty*/

/**
 * @class BaseUAObject
 * @constructor
 */
export class BaseUAObject {

    public schema: any;

    constructor() {

    }

    /**
     * Encode the object to the binary stream.
     * @class BaseUAObject
     * @method encode
     * @param stream {BinaryStream}
     */
    public encode(stream: OutputBinaryStream): void {
    }

    /**
     * Decode the object from the binary stream.
     * @class BaseUAObject
     * @method decode
     * @param stream {BinaryStream}
     */
    public decode(stream: BinaryStream): void {
    }

    /**
     * Calculate the required size to store this object in a binary stream.
     * @method binaryStoreSize
     * @return number
     */
    public binaryStoreSize(): number {
        const stream = new BinaryStreamSizeCalculator();
        this.encode(stream as OutputBinaryStream);
        return stream.length;
    }

    /**
     * @method toString
     * @return {String}
     */
    public toString(...args: any[]): string {

        if (this.schema && this.schema.hasOwnProperty("toString")) {
            return this.schema.toString.apply(this, arguments);
        } else {
            if (!this.explore) {
                // xx console.log(util.inspect(this));
                return Object.prototype.toString.apply(this, arguments as any);
            }
            return this.explore.apply(this, arguments as any);
        }
    }

    /**
     *
     * verify that all object attributes values are valid according to schema
     * @method isValid
     * @return boolean
     */
    public isValid(): boolean {
        assert(this.schema);
        if (this.schema.isValid) {
            return this.schema.isValid(this);
        } else {
            return true;
        }
    }

    /**
     * @method decodeDebug
     *
     */
    public decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void {

        const tracer = options.tracer;
        const schema = this.schema;

        tracer.trace("start", options.name + "(" + schema.name + ")", stream.length, stream.length);
        const self: any = this as any;

        for (const field of schema.fields) {

            const value = self[field.name];

            if (field.isArray) {

                const cursorBefore = stream.length;
                let nb = stream.readUInt32();
                if (nb === 0xFFFFFFFF) {
                    nb = 0;
                }
                options.name = field.name + [];

                tracer.trace("start_array", field.name, nb, cursorBefore, stream.length);
                for (let i = 0; i < nb; i++) {
                    tracer.trace("start_element", field.name, i);
                    options.name = "element #" + i;

                    _decode_member_(value, field, stream, options);

                    tracer.trace("end_element", field.name, i);

                }
                tracer.trace("end_array", field.name, stream.length - 4);
            } else {

                options.name = field.name;
                _decode_member_(value, field, stream, options);

            }

        }

        tracer.trace("end", schema.name, stream.length, stream.length);
    }

    public explore(): string {

        const data: { padding: string, lines: string[] } = {
            lines: [],
            padding: " "
        };

        data.lines.push("{" + chalk.cyan(" /*" + ( this.schema ? this.schema.name : "") + "*/"));
        if (this.schema) {
            applyOnAllSchemaFields(this, this.schema, data, _exploreObject, arguments);
        }
        data.lines.push("};");
        return data.lines.join("\n");
    }

    public toJSON(): any {

        assert(this.schema);
        if (this.schema.toJSON) {
            return this.schema.toJSON.apply(this, arguments);
        } else {
            assert(this.schema);
            const schema = this.schema;
            const options = {};
            _visitSchemaChain(this, schema, options, _JSONify, null);
            return options;
        }
    }

    public clone(/*options,optionalFilter,extraInfo*/): any {

        const self: any = this as any;

        const params = {};

        function construct_param(schema: any, options: any) {
            for (const field of schema.fields) {
                const f = self[field.name];
                if (f === null || f === undefined) {
                    continue;
                }
                if (field.isArray) {
                    options[field.name] = self[field.name];
                } else {
                    options[field.name] = self[field.name];
                }
            }
        }

        construct_param.call(this, self.schema, params);

        return new self.constructor(params);
    }
}

/*
// tslint:disable:max-classes-per-file
export class ExtensionObject extends BaseUAObject {
    public static encodingDefaultBinary: ExpandedNodeId;
    public static encodingDefaultXml: ExpandedNodeId;
    public encodingDefaultBinary: ExpandedNodeId = ExpandedNodeId.nullExpandedNodeId;
    public encodingDefaultXml: ExpandedNodeId = ExpandedNodeId.nullExpandedNodeId;

    constructor(otions: any) {
        super();
    }
}
*/

function _visitSchemaChain(
  self: BaseUAObject,
  schema: StructuredTypeSchema,
  options: any,
  func: (self: BaseUAObject, schema: StructuredTypeSchema, options: any) => void,
  extraData: any
) {
    assert(_.isFunction(func));

    // apply also construct to baseType schema first
    const baseSchema = get_base_schema(schema);
    if (baseSchema) {
        _visitSchemaChain(self, baseSchema, options, func, extraData);
    }
    func.call(null, self, schema, options);
}
