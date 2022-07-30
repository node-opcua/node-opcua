/* eslint-disable prefer-rest-params */
/* eslint-disable complexity */
/**
 * @module node-opcua-factory
 */
// tslint:disable:no-shadowed-variable
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator, OutputBinaryStream } from "node-opcua-binary-stream";
import { hexDump, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import * as utils from "node-opcua-utils";

import { getBuiltInEnumeration, hasBuiltInEnumeration } from "./enumerations";
import { DataTypeFactory, _findFieldSchema } from "./datatype_factory";
import { getStructureTypeConstructor } from "./get_standard_data_type_factory";
import { get_base_schema } from "./structured_type_schema";
import {
    EnumerationDefinition,
    FieldCategory,
    StructuredTypeField,
    BuiltInTypeDefinition,
    FieldType,
    CommonInterface,
    Func1,
    IStructuredTypeSchema,
    IBaseUAObject,
    DecodeDebugOptions
} from "./types";

const errorLog = make_errorLog(__filename);

function r(str: string, length = 30) {
    return (str + "                                ").substring(0, length);
}

function _decode_member_(value: any, field: StructuredTypeField, stream: BinaryStream, options: DecodeDebugOptions) {
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
            if (typeof field.fieldTypeConstructor !== "function") {
                throw new Error("Cannot find constructor for  " + field.name + "of type " + field.fieldType);
            }
            // assert(typeof field.fieldTypeConstructor === "function");
            const constructor = field.fieldTypeConstructor;
            value = new constructor();
            value.decodeDebug(stream, options);
        }
    }

    return value;
}

function _applyOnAllSchemaFields<T>(self: BaseUAObject, schema: IStructuredTypeSchema, data: T, functor: Func1<T>, args?: any) {
    const baseSchema = get_base_schema(schema);
    if (baseSchema) {
        _applyOnAllSchemaFields(self, baseSchema, data, functor, args);
    }

    for (const field of schema.fields) {
        functor(self, field, data, args);
    }
}

const _nbElements = typeof process === "object" ? (process.env.ARRAYLENGTH ? parseInt(process.env.ARRAYLENGTH, 10) : 10) : 10;
const fullBuffer = typeof process === "object" ? !!process.env?.FULLBUFFER : false;

function _arrayEllipsis(value: any[] | null, data: ExploreParams): string {
    if (!value) {
        return "null []";
    } else {
        if (value.length === 0) {
            return "[ /* empty*/ ]";
        }
        assert(Array.isArray(value));

        const v = [];

        const m = Math.min(_nbElements, value.length);
        const ellipsis = value.length > _nbElements ? " ... " : "";

        const pad = data.padding + "  ";
        let isMultiLine = true;
        for (let i = 0; i < m; i++) {
            let element = value[i];
            if (element instanceof Buffer) {
                element = hexDump(element, 32, 16);
            } else if (utils.isNullOrUndefined(element)) {
                element = "null";
            } else {
                element = element.toString();
                const s = element.split("\n");
                if (s.length > 1) {
                    element = "\n" + pad + s.join("\n" + pad);
                    isMultiLine = true;
                }
            }
            if (element.length > 80) {
                isMultiLine = true;
            }
            v.push(element);
        }

        const length = "/* length =" + value.length + "*/";
        if (isMultiLine) {
            return "[ " + length + "\n" + pad + v.join(",\n" + pad + "    ") + ellipsis + "\n" + data.padding + "]";
        } else {
            return "[ " + length + v.join(",") + ellipsis + "]";
        }
    }
}

interface ExploreParams {
    padding: string;
    lines: string[];
}
// eslint-disable-next-line complexity
// eslint-disable-next-line max-statements
function _exploreObject(self: BaseUAObject, field: StructuredTypeField, data: ExploreParams, args: any): void {
    if (!self) {
        return;
    }

    const fieldType = field.fieldType;

    const fieldName = field.name;
    const category = field.category;

    const padding = data.padding;

    let value = (self as any)[fieldName];

    let str;

    // decorate the field name with ?# if the field is optional
    let opt = "    ";
    if (field.switchBit !== undefined) {
        opt = " ?" + field.switchBit + " ";
    }

    if (field.switchValue !== undefined) {
        opt = " !" + field.switchValue + " ";
    }
    const allowSubTypeSymbol = field.allowSubType ? "~" : " ";
    const arraySymbol = field.isArray ? "[]" : "  ";
    const fieldNameF = chalk.yellow(r(padding + fieldName, 30));
    const fieldTypeF = chalk.cyan(`/* ${allowSubTypeSymbol}${r(fieldType + opt, 38)}${arraySymbol}  */`);

    // detected when optional field is not specified in value
    if (field.switchBit !== undefined && value === undefined) {
        str = fieldNameF + " " + fieldTypeF + ": " + chalk.italic.grey("undefined") + " /* optional field not specified */";
        data.lines.push(str);
        return;
    }
    // detected when union field is not specified in value
    if (field.switchValue !== undefined && value === undefined) {
        str = fieldNameF + " " + fieldTypeF + ": " + chalk.italic.grey("undefined") + " /* union field not specified */";
        data.lines.push(str);
        return;
    }

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
    if (fieldType === "DataValue" && !field.isArray && value) {
        value = value.toString(data);
        str = fieldNameF + " " + fieldTypeF + ": " + chalk.green(value.toString(data));
        data.lines.push(str);
        return;
    }

    function _dump_enumeration_value(
        self: BaseUAObject,
        field: StructuredTypeField,
        data: ExploreParams,
        value: any,
        fieldType: string
    ) {
        const s = field.schema as EnumerationDefinition;

        // istanbul ignore next
        if (!s.typedEnum) {
            // tslint:disable:no-console
            console.log("xxxx cannot find typeEnum", s);
        }
        const convert = (value: number) => {
            // istanbul ignore next
            if (!s.typedEnum.get(value)) {
                return [value, s.typedEnum.get(value)] as [number, any];
            } else {
                return [value, s.typedEnum.get(value)!.key] as [number, any];
            }
        };
        const toS = ([n, s]: [number, any]) => `${n} /*(${s})*/`;
        if (field.isArray) {
            str =
                fieldNameF +
                " " +
                fieldTypeF +
                ": [" +
                value
                    .map((c: number) => convert(c))
                    .map(toS)
                    .join(", ") +
                "]";
            data.lines.push(str);
        } else {
            const c = convert(value);
            str = `${fieldNameF} ${fieldTypeF}: ${toS(c)}`;
            data.lines.push(str);
        }
    }

    function _dump_simple_value(
        self: BaseUAObject,
        field: StructuredTypeField,
        data: ExploreParams,
        value: any,
        fieldType: string
    ) {
        let str = "";
        if (value instanceof Buffer) {
            data.lines.push(fieldNameF + " " + fieldTypeF);
            if (fullBuffer || value.length <= 32) {
                const _hexDump = value.length <= 32 ? "Ox" + value.toString("hex") : "\n" + hexDump(value);
                data.lines.push("Buffer: " + _hexDump);
            } else {
                const _hexDump1 = value.slice(0, 16).toString("hex");
                const _hexDump2 = value.slice(-16).toString("hex");
                data.lines.push("Buffer: ", _hexDump1 + "..." + _hexDump2);
            }
        } else {
            if (field.isArray) {
                str = fieldNameF + " " + fieldTypeF + ": " + _arrayEllipsis(value, data);
            } else {
                if (field.fieldType === "NodeId" && value instanceof NodeId) {
                    value = value.displayText();
                } else if (fieldType === "IntegerId" || fieldType === "UInt32") {
                    if (field.name === "attributeId") {
                        value = "AttributeIds." + AttributeIds[value] + "/* " + value + " */";
                    } else {
                        const extra = value !== undefined ? "0x" + value.toString(16) : "undefined";
                        value = "" + value + "               " + extra;
                    }
                } else if (fieldType === "DateTime" || fieldType === "UtcTime") {
                    try {
                        value = value && value.toISOString ? value.toISOString() : value;
                    } catch {
                        value = chalk.red(value?.toString() + " *** ERROR ***");
                    }
                } else if (typeof value === "object" && value !== null && value !== undefined) {
                    // eslint-disable-next-line prefer-spread
                    value = value.toString.apply(value, args);
                }
                str =
                    fieldNameF +
                    " " +
                    fieldTypeF +
                    ": " +
                    (value === null || value === undefined ? chalk.blue("null") : value.toString());
            }
            data.lines.push(str);
        }
    }

    function _dump_complex_value(
        self: BaseUAObject,
        field: StructuredTypeField,
        data: ExploreParams,
        value: any,
        fieldType: string
    ) {
        if (field.subType) {
            // this is a synonymous
            fieldType = field.subType;
            _dump_simple_value(self, field, data, value, fieldType);
        } else {
            const typeDictionary = (self.schema as any).$$factory as DataTypeFactory;

            // istanbul ignore next
            if (!typeDictionary) {
                errorLog("Internal Error: No typeDictionary for ", self.schema);
                return;
            }

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

                        const _newFieldSchema = _findFieldSchema(typeDictionary, field, element);

                        data.lines.push(padding + `  { ` + chalk.cyan(`/* ${i} - ${_newFieldSchema?.name}*/`));

                        const data1 = {
                            lines: [] as string[],
                            padding: padding + "    "
                        };
                        _applyOnAllSchemaFields(element, _newFieldSchema, data1, _exploreObject, args);

                        data.lines = data.lines.concat(data1.lines);

                        data.lines.push(padding + "  }" + (i === value.length - 1 ? "" : ","));
                    }
                    if (m < value.length) {
                        data.lines.push(padding + " ..... ( " + value.length + " elements )");
                    }
                    data.lines.push(padding + "]");
                }
            } else {
                const _newFieldSchema = _findFieldSchema(typeDictionary, field, value);
                data.lines.push(fieldNameF + " " + fieldTypeF + ": {");
                const data1 = { padding: padding + "  ", lines: [] as string[] };
                _applyOnAllSchemaFields(value, _newFieldSchema, data1, _exploreObject, args);
                data.lines = data.lines.concat(data1.lines);

                data.lines.push(padding + "}");
            }
        }
    }

    switch (category) {
        case FieldCategory.enumeration:
            _dump_enumeration_value(self, field, data, value, fieldType);
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

function json_ify(t: BuiltInTypeDefinition, value: any, fieldType: FieldType) {
    if (value instanceof Array) {
        return value.map((e) => (e && e.toJSON ? e.toJSON() : e));
    }
    /*
    if (typeof fieldType.toJSON === "function") {
        return fieldType.toJSON(value);
    } else
    */
    if (t && t.toJSON) {
        return t.toJSON(value);
    } else if (value.toJSON) {
        return value.toJSON();
    } else {
        return value;
    }
}

function _JSONify(self: BaseUAObject, schema: IStructuredTypeSchema, pojo: any) {
    /* jshint validthis: true */
    for (const field of schema.fields) {
        const fieldValue = (self as any)[field.name];
        if (fieldValue === null || fieldValue === undefined) {
            continue;
        }

        if (hasBuiltInEnumeration(field.fieldType)) {
            const enumeration = getBuiltInEnumeration(field.fieldType);
            assert(enumeration !== null);
            if (field.isArray) {
                pojo[field.name] = fieldValue.map((value: any) => enumeration.enumValues[value.toString()]);
            } else {
                pojo[field.name] = enumeration.enumValues[fieldValue.toString()];
            }
            continue;
        }
        const t = field.schema as BuiltInTypeDefinition; // getBuiltInType(field.fieldType);

        if (field.isArray) {
            pojo[field.name] = fieldValue.map((value: any) => json_ify(t, value, field));
        } else {
            pojo[field.name] = json_ify(t, fieldValue, field);
        }
    }
}


export interface BaseUAObject extends IBaseUAObject {
    schema: IStructuredTypeSchema;
}

/**
 * @class BaseUAObject
 * @constructor
 */
export class BaseUAObject {
    constructor() {
        /**  */
    }

    /**
     * Encode the object to the binary stream.
     * @class BaseUAObject
     * @method encode
     * @param stream {BinaryStream}
     */
    public encode(stream: OutputBinaryStream): void {
        /** */
    }

    /**
     * Decode the object from the binary stream.
     * @class BaseUAObject
     * @method decode
     * @param stream {BinaryStream}
     */
    public decode(stream: BinaryStream): void {
        /** */
    }

    /**
     * Calculate the required size to store this object in a binary stream.
     * @method binaryStoreSize
     * @return number
     */
    public binaryStoreSize(): number {
        const stream = new BinaryStreamSizeCalculator();
        this.encode(stream);
        return stream.length;
    }

    /**
     * @method toString
     * @return {String}
     */
    public toString(...args: any[]): string {
        if (this.schema && Object.prototype.hasOwnProperty.call(this.schema, "toString")) {
            return this.schema.toString.apply(this, arguments as any);
        } else {
            if (!this.explore) {
                // xx console.log(util.inspect(this));
                return Object.prototype.toString.apply(this, arguments as any);
            }
            return this.explore();
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

            if (typeof field.switchValue === "number") {
                // skip
                if (self["switchField"] !== field.switchValue) {
                    continue;
                }
            }
            if (field.isArray) {
                const cursorBefore = stream.length;
                let nb = stream.readUInt32();
                if (nb === 0xffffffff) {
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
        const data: { padding: string; lines: string[] } = {
            lines: [],
            padding: " "
        };

        data.lines.push("{" + chalk.cyan(" /*" + (this.schema ? this.schema.name : "") + "*/"));
        if (this.schema) {
            this.applyOnAllFields(_exploreObject, data);
        }
        data.lines.push("};");
        return data.lines.join("\n");
    }

    public applyOnAllFields<T>(func: Func1<T>, data: T): void {
        _applyOnAllSchemaFields(this, this.schema, data, func, null);
    }

    public toJSON(): any {
        assert(this.schema);
        if (this.schema.toJSON) {
            return this.schema.toJSON.apply(this, arguments as any);
        } else {
            assert(this.schema);
            const schema = this.schema;
            const pojo = {};
            _visitSchemaChain(this, schema, pojo, _JSONify, null);
            return pojo;
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

function _visitSchemaChain(
    self: BaseUAObject,
    schema: IStructuredTypeSchema,
    pojo: any,
    func: (self: BaseUAObject, schema: IStructuredTypeSchema, pojo: any) => void,
    extraData: any
) {
    assert(typeof func === "function");

    // apply also construct to baseType schema first
    const baseSchema = get_base_schema(schema);
    if (baseSchema) {
        _visitSchemaChain(self, baseSchema, pojo, func, extraData);
    }
    func.call(null, self, schema, pojo);
}
