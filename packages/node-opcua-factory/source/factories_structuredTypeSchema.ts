/**
 * @module node-opcua-factory
 */
import chalk from "chalk";
import * as  _ from "underscore";

import {
    CommonInterface,
    FieldCategory,
    FieldInterfaceOptions,
    FieldType,
    StructuredTypeOptions,
    TypeSchemaBase
} from "./types";

import { getBuildInType, hasBuiltInType } from "./factories_builtin_types";
import { getEnumeration, hasEnumeration } from "./factories_enumerations";
import { getStructuredTypeSchema, getStructureTypeConstructor, hasStructuredType } from "./factories_factories";
import { parameters } from "./factories_schema_helpers";

import { BinaryStream } from "node-opcua-binary-stream";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { lowerFirstLetter } from "node-opcua-utils";
import { assert } from "node-opcua-assert";

// export interface StructuredTypeSchemaInterface extends CommonInterface {
//
//     fields: FieldType[];
//
//     baseType?: string;
//     documentation?: string;
//
//     id: number | NodeId;
//
//     // caches
//     _possibleFields?: any[];
//     _baseSchema?: StructuredTypeSchemaInterface;
//     _resolved?: boolean;
//
//     isValid?: (options: any) => boolean;
//     decodeDebug?: (stream: BinaryStream, options: any) => any;
//     constructHook?: (options: any) => any;
// }
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
        assert(fieldType !==  "LocalizedText"); // LocalizedText should be treated as BasicType!!!
        return FieldCategory.complex;
    }
    return FieldCategory.basic;
}

function figureOutSchema(field: FieldInterfaceOptions, category: FieldCategory): CommonInterface {

    if (field.schema) {
        return field.schema;
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
    if (null === returnValue) {
        throw new Error("Cannot find Schema for " + field.name + category);
    }
    return returnValue;
}

function buildField(fieldLight: FieldInterfaceOptions): FieldType {

    const category = figureOutFieldCategory(fieldLight);
    const schema = figureOutSchema(fieldLight, category);

    return {
        name: lowerFirstLetter(fieldLight.name),

        category,
        defaultValue: fieldLight.defaultValue,
        isArray: fieldLight.isArray,

        documentation: fieldLight.documentation,
        fieldType: fieldLight.fieldType,
        schema
    };
}

export class StructuredTypeSchema extends TypeSchemaBase {

    public fields: FieldType[];
    public id: NodeId;
    public baseType: string;
    public _possibleFields: string[];
    public _baseSchema: StructuredTypeSchema | null;

    public documentation?: string;

    public isValid?: (options: any) => boolean;

    public decodeDebug?: (stream: BinaryStream, options: any) => any;
    public constructHook?: (options: any) => any;

    public encodingDefaultBinary?: ExpandedNodeId;
    public encodingDefaultXml?: ExpandedNodeId;

    constructor(options: StructuredTypeOptions) {
        super(options);
        this.baseType = options.baseType;
        this.category = FieldCategory.complex;
        this.fields = options.fields.map(buildField);
        this.id = NodeId.nullNodeId;
        this._possibleFields = this.fields.map((field) => field.name);
        this._baseSchema = null;
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

    if (schema.baseType === "ExtensionObject") {
        return null;
    }

    if (schema.baseType && schema.baseType !== "BaseUAObject") {
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
export function check_options_correctness_against_schema(obj: any, schema: StructuredTypeSchema, options: any) {

    if (!parameters.debugSchemaHelper) {
        return; // ignoring set
    }

    options = options || {};

    // istanbul ignore next
    if (!_.isObject(options) && !(typeof(options) === "object")) {
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
    }
    if (invalidOptionsFields.length !== 0) {
        throw new Error(" invalid field found in option :" + JSON.stringify(invalidOptionsFields));
    }
    return true;
}

export function buildStructuredType(schemaLight: StructuredTypeOptions): StructuredTypeSchema {
    return new StructuredTypeSchema(schemaLight);
}
