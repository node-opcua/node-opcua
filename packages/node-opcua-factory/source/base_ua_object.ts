/**
 * @module node-opcua-factory
 */
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { type BinaryStream, BinaryStreamSizeCalculator, type OutputBinaryStream } from "node-opcua-binary-stream";
import { hexDump, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { isNullOrUndefined } from "node-opcua-utils";
import type { DataTypeFactory } from "./datatype_factory.js";
import { getBuiltInEnumeration, hasBuiltInEnumeration } from "./enumerations.js";
import { getStructureTypeConstructor } from "./get_standard_data_type_factory.js";

import {
    type BuiltInTypeDefinition,
    type ConstructorFuncWithSchema,
    type DecodeDebugOptions,
    type EnumerationDefinition,
    FieldCategory,
    type FieldType,
    type Func1,
    type IBaseUAObject,
    type IStructuredTypeSchema,
    type StructuredTypeField
} from "./types.js";

const errorLog = make_errorLog("base_ua_object");

function r(str: string, length = 30) {
    return `${str}                                `.substring(0, length);
}

function _findFieldSchema(typeDictionary: DataTypeFactory, field: StructuredTypeField, value: unknown): IStructuredTypeSchema {
    const fieldType = field.fieldType;

    const valueWithConstructor = value as { constructor: ConstructorFuncWithSchema } | null | undefined;

    if (field.allowSubTypes && field.category === "complex") {
        const fieldTypeConstructor = valueWithConstructor ? valueWithConstructor.constructor : field.fieldTypeConstructor;

        const _newFieldSchema = (fieldTypeConstructor as ConstructorFuncWithSchema).schema;

        return _newFieldSchema as IStructuredTypeSchema;
    }

    const fieldTypeConstructor = field.fieldTypeConstructor;
    if (fieldTypeConstructor) {
        if (valueWithConstructor?.constructor && valueWithConstructor.constructor !== fieldTypeConstructor) {
            // this should not happen, as we are not expecting value to be
            // a subtype of the declared field type
            errorLog(
                "Error: unexpected subtype ",
                valueWithConstructor.constructor.name,
                " instead of ",
                (fieldTypeConstructor as ConstructorFuncWithSchema)?.name
            );
        }
        return (fieldTypeConstructor as ConstructorFuncWithSchema).prototype.schema;
    }

    const strucutreInfo = typeDictionary.getStructureInfoByTypeName(fieldType);
    return strucutreInfo.schema;
}

function _decode_member_(value: unknown, field: StructuredTypeField, stream: BinaryStream, options: DecodeDebugOptions) {
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
                throw new Error(`Cannot find constructor for  ${field.name}of type ${field.fieldType}`);
            }
            // assert(typeof field.fieldTypeConstructor === "function");
            // biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
            const constructor = field.fieldTypeConstructor;
            const complexValue = new constructor();
            complexValue.decodeDebug(stream, options);
            value = complexValue;
        }
    }

    return value;
}

function _applyOnAllSchemaFields<T>(self: BaseUAObject, schema: IStructuredTypeSchema, data: T, functor: Func1<T>, args?: unknown) {
    const baseSchema = schema.getBaseSchema();
    if (baseSchema) {
        _applyOnAllSchemaFields(self, baseSchema, data, functor, args);
    }

    for (const field of schema.fields) {
        functor(self, field, data, args);
    }
}

const _nbElements = typeof process === "object" ? (process.env.ARRAYLENGTH ? parseInt(process.env.ARRAYLENGTH, 10) : 10) : 10;
const fullBuffer = typeof process === "object" ? !!process.env?.FULLBUFFER : false;

function _arrayEllipsis(value: unknown[] | null, data: ExploreParams): string {
    if (!value) {
        return "null []";
    } else {
        if (value.length === 0) {
            return "[ /* empty*/ ]";
        }
        assert(Array.isArray(value));

        const v: string[] = [];

        const m = Math.min(_nbElements, value.length);
        const ellipsis = value.length > _nbElements ? " ... " : "";

        const pad = `${data.padding}  `;
        let isMultiLine = true;
        for (let i = 0; i < m; i++) {
            const rawElement = value[i];
            let element: string;
            if (rawElement instanceof Buffer) {
                element = hexDump(rawElement, 32, 16);
            } else if (isNullOrUndefined(rawElement)) {
                element = "null";
            } else {
                element = (rawElement as { toString(): string }).toString();
                const s = element.split("\n");
                if (s.length > 1) {
                    element = `\n${pad}${s.join(`\n${pad}`)}`;
                    isMultiLine = true;
                }
            }
            if (element.length > 80) {
                isMultiLine = true;
            }
            v.push(element);
        }

        const length = `/* length =${value.length}*/`;
        if (isMultiLine) {
            return `[ ${length}\n${pad}${v.join(`,\n${pad}    `)}${ellipsis}\n${data.padding}]`;
        } else {
            return `[ ${length}${v.join(",")}${ellipsis}]`;
        }
    }
}

interface ExploreParams {
    padding: string;
    lines: string[];
}
function _exploreObject(self: BaseUAObject, field: StructuredTypeField, data: ExploreParams, args: unknown): void {
    if (!self) {
        return;
    }

    const fieldType = field.fieldType;

    const fieldName = field.name;
    const category = field.category;

    const padding = data.padding;

    let value = (self as unknown as Record<string, unknown>)[fieldName] as {
        toString(...args: unknown[]): string;
    };

    let str: string;

    // decorate the field name with ?# if the field is optional
    let opt = "    ";
    if (field.switchBit !== undefined) {
        opt = ` ?${field.switchBit} `;
    }

    if (field.switchValue !== undefined) {
        opt = ` !${field.switchValue} `;
    }
    const allowSubTypeSymbol = field.allowSubTypes ? "~" : " ";
    const arraySymbol = field.isArray ? "[]" : "  ";
    const fieldNameF = chalk.yellow(r(padding + fieldName, 30));
    const fieldTypeF = chalk.cyan(`/* ${allowSubTypeSymbol}${r(fieldType + opt, 38)}${arraySymbol}  */`);

    // detected when optional field is not specified in value
    if (field.switchBit !== undefined && value === undefined) {
        str = `${fieldNameF} ${fieldTypeF}: ${chalk.italic.grey("undefined")} /* optional field not specified */`;
        data.lines.push(str);
        return;
    }
    // detected when union field is not specified in value
    if (field.switchValue !== undefined && value === undefined) {
        str = `${fieldNameF} ${fieldTypeF}: ${chalk.italic.grey("undefined")} /* union field not specified */`;
        data.lines.push(str);
        return;
    }

    // compact version of very usual objects
    if (fieldType === "QualifiedName" && !field.isArray && value) {
        value = value.toString() || "<null>";
        str = `${fieldNameF} ${fieldTypeF}: ${chalk.green(value.toString())}`;
        data.lines.push(str);
        return;
    }
    if (fieldType === "LocalizedText" && !field.isArray && value) {
        value = value.toString() || "<null>";
        str = `${fieldNameF} ${fieldTypeF}: ${chalk.green(value.toString())}`;
        data.lines.push(str);
        return;
    }
    if (fieldType === "DataValue" && !field.isArray && value) {
        value = value.toString(data);
        str = `${fieldNameF} ${fieldTypeF}: ${chalk.green(value.toString(data))}`;
        data.lines.push(str);
        return;
    }
    if (fieldType === "DiagnosticInfo" && !field.isArray && value) {
        value = value.toString(data);
        str = `${fieldNameF} ${fieldTypeF}: ${chalk.green(value.toString(data))}`;
        data.lines.push(str);
        return;
    }

    function _dump_enumeration_value(
        _self: BaseUAObject,
        field: StructuredTypeField,
        data: ExploreParams,
        value: unknown,
        _fieldType: string
    ) {
        const s = field.schema as EnumerationDefinition;

        // c8 ignore next
        if (!s.typedEnum) {
            errorLog("xxxx cannot find typeEnum", s);
        }
        const convert = (value: number) => {
            // c8 ignore next
            if (!s.typedEnum.get(value)) {
                return [value, s.typedEnum.get(value)] as [number, unknown];
            } else {
                return [value, s.typedEnum.get(value)?.key] as [number, unknown];
            }
        };
        const toS = ([n, s]: [number, unknown]) => `${n} /*(${s})*/`;
        if (field.isArray) {
            str =
                fieldNameF +
                " " +
                fieldTypeF +
                ": [" +
                (value as number[])
                    .map((c: number) => convert(c))
                    .map(toS)
                    .join(", ") +
                "]";
            data.lines.push(str);
        } else {
            const c = convert(value as number);
            str = `${fieldNameF} ${fieldTypeF}: ${toS(c)}`;
            data.lines.push(str);
        }
    }

    function _dump_simple_value(
        _self: BaseUAObject,
        field: StructuredTypeField,
        data: ExploreParams,
        valueIn: unknown,
        fieldType: string
    ) {
        let str = "";
        if (valueIn instanceof Buffer) {
            const value = valueIn;
            data.lines.push(`${fieldNameF} ${fieldTypeF}`);
            if (fullBuffer || value.length <= 32) {
                const _hexDump = value.length <= 32 ? `Ox${value.toString("hex")}` : `\n${hexDump(value)}`;
                data.lines.push(`Buffer: ${_hexDump}`);
            } else {
                const _hexDump1 = value.subarray(0, 16).toString("hex");
                const _hexDump2 = value.subarray(-16).toString("hex");
                data.lines.push("Buffer: ", `${_hexDump1}...${_hexDump2}`);
            }
        } else {
            if (field.isArray) {
                str = `${fieldNameF} ${fieldTypeF}: ${_arrayEllipsis(valueIn as unknown[] | null, data)}`;
            } else {
                let value: unknown = valueIn;
                if (field.fieldType === "NodeId" && value instanceof NodeId) {
                    value = value.displayText();
                } else if (fieldType === "IntegerId" || fieldType === "UInt32") {
                    if (field.name === "attributeId") {
                        value = `AttributeIds.${AttributeIds[value as number]}/* ${value} */`;
                    } else {
                        const extra = value !== undefined ? `0x${(value as number).toString(16)}` : "undefined";
                        value = `${value}               ${extra}`;
                    }
                } else if (fieldType === "DateTime" || fieldType === "UtcTime") {
                    try {
                        const dateLike = value as { toISOString?: () => string } | null | undefined;
                        value = dateLike?.toISOString ? dateLike.toISOString() : value;
                    } catch {
                        value = chalk.red(`${(value as { toString?: () => string })?.toString?.()} *** ERROR ***`);
                    }
                } else if (typeof value === "object" && value !== null && value !== undefined) {
                    const objValue = value as { toString: (...args: unknown[]) => string };
                    value = objValue.toString.apply(objValue, args as unknown[]);
                }
                str =
                    fieldNameF +
                    " " +
                    fieldTypeF +
                    ": " +
                    (value === null || value === undefined ? chalk.blue("null") : (value as { toString(): string }).toString());
            }
            data.lines.push(str);
        }
    }

    function _dump_complex_value(
        self: BaseUAObject,
        field: StructuredTypeField,
        data: ExploreParams,
        value: unknown,
        fieldType: string
    ) {
        if (field.subType) {
            // this is a synonymous
            fieldType = field.subType;
            _dump_simple_value(self, field, data, value, fieldType);
        } else {
            const typeDictionary = self.schema.getDataTypeFactory();

            // c8 ignore next
            if (!typeDictionary) {
                errorLog("Internal Error: No typeDictionary for ", self.schema);
                return;
            }

            if (field.isArray) {
                const valueArray = value as unknown[] | null;
                if (valueArray === null) {
                    data.lines.push(`${fieldNameF} ${fieldTypeF}: null []`);
                } else if (valueArray.length === 0) {
                    data.lines.push(`${fieldNameF} ${fieldTypeF}: [ /* empty */ ]`);
                } else {
                    data.lines.push(`${fieldNameF} ${fieldTypeF}: [`);
                    const m = Math.min(_nbElements, valueArray.length);

                    for (let i = 0; i < m; i++) {
                        const element = valueArray[i] as BaseUAObject;

                        const _newFieldSchema = _findFieldSchema(typeDictionary, field, element);

                        data.lines.push(`${padding}  { ${chalk.cyan(`/* ${i} - ${_newFieldSchema?.name}*/`)}`);

                        const data1 = {
                            lines: [] as string[],
                            padding: `${padding}    `
                        };
                        _applyOnAllSchemaFields(element, _newFieldSchema, data1, _exploreObject, args);

                        data.lines = data.lines.concat(data1.lines);

                        data.lines.push(`${padding}  }${i === valueArray.length - 1 ? "" : ","}`);
                    }
                    if (m < valueArray.length) {
                        data.lines.push(`${padding} ..... ( ${valueArray.length} elements )`);
                    }
                    data.lines.push(`${padding}]`);
                }
            } else {
                const _newFieldSchema = _findFieldSchema(typeDictionary, field, value);
                data.lines.push(`${fieldNameF} ${fieldTypeF}: {`);
                const data1 = { padding: `${padding}  `, lines: [] as string[] };
                _applyOnAllSchemaFields(value as BaseUAObject, _newFieldSchema, data1, _exploreObject, args);
                data.lines = data.lines.concat(data1.lines);

                data.lines.push(`${padding}}`);
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
            throw new Error(`internal error: unknown kind_of_field ${category}`);
    }
}

function json_ify(t: BuiltInTypeDefinition, value: unknown, _fieldType: FieldType): unknown {
    if (Array.isArray(value)) {
        return value.map((e) => ((e as { toJSON?: () => unknown })?.toJSON ? (e as { toJSON(): unknown }).toJSON() : e));
    }
    /*
    if (typeof fieldType.toJSON === "function") {
        return fieldType.toJSON(value);
    } else
    */
    if (t?.toJSON) {
        return t.toJSON(value);
    } else if ((value as { toJSON?: () => unknown })?.toJSON) {
        return (value as { toJSON(): unknown }).toJSON();
    } else {
        return value;
    }
}

function _JSONify(self: BaseUAObject, schema: IStructuredTypeSchema, pojo: Record<string, unknown>) {
    /* jshint validthis: true */
    for (const field of schema.fields) {
        const fieldValue = (self as unknown as Record<string, unknown>)[field.name];
        if (fieldValue === null || fieldValue === undefined) {
            continue;
        }

        if (hasBuiltInEnumeration(field.fieldType)) {
            const enumeration = getBuiltInEnumeration(field.fieldType);
            assert(enumeration !== null);
            if (field.isArray) {
                pojo[field.name] = (fieldValue as unknown[]).map((value) => enumeration.enumValues[String(value)]);
            } else {
                pojo[field.name] = enumeration.enumValues[String(fieldValue)];
            }
            continue;
        }
        const t = field.schema as BuiltInTypeDefinition; // getBuiltInType(field.fieldType);

        if (field.isArray) {
            pojo[field.name] = (fieldValue as unknown[]).map((value) => json_ify(t, value, field));
        } else {
            pojo[field.name] = json_ify(t, fieldValue, field);
        }
    }
}

export interface BaseUAObject extends IBaseUAObject {
    schema: IStructuredTypeSchema;
}

/**
 * base class for all OPCUA objects
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: interface adds typed members/overloads for this class
export class BaseUAObject {
    /**
     * Encode the object to the binary stream.
     */
    public encode(_stream: OutputBinaryStream): void {
        /** */
    }

    /**
     * Decode the object from the binary stream.
     */
    public decode(_stream: BinaryStream): void {
        /** */
    }

    /**
     * Calculate the required size to store this object in a binary stream.
     */
    public binaryStoreSize(): number {
        const stream = new BinaryStreamSizeCalculator();
        this.encode(stream);
        return stream.length;
    }

    /**
     */
    public toString(...args: unknown[]): string {
        if (this.schema && Object.hasOwn(this.schema, "toString")) {
            return this.schema.toString.apply(this, args as unknown as []);
        } else {
            if (!this.explore) {
                return Object.prototype.toString.apply(this, args as unknown as []);
            }
            return this.explore();
        }
    }

    /**
     *
     * verify that all object attributes values are valid according to schema
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
     *
     */
    public decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void {
        const tracer = options.tracer;
        const schema = this.schema;

        tracer.trace("start", `${options.name}(${schema.name})`, stream.length, stream.length);
        const self = this as unknown as Record<string, unknown>;

        for (const field of schema.fields) {
            const value = self[field.name];

            if (typeof field.switchValue === "number") {
                // skip
                if (self.switchField !== field.switchValue) {
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
                    options.name = `element #${i}`;

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

        data.lines.push(`{${chalk.cyan(` /*${this.schema ? this.schema.name : ""}*/`)}`);
        if (this.schema) {
            this.applyOnAllFields(_exploreObject, data);
        }
        data.lines.push("};");
        return data.lines.join("\n");
    }

    public applyOnAllFields<T>(func: Func1<T>, data: T): void {
        _applyOnAllSchemaFields(this, this.schema, data, func, null);
    }

    public toJSON(...args: unknown[]): unknown {
        assert(this.schema);
        if (this.schema?.toJSON) {
            return this.schema.toJSON.apply(this, args as unknown as [value: unknown]);
        } else {
            assert(this.schema);
            const schema = this.schema;
            const pojo: Record<string, unknown> = {};
            _visitSchemaChain(this, schema, pojo, _JSONify, null);
            return pojo;
        }
    }

    public clone(): IBaseUAObject {
        const self = this as unknown as Record<string, unknown> & {
            schema: IStructuredTypeSchema;
            constructor: new (options?: Record<string, unknown>) => BaseUAObject;
        };

        const params: Record<string, unknown> = {};

        const schema = self.schema;
        // biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
        const constructor = self.constructor;

        // get all fields from baseType and current type
        _applyOnAllSchemaFields(
            this,
            schema,
            params,
            (_: IBaseUAObject, field: StructuredTypeField, data: Record<string, unknown>) => {
                const value = self[field.name];
                if (value === null || value === undefined) {
                    return;
                }
                if (field.isArray) {
                    data[field.name] = [...(value as unknown[])];
                } else {
                    data[field.name] = value;
                }
            }
        );

        const cloned = new constructor(params);
        assert(cloned instanceof BaseUAObject);
        return cloned;
    }
}

function _visitSchemaChain(
    self: BaseUAObject,
    schema: IStructuredTypeSchema,
    pojo: Record<string, unknown>,
    func: (self: BaseUAObject, schema: IStructuredTypeSchema, pojo: Record<string, unknown>) => void,
    extraData: unknown
) {
    assert(typeof func === "function");

    // apply also construct to baseType schema first
    const baseSchema = schema.getBaseSchema ? schema.getBaseSchema() : null;
    if (baseSchema) {
        _visitSchemaChain(self, baseSchema, pojo, func, extraData);
    }
    func.call(null, self, schema, pojo);
}
