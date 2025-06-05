/**
 * @module node-opcua-factory
 */
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import { make_errorLog, make_warningLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { lowerFirstLetter } from "node-opcua-utils";
import { TypeSchemaBase } from "./builtin_types";
import { parameters } from "./parameters";
import { getStandardDataTypeFactory } from "./get_standard_data_type_factory";
import {
    BitField,
    CommonInterface,
    FieldCategory,
    FieldInterfaceOptions,
    FieldType,
    IStructuredTypeSchema,
    StructuredTypeOptions
} from "./types";
import { DataTypeFactory } from "./datatype_factory";

const warningLog = make_warningLog(__filename);
const errorLog = make_errorLog(__filename);


function figureOutFieldCategory(field: FieldInterfaceOptions, dataTypeFactory: DataTypeFactory): FieldCategory {
    const fieldType = field.fieldType;
    if (field.category) {
        return field.category;
    }
    if (dataTypeFactory.hasEnumeration(fieldType)) {
        return FieldCategory.enumeration;
    } else if (dataTypeFactory.hasBuiltInType(fieldType)) {
        return FieldCategory.basic;
    } else if (dataTypeFactory.hasStructureByTypeName(fieldType)) {
        assert(fieldType !== "LocalizedText"); // LocalizedText should be treated as BasicType!!!
        return FieldCategory.complex;
    }
    warningLog("Cannot figure out field category for ", field);
    return FieldCategory.basic;
}

const regExp = /((ns[0-9]+:)?)(.*)/;

function figureOutSchema(
    underConstructSchema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory,
    field: FieldInterfaceOptions,
    category: FieldCategory
): CommonInterface {
    if (field.schema) {
        return field.schema;
    }

    if (underConstructSchema.name === field.fieldType) {
        return underConstructSchema;
    }

    let returnValue: any = null;

    // may be the field.type  contains a ns<X>: prefix !! like the one found in Beckhoff PLC !
    const m = field.fieldType.match(regExp);
    /* istanbul ignore next */
    if (!m) {
        throw new Error("malformed fieldType ? : " + field.fieldType);
    }
    const fieldTypeWithoutNS = m[3];

    switch (category) {
        case FieldCategory.complex:
            if (dataTypeFactory.hasStructureByTypeName(field.fieldType)) {
                returnValue = dataTypeFactory.getStructuredTypeSchema(fieldTypeWithoutNS);
            } else {
                // LocalizedText etc ...
                returnValue = dataTypeFactory.getBuiltInType(fieldTypeWithoutNS);
            }
            break;
        case FieldCategory.basic:
            returnValue = dataTypeFactory.getBuiltInType(fieldTypeWithoutNS);
            if (!returnValue) {
                if (dataTypeFactory.hasEnumeration(fieldTypeWithoutNS)) {
                    warningLog("expecting a enumeration!");
                }
                returnValue = dataTypeFactory.getStructuredTypeSchema(fieldTypeWithoutNS);

                // istanbul ignore next
                if (returnValue) {
                    warningLog("Why can't we find a basic type here ?");
                }
            }
            break;
        case FieldCategory.enumeration:
            returnValue = dataTypeFactory.getEnumeration(fieldTypeWithoutNS);
            break;
    }
    if (null === returnValue || undefined === returnValue) {
        try {
            returnValue = dataTypeFactory.getEnumeration(fieldTypeWithoutNS);
        } catch (err) {
            warningLog("dataTypeFactory.getEnumeration has failed", err);
        }
        throw new Error(
            "Cannot find Schema for field with name " +
            field.name +
            " fieldTypeWithoutNS= " +
            fieldTypeWithoutNS +
            " with type " +
            field.fieldType +
            " category = " +
            category +
            JSON.stringify(field, null, "\t")
        );
    }
    return returnValue;
}

function buildField(
    underConstructSchema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory,
    fieldLight: FieldInterfaceOptions,
    _index: number
): FieldType {

    const category =
        (fieldLight.fieldType == underConstructSchema.name)
            ? underConstructSchema.category
            : figureOutFieldCategory(fieldLight, dataTypeFactory);

    const schema = figureOutSchema(underConstructSchema, dataTypeFactory, fieldLight, category);

    /* istanbul ignore next */
    if (!schema) {
        throw new Error(
            "expecting a valid schema for field with name " +
            fieldLight.name +
            " with type " +
            fieldLight.fieldType +
            " category" +
            category +
            " at index" +
            _index
        );
    }

    const { defaultValue, isArray, documentation, fieldType, switchBit, switchValue, allowSubType, dataType, basicDataType } =
        fieldLight;
    return {
        name: lowerFirstLetter(fieldLight.name),
        originalName: fieldLight.name,
        category,
        defaultValue,
        isArray,
        documentation,
        fieldType,
        switchBit,
        switchValue,
        allowSubType,
        dataType,
        basicDataType,
        schema
    };
}

export class StructuredTypeSchema extends TypeSchemaBase implements IStructuredTypeSchema {
    public fields: FieldType[];
    public dataTypeNodeId: NodeId;

    public baseType: string;
    private _baseSchema: IStructuredTypeSchema | null | undefined;

    public documentation?: string;

    public isValid?: (options: any) => boolean;

    public decodeDebug?: (stream: BinaryStream, options: any) => any;
    public constructHook?: (options: any) => any;

    public encodingDefaultBinary?: ExpandedNodeId;
    public encodingDefaultXml?: ExpandedNodeId;
    public encodingDefaultJson?: ExpandedNodeId;

    public bitFields?: BitField[];

    private _dataTypeFactory: DataTypeFactory;

    constructor(options: StructuredTypeOptions) {
        super(options);

        this.bitFields = options.bitFields;

        this.baseType = options.baseType;
        this.category = options.category ||  FieldCategory.complex;

        this._dataTypeFactory = options.dataTypeFactory;
        if (this._dataTypeFactory.hasBuiltInType(options.name)) {
            this.category = FieldCategory.basic;
        }
        this.dataTypeNodeId = new NodeId();
        this._baseSchema = undefined;
        this.fields = options.fields.map(buildField.bind(null, this, this._dataTypeFactory));
    }

    getDataTypeFactory(): DataTypeFactory {
        return this._dataTypeFactory || getStandardDataTypeFactory();
    }

    getBaseSchema(): IStructuredTypeSchema | null {
        if (this._baseSchema !== undefined && this._baseSchema === null && this.baseType === "ExtensionObject") {
            return this._baseSchema;
        }
        const _schemaBase = _get_base_schema(this);
        this._baseSchema = _schemaBase;
        return _schemaBase || null;
    }

    public getPossibleFieldsLocal() {
        return this.fields.map((field) => field.name);
    }

    public toString(): string {
        const str: string[] = [];
        str.push("name           = " + this.name);
        str.push("baseType       = " + this.baseType);
        str.push("bitFields      = " + (this.bitFields ? this.bitFields.map((b) => b.name).join(" ") : undefined));
        str.push("dataTypeNodeId = " + (this.dataTypeNodeId ? this.dataTypeNodeId.toString() : undefined));
        str.push("documentation  = " + this.documentation);
        str.push("encodingDefaultBinary  = " + this.encodingDefaultBinary?.toString());
        str.push("encodingDefaultXml     = " + this.encodingDefaultXml?.toString());
        str.push("encodingDefaultJson    = " + this.encodingDefaultJson?.toString());
        for (const f of this.fields) {
            str.push(
                "  field   =  " +
                f.name.padEnd(30) +
                " isArray= " +
                (f.isArray ? true : false) +
                " " +
                f.fieldType.toString().padEnd(30) +
                (f.switchBit !== undefined ? " switchBit " + f.switchBit : "") +
                (f.switchValue !== undefined ? " switchValue    " + f.switchValue : "")
            );
        }
        return str.join("\n");
    }
}

function _get_base_schema(schema: IStructuredTypeSchema): IStructuredTypeSchema | null | undefined {
    const dataTypeFactory = schema.getDataTypeFactory();

    if (schema.baseType === "ExtensionObject" || schema.baseType === "DataTypeDefinition") {
        return null;
    }
    if (schema.baseType === "Union") {
        return null;
    }

    if (
        schema.baseType &&
        schema.baseType !== "BaseUAObject" &&
        schema.baseType !== "Structure" &&
        schema.baseType !== "DataTypeDefinition"
    ) {
        if (!dataTypeFactory.hasStructureByTypeName(schema.baseType)) {
            //    warningLog(`Cannot find schema for ${schema.baseType} in dataTypeFactory for ${schema.name} and schema is not abstract ! fix me !`);
            return undefined;
        }
        const structureInfo = dataTypeFactory.getStructureInfoByTypeName(schema.baseType);

        // istanbul ignore next
        if (!structureInfo) {
            throw new Error(" cannot find factory for " + schema.baseType);
        }
        if (structureInfo.schema) {
            return structureInfo.schema;
        }
    }
    // put in  cache for speedup
    return null;
}

/**
 * extract a list of all possible fields for a schema
 * (by walking up the inheritance chain)
 *
 */
export function extractAllPossibleFields(schema: IStructuredTypeSchema): string[] {
    // returns cached result if any
    // istanbul ignore next
    // extract the possible fields from the schema.
    let possibleFields = schema.fields.map((field) => field.name);

    const baseSchema = schema.getBaseSchema();
    // istanbul ignore next
    if (baseSchema) {
        const fields = extractAllPossibleFields(baseSchema);
        possibleFields = fields.concat(possibleFields);
    }
    return possibleFields;
}

/**
 * check correctness of option fields against scheme
 *

 *
 */
export function check_options_correctness_against_schema(obj: any, schema: IStructuredTypeSchema, options: any): boolean {
    if (!parameters.debugSchemaHelper) {
        return true; // ignoring set
    }

    options = options || {};

    // istanbul ignore next
    if (!(options !== null && typeof options === "object") && !(typeof options === "object")) {
        let message = chalk.red(" Invalid options specified while trying to construct a ") + " " + chalk.yellow(schema.name);
        message += "\n";
        message += chalk.red(" expecting a ") + chalk.yellow(" Object ");
        message += "\n";
        message += chalk.red(" and got a ") + chalk.yellow(typeof options) + chalk.red(" instead ");
        throw new Error(message);
    }

    // istanbul ignore next
    if (options instanceof obj.constructor) {
        return true;
    }

    // extract the possible fields from the schema.
    const possibleFields: string[] = obj.constructor.possibleFields || extractAllPossibleFields(schema);

    // extracts the fields exposed by the option object
    const currentFields = Object.keys(options);

    // get a list of field that are in the 'options' object but not in schema
    // https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore
    function difference<T>(a1: T[], a2: T[]) {
        return [a1, a2].reduce((a, b) => a.filter((value) => !b.includes(value)));
    }
    const invalidOptionsFields = difference(currentFields, possibleFields);

    /* istanbul ignore next */
    if (invalidOptionsFields.length > 0) {
        errorLog("expected schema", schema.name);
        errorLog(chalk.yellow("possible fields= "), possibleFields.sort().join(" "));
        errorLog(chalk.red("current fields= "), currentFields.sort().join(" "));
        errorLog(chalk.cyan("invalid_options_fields= "), invalidOptionsFields.sort().join(" "));
        errorLog("options = ", options);
    }
    /* istanbul ignore next */
    if (invalidOptionsFields.length !== 0) {
        errorLog(chalk.yellow("possible fields= "), possibleFields.sort().join(" "));
        errorLog(chalk.red("current fields= "), currentFields.sort().join(" "));
        throw new Error(" invalid field found in option :" + JSON.stringify(invalidOptionsFields));
    }
    return true;
}

export function buildStructuredType(schemaLight: Omit<StructuredTypeOptions, "dataTypeFactory">): IStructuredTypeSchema {
    return new StructuredTypeSchema({
        ...schemaLight,
        dataTypeFactory: getStandardDataTypeFactory()
    });
}
