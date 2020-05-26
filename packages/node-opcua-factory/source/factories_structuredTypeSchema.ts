/**
 * @module node-opcua-factory
 */
import * as chalk from "chalk";
import * as  _ from "underscore";

import {
    CommonInterface,
    FieldCategory,
    FieldInterfaceOptions,
    FieldType,
    StructuredTypeOptions,
    TypeSchemaBase
} from "./types";

import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { lowerFirstLetter } from "node-opcua-utils";

import { getBuildInType, hasBuiltInType } from "./factories_builtin_types";
import { getEnumeration, hasEnumeration } from "./factories_enumerations";
import { getStructuredTypeSchema, getStructureTypeConstructor, hasStructuredType } from "./factories_factories";
import { parameters } from "./factories_schema_helpers";

function figureOutFieldCategory(field: FieldInterfaceOptions): FieldCategory {
    const fieldType = field.fieldType;

    if (field.category) {
        return field.category;
    }

    if (hasEnumeration(fieldType)) {
        return FieldCategory.enumeration;
    } else if (hasBuiltInType(fieldType)) {
        return FieldCategory.basic;
    } else if (hasStructuredType(fieldType)) {
        assert(fieldType !== "LocalizedText"); // LocalizedText should be treated as BasicType!!!
        return FieldCategory.complex;
    }
    return FieldCategory.basic;
}

function figureOutSchema(underConstructSchema: StructuredTypeSchema, field: FieldInterfaceOptions, category: FieldCategory): CommonInterface {

    if (field.schema) {
        return field.schema;
    }

    if (underConstructSchema.name === field.fieldType) {
        return underConstructSchema;
    }

    let returnValue: any = null;

    switch (category) {
        case FieldCategory.complex:
            if (hasStructuredType(field.fieldType)) {
                returnValue = getStructuredTypeSchema(field.fieldType);
            } else {
                // LocalizedText etc ...
                returnValue = getBuildInType(field.fieldType);
            }
            break;
        case FieldCategory.basic:
            returnValue = getBuildInType(field.fieldType);
            break;
        case FieldCategory.enumeration:
            returnValue = getEnumeration(field.fieldType);
            break;
    }
    if (null === returnValue || undefined === returnValue) {
        throw new Error("Cannot find Schema for field with name " + field.name +
            " with type " + field.fieldType + " category = " + category + JSON.stringify(field, null, "\t"));
    }
    return returnValue;
}

function buildField(underConstructSchema: StructuredTypeSchema, fieldLight: FieldInterfaceOptions): FieldType {

    const category = figureOutFieldCategory(fieldLight);
    const schema = figureOutSchema(underConstructSchema, fieldLight, category);

    /* istanbul ignore next */
    if (!schema) {
        throw new Error("expecting a valid schema for field with name " +
            fieldLight.name + " with type " + fieldLight.fieldType + " category" + category);
    }

    return {
        name: lowerFirstLetter(fieldLight.name),

        category,
        defaultValue: fieldLight.defaultValue,
        isArray: fieldLight.isArray,

        documentation: fieldLight.documentation,
        fieldType: fieldLight.fieldType,

        switchBit: fieldLight.switchBit,

        switchValue: fieldLight.switchValue,

        schema
    };
}

export class StructuredTypeSchema extends TypeSchemaBase {

    public fields: FieldType[];
    public id: NodeId;
    public dataTypeNodeId: NodeId;

    public baseType: string;
    public _possibleFields: string[];
    public _baseSchema: StructuredTypeSchema | null;

    public documentation?: string;

    public isValid?: (options: any) => boolean;

    public decodeDebug?: (stream: BinaryStream, options: any) => any;
    public constructHook?: (options: any) => any;

    public encodingDefaultBinary?: ExpandedNodeId;
    public encodingDefaultXml?: ExpandedNodeId;
    public encodingDefaultJson?: ExpandedNodeId;

    public bitFields?: any[];

    constructor(options: StructuredTypeOptions) {
        super(options);

        this.bitFields = options.bitFields;

        this.baseType = options.baseType;
        this.category = FieldCategory.complex;

        if (hasBuiltInType(options.name)) {
            this.category = FieldCategory.basic;
        }
        this.fields = options.fields.map(buildField.bind(null, this));
        this.id = NodeId.nullNodeId;
        this.dataTypeNodeId = NodeId.nullNodeId;

        this._possibleFields = this.fields.map((field) => field.name);
        this._baseSchema = null;
    }
    public toString() {

        const str: string[] = [];
        str.push("name           = " + this.name);
        str.push("baseType       = " + this.baseType);
        str.push("id             = " + this.id.toString());
        str.push("bitFields      = " + (this.bitFields ? this.bitFields.map((b) => b.name).join(" ") : undefined));
        str.push("dataTypeNodeId = " + (this.dataTypeNodeId ? this.dataTypeNodeId.toString() : undefined));
        str.push("documentation  = " + this.documentation);
        str.push("encodingDefaultBinary  = " + this.encodingDefaultBinary?.toString());
        str.push("encodingDefaultXml     = " + this.encodingDefaultXml?.toString());
        str.push("encodingDefaultJson    = " + this.encodingDefaultJson?.toString());
        for (const f of this.fields) {
            str.push("  field   =  " + f.name.padEnd(30) + " isArray= " + (f.isArray ? true : false) + " " + f.fieldType.toString().padEnd(30) +
                (f.switchBit !== undefined ? (" switchBit " + f.switchBit) : "") +
                (f.switchValue !== undefined ? " switchValue    " + f.switchValue : ""));
        }
        return str.join("\n");

    }
}

/**
 *
 * @method get_base_schema
 * @param schema
 * @return {*}
 *
 */
export function get_base_schema(schema: StructuredTypeSchema) {

    let baseSchema = schema._baseSchema;
    if (baseSchema) {
        return baseSchema;
    }

    if (schema.baseType === "ExtensionObject" || schema.baseType === "DataTypeDefinition") {
        return null;
    }
    if (schema.baseType === "Union") {
        return null;
    }

    if (schema.baseType && schema.baseType !== "BaseUAObject" && schema.baseType !== "DataTypeDefinition") {
        const baseType = getStructureTypeConstructor(schema.baseType);

        // istanbul ignore next
        if (!baseType) {
            throw new Error(" cannot find factory for " + schema.baseType);
        }
        if (baseType.prototype.schema) {
            baseSchema = baseType.prototype.schema;
        }
    }
    // put in  cache for speedup
    schema._baseSchema = baseSchema;
    return baseSchema;
}

/**
 * extract a list of all possible fields for a schema
 * (by walking up the inheritance chain)
 * @method extract_all_fields
 *
 */
export function extract_all_fields(schema: StructuredTypeSchema) {

    // returns cached result if any
    // istanbul ignore next
    if (schema._possibleFields) {
        return schema._possibleFields;
    }
    // extract the possible fields from the schema.
    let possibleFields = schema.fields.map((field) => field.name);

    const baseSchema = get_base_schema(schema);

    // istanbul ignore next
    if (baseSchema) {
        const fields = extract_all_fields(baseSchema);
        possibleFields = fields.concat(possibleFields);
    }

    // put in cache to speed up
    schema._possibleFields = possibleFields;
    return possibleFields;
}

/**
 * check correctness of option fields against scheme
 *
 * @method  check_options_correctness_against_schema
 *
 */
export function check_options_correctness_against_schema(obj: any, schema: StructuredTypeSchema, options: any): boolean {

    if (!parameters.debugSchemaHelper) {
        return true; // ignoring set
    }

    options = options || {};

    // istanbul ignore next
    if (!_.isObject(options) && !(typeof (options) === "object")) {
        let message = chalk.red(" Invalid options specified while trying to construct a ")
            + " " + chalk.yellow(schema.name);
        message += "\n";
        message += chalk.red(" expecting a ") + chalk.yellow(" Object ");
        message += "\n";
        message += chalk.red(" and got a ") + chalk.yellow((typeof options)) + chalk.red(" instead ");
        // console.log(" Schema  = ", schema);
        // console.log(" options = ", options);
        throw new Error(message);
    }

    // istanbul ignore next
    if (options instanceof obj.constructor) {
        return true;
    }

    // extract the possible fields from the schema.
    const possibleFields = obj.constructor.possibleFields || schema._possibleFields;

    // extracts the fields exposed by the option object
    const currentFields = Object.keys(options);

    // get a list of field that are in the 'options' object but not in schema
    const invalidOptionsFields = _.difference(currentFields, possibleFields);

    /* istanbul ignore next */
    if (invalidOptionsFields.length > 0) {
        // tslint:disable:no-console
        console.log("expected schema", schema.name);
        console.log(chalk.yellow("possible fields= "), possibleFields.sort().join(" "));
        console.log(chalk.red("current fields= "), currentFields.sort().join(" "));
        console.log(chalk.cyan("invalid_options_fields= "), invalidOptionsFields.sort().join(" "));
        console.log("options = ", options);
    }
    /* istanbul ignore next */
    if (invalidOptionsFields.length !== 0) {
        // tslint:disable:no-console
        console.log(chalk.yellow("possible fields= "), possibleFields.sort().join(" "));
        console.log(chalk.red("current fields= "), currentFields.sort().join(" "));
        throw new Error(" invalid field found in option :" + JSON.stringify(invalidOptionsFields));
    }
    return true;
}

export function buildStructuredType(schemaLight: StructuredTypeOptions): StructuredTypeSchema {
    return new StructuredTypeSchema(schemaLight);
}
