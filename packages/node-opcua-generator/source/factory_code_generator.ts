/* istanbul ignore file */
/**
 * @module node-opcua-generator
 */

// tslint:disable:max-line-length
// tslint:disable:max-depth

import * as os from "os";
import * as path from "path";
import * as fs from "fs";

import { assert } from "node-opcua-assert";
import {
    check_schema_correctness,
    extract_all_fields,
    FieldCategory,
    FieldType,
    getStructuredTypeSchema,
    IStructuredTypeSchema
} from "node-opcua-factory";

import { DataTypeIds, ObjectIds } from "node-opcua-constants";
import { make_debugLog } from "node-opcua-debug";
import { coerceNodeId, NodeId } from "node-opcua-nodeid";
import { capitalizeFirstLetter } from "node-opcua-utils";

import { makeWrite, WriteFunc } from "./utils/write_func";
import { LineFile1, normalize_require_file } from "./utils/index";

const produceComment = false;
const debugLog = make_debugLog(__filename);

const generatedObjectSchema: any = {};

function quotify(str: string): string {
    return '"' + str + '"';
}

function makeFieldType(field: FieldType) {
    return "{" + field.fieldType + (field.isArray ? "[" : "") + (field.isArray ? "]" : "") + "}";
}

function convertToJavascriptCode(obj: any): string {
    const lines: string[] = [];

    if (typeof obj === "object" && !(obj instanceof Array)) {
        lines.push("{");
        for (const prop of Object.keys(obj)) {
            lines.push(prop, ": ", convertToJavascriptCode(obj[prop]), ",");
        }
        lines.push("}");
    } else if (obj instanceof Array) {
        lines.push("[");
        for (const prop of obj) {
            lines.push(convertToJavascriptCode(prop), ",");
        }
        lines.push("]");

        // tslint:disable:no-empty
    } else if (typeof obj === "function") {
        /** */
    } else {
        lines.push(JSON.stringify(obj));
    }
    return lines.join("");
}

function get_class_folder(schemaName: string, optionalFolder?: string): string {
    let folder;
    if (optionalFolder) {
        if (!fs.existsSync(optionalFolder)) {
            fs.mkdirSync(optionalFolder);
            if (!fs.existsSync(optionalFolder)) {
                throw new Error("get_class_TScript_filename: Cannot find folder " + optionalFolder);
            }
        }
        folder = optionalFolder;
    } else {
        folder = exports.folder_for_generated_file;
        throw new Error("get_class_javascript_filename : DEPRECATED ");
    }
    return folder;
}

export function get_class_TScript_filename(schemaName: string, optionalFolder?: string): string {
    const folder = get_class_folder(schemaName, optionalFolder);
    return path.join(folder, "_" + schemaName + ".ts");
}

export function get_class_JScript_filename(schemaName: string, optionalFolder?: string): string {
    const folder = get_class_folder(schemaName, optionalFolder);
    return path.join(folder, "_" + schemaName + ".js");
}

function get_class_TScript_filename_local(schemaName: string): string {
    let schema = getStructuredTypeSchema(schemaName);
    if (!schema) {
        schema = generatedObjectSchema[schemaName];
        if (!schema) {
            throw new Error("cannot find script file for " + schemaName);
        }
        return "./_" + schemaName;
    }
    let generateTypeScriptSource = "/* fix me schema.prototype.schema.generate_ts_source*/";
    if (!generateTypeScriptSource) {
        const folder = "."; // exports.folder_for_generated_file;
        generateTypeScriptSource = path.join(folder, "_" + schemaName + ".ts");
    }
    return generateTypeScriptSource;
}

function write_enumeration_setter(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, member: string): void {
    const capMember = capitalizeFirstLetter(member);
    write(`    public set${capMember}(value: any): ${field.fieldType} {`);
    write(`        const coercedValue = _enumeration${field.fieldType}.get(value);`);
    write(`        /* istanbul ignore next */`);
    write(`        if (coercedValue === undefined || coercedValue === null) {`);
    write(`           throw new Error("value cannot be coerced to ${field.fieldType} :" + value);`);
    write(`        }`);
    write(`        this.${member} = coercedValue.value as ${field.fieldType};`);
    write(`        return this.${member};`);
    write(`    }`);
}

function write_enumeration_fast_init(
    write: WriteFunc,
    schema: IStructuredTypeSchema,
    field: FieldType,
    member: string,
    i: number
): void {
    write(`             this.${member} =  0 as  ${field.fieldType};`);
}

function write_enumeration(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, member: string, i: number): void {
    assert(!field.isArray); // would not work in this case
    const capMember = capitalizeFirstLetter(member);
    write(`        this.${field.name} = this.set${capMember}(initialize_field(schema.fields[${i}], options?.${field.name}));`);
}

function write_complex_fast_init(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, member: string) {
    if (field.isArray) {
        write(`         this.${member} =  null; /* null array */`);
    } else {
        write(`         this.${member} =  new ${field.fieldType}(null);`);
    }
}

function write_complex(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, member: string /*, i*/) {
    if (field.isArray) {
        if (Object.prototype.hasOwnProperty.call(field, "defaultValue")) {
            // todo: fix me => should call field defaultValue in the live version
            write(`        this.${member} = []; // should default`);
        } else {
            write(`        this.${member} = [];`);
        }
        write(`        if (options.${member}) {`);
        write(`            assert(Array.isArray(options.${member}));`);
        write(`            this.${member} = options.${member}.map((e: any) => new ${field.fieldType}(e));`);
        // write(`        self.${member} = options.${member}.map(function(e){ return construct${field.fieldType}(e); } );`);
        write("        }");
    } else {
        if (field.defaultValue === null || field.fieldType === schema.name) {
            write(`        this.${member} = (options.${member}) ? new ${field.fieldType}( options.${member}) : null;`);
            // xx write(`    self.${member} = (options.${member}) ? construct${field.fieldType}( options.${member}) : null;`);
        } else {
            write(`        this.${member}  =  new ${field.fieldType}(options.${member});`);
            // xx write(`    self.${member}  =  construct${field.fieldType}(options.${member});`);
        }
    }
}

function write_basic(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, member: string, i: number): void {
    assert(field.category === FieldCategory.basic);

    if (field.isArray) {
        // write(`this.${member} = [];`);
        // write(`if (options.${member}) {`);
        // write(`    assert(Array.isArray(options.${member}));`);
        // write(`    this.${member} = options.browsePath.map(e => field.coerce(e) );`);
        // write(`}`);
        write(`        this.${member} = initialize_field_array(schema.fields[${i}], options?.${field.name});`);
    } else {
        write(`        this.${member} = initialize_field(schema.fields[${i}], options?.${field.name});`);
    }
}
function write_basic_fast_init(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, member: string, i: number): void {
    if (field.isArray) {
        // write(`this.${member} = [];`);
        // write(`if (options.${member}) {`);
        // write(`    assert(Array.isArray(options.${member}));`);
        // write(`    this.${member} = options.browsePath.map(e => field.coerce(e) );`);
        // write(`}`);
        write(`            this.${member} = []`);
    } else {
        switch (field.schema.name) {
            case "Variant":
                write(`            this.${member} = new Variant(null);`);
                break;
            case "UABoolean":
            case "Boolean":
                write(`            this.${member} = false;`);
                break;
            case "String":
            case "UAString":
                write(`            this.${member} = null;`);
                break;
            case "ExpandedNodeId":
                write(`            this.${member} = new ExpandedNodeId(null);`);
                break;
            case "NodeId":
                write(`            this.${member} = new NodeId(null);`);
                break;
            case "QualifiedName":
                write(`            this.${member} = new QualifiedName(null);`);
                break;
            case "DateTime":
                write(`            this.${member} = new Date();`);
                break;
            case "ByteString":
                write(`            this.${member} = Buffer.alloc(0);`);
                break;
            case "StatusCode":
                write(`            this.${member} = StatusCodes.Good;`);
                break;
            case "DiagnosticInfo":
            case "ExtensionObject":
                write(`            this.${member} = null;`);
                break;
            case "NumericRange":
                write(`            this.${member} = new NumericRange(null);`);
                break;
            case "LocalizedText":
                write(`            this.${member} = new LocalizedText(null);`);
                break;
            case "Guid":
                write(`            this.${member} = "";`);
                break;
            case "UInt64":
                write(`            this.${member} = [];`);
                break;
            case "Int64":
                write(`            this.${member} = [];`);
                break;
            case "DataValue":
                write(`            this.${member} = new DataValue(null);`);
                break;

            default:
                write(`            this.${member} = 0;`);
        }
    }
}
function write_fast_init_member(write: WriteFunc, schema: IStructuredTypeSchema, field: FieldType, i: number) {
    const member = field.name;
    switch (field.category) {
        case FieldCategory.enumeration:
            write_enumeration_fast_init(write, schema, field, member, i);
            break;
        case FieldCategory.basic:
            write_basic_fast_init(write, schema, field, member, i);
            break;
        case FieldCategory.complex:
            write_complex_fast_init(write, schema, field, member);
            break;
    }
}

function write_constructor(write: WriteFunc, schema: IStructuredTypeSchema): void {
    const baseClass = schema.baseType;
    const className = schema.name;
    write("");
    const n = schema.fields.length;

    if (produceComment) {
        write("    /**");
        if (schema.documentation && schema.documentation.length > 0) {
            write("     * " + schema.documentation);
        }
        let def = "";
        for (let i = 0; i < n; i++) {
            const field = schema.fields[i];
            const fieldType = field.fieldType;
            const documentation = field.documentation ? field.documentation : "";
            def = "";
            if (field.defaultValue !== undefined) {
                if (typeof field.defaultValue === "function") {
                    def = " = " + field.defaultValue();
                } else {
                    def = " = " + field.defaultValue;
                }
            }
            const ft = makeFieldType(field);
            // xx write(" * @param  [options." + field.name + def + "] " + ft + " " + documentation);
        }

        write("     */");
    }

    write(`    constructor(options?: ${className}Options | null) {`);
    write("");
    if (baseClass) {
        if (baseClass === "BaseUAObject") {
            write("        super();");
        } else {
            write("        super(options);");
        }
        write("");
    }

    // detect de-serialization constructor
    // -----------------------------------------------------------------------------------------------------------------
    // Special case when options === null => fast constructor for de-serialization
    // -----------------------------------------------------------------------------------------------------------------
    write(`        if (options === null) {`);
    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        write_fast_init_member(write, schema, field, i);
    }
    write("              return;");
    write("        }");

    write(`        const schema = ${className}.schema;`);
    if (typeof schema.constructHook === "function") {
        write(`        options = schema.constructHook(options) as ${className}Options;`);
    } else {
        write(`        options = (schema.constructHook ? schema.constructHook(options) as ${className}Options: options ) || {};`);
    }
    //    write("        if (options === undefined) { options = {}; }");

    write("        /* istanbul ignore next */");
    write("        if (parameters.debugSchemaHelper) {");
    write("            check_options_correctness_against_schema(this, schema, options);");
    write("        }");

    // -----------------------------------------------------------------------------------------------------------------

    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const member = field.name;

        if (produceComment) {
            write("");
            write("    /**");
            const documentation = field.documentation ? field.documentation : "";
            if (documentation && documentation.length > 0) {
                write("     * ", documentation);
            }

            if (produceComment) {
                write("     * @property ", field.name);
                // write("      * @type {", (field.isArray ? "Array[" : "") + field.fieldType + (field.isArray ? " ]" : "")+"}");
                write("     * @type " + makeFieldType(field));
            }
            if (field.defaultValue !== undefined && typeof field.defaultValue !== "function") {
                write("     * @default  ", field.defaultValue);
            }

            write("     */");
        }

        switch (field.category) {
            case FieldCategory.enumeration:
                write_enumeration(write, schema, field, member, i);
                break;
            case FieldCategory.complex:
                write_complex(write, schema, field, member);
                break;
            default:
                write_basic(write, schema, field, member, i);
                break;
        }
    }
    write("    }");
}

function write_possible_fields(write: WriteFunc, className: string, possibleFields: string[]): void {
    write("    public static possibleFields: string[] = [");
    write("          " + possibleFields.map(quotify).join("," + os.EOL + "           "));
    write("    ];");
}

function write_isValid(write: WriteFunc, schema: IStructuredTypeSchema): void {
    // ---------------------------------------
    if (typeof schema.isValid === "function") {
        if (produceComment) {
            write("   /**");
            write("    *");
            write("    * verify that all object attributes values are valid according to schema");
            write("    * @method isValid");
            write("    * @return {Boolean}");
            write("    */");
        }
        write("    isValid(): boolean { return schema.isValid(this); };");
    }
}

function write_encode(write: WriteFunc, schema: IStructuredTypeSchema): void {
    if (typeof schema.encode === "function") {
        write("    public encode(stream: OutputBinaryStream): void {");
        write("        " + "schema" + ".encode(this, stream);");
        write("    }");
    } else {
        if (produceComment) {
            write("    /**");
            write("     * encode the object into a binary stream");
            write("     * @method encode");
            write("     *");
            write("     * @param stream {BinaryStream}");
            write("     */");
        }
        write("     public encode(stream: OutputBinaryStream): void {");
        write("        /* NEEDED */ super.encode(stream);");

        const n = schema.fields.length;
        for (let i = 0; i < n; i++) {
            const field = schema.fields[i];
            const member = field.name;

            switch (field.category) {
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    if (field.isArray) {
                        write(`        encodeArray(this.${member}, stream, encode${field.fieldType});`);
                    } else {
                        write(`        encode${field.fieldType}(this.${member}, stream);`);
                    }
                    break;
                case FieldCategory.complex:
                    if (field.isArray) {
                        write(`        encodeArray(this.${member}, stream, (obj, stream1) => { obj.encode(stream1); });`);
                    } else {
                        write(`        this.${member}.encode(stream);`);
                    }
                    break;
            }
        }
        write("    }");
    }
}

function write_decode(write: WriteFunc, schema: IStructuredTypeSchema): void {
    //  --------------------------------------------------------------
    //   implement decode
    function write_field(field: FieldType, member: string, i: number) {
        if (field.category === FieldCategory.enumeration || field.category === FieldCategory.basic) {
            if (field.isArray) {
                write("        this." + member + " = decodeArray(stream, decode" + field.fieldType + ");");
            } else {
                if (false) {
                    write("        this." + member + ".decode(stream);");
                } else {
                    if (typeof field.decode === "function") {
                        write("        this." + member + " = " + "schema" + ".fields[" + i + "].decode(stream);");
                    } else {
                        write("        this." + member + " = decode" + field.fieldType + "(stream, this." + member + ");");
                    }
                }
            }
        } else {
            assert(field.category === FieldCategory.complex);
            if (field.isArray) {
                write("        this." + member + " = decodeArray(stream, (stream1: BinaryStream) => {");
                write("            const obj = new " + field.fieldType + "(null);");
                write("            obj.decode(stream1);");
                write("            return obj;");
                write("        });");
            } else {
                write("        this." + member + ".decode(stream);");
                // xx write("    this." + member + ".decode(stream);");
            }
        }
    }

    //  ---------------------------------------------------------------
    if (typeof schema.decode === "function") {
        if (produceComment) {
            write("    /**");
            write("     * decode the object from a binary stream");
            write("     * @method decode");
            write("     *");
            write("     * @param stream {BinaryStream}");
            write("     */");
        }
        write("    public decode(stream: BinaryStream): void {");
        write("        " + "schema" + ".decode(this,stream);");
        write("    }");

        if (typeof schema.decodeDebug !== "function") {
            throw new Error("schema decode requires also to provide a decodeDebug " + schema.name);
        }
        write("    public decodeDebug(stream: BinaryStream, options: any): void {");
        write("        " + "schema" + ".decodeDebug(this,stream,options);");
        write("    }");
    } else {
        if (produceComment) {
            write("    /**");
            write("     * decode the object from a binary stream");
            write("     * @method decode");
            write("     *");
            write("     * @param stream {BinaryStream}");
            write("     */");
        }
        write("    public decode(stream: BinaryStream): void {");
        write("        // call base class implementation first");
        write("        /* NEEDED !!! */ super.decode(stream);");

        const n = schema.fields.length;
        for (let i = 0; i < n; i++) {
            const field = schema.fields[i];
            const fieldType = field.fieldType;
            const member = field.name;
            write_field(field, member, i);
        }
        write("    }");
    }
}

function hasEnumeration(schema: IStructuredTypeSchema): boolean {
    for (const field of schema.fields) {
        if (field.category === FieldCategory.enumeration) {
            return true;
        }
    }
    return false;
}

function hasComplex(schema: IStructuredTypeSchema): boolean {
    for (const field of schema.fields) {
        if (field.category === FieldCategory.complex) {
            return true;
        }
    }
    return false;
}

function write_class_constructor_options(write: WriteFunc, schema: IStructuredTypeSchema): void {
    const n = schema.fields.length;
    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const member = field.name;

        const arrayOpt = field.isArray ? "[] | null" : "";

        switch (field.category) {
            case FieldCategory.enumeration: {
                write(`    ${member}?: ${toJavascriptType(field.fieldType)}${arrayOpt};`);
                break;
            }
            case FieldCategory.basic: {
                if (field.fieldType === "ExtensionObject") {
                    write(`    ${member}?: (${toJavascriptType(field.fieldType)} | null)${arrayOpt};`);
                } else if (field.fieldType === "DiagnosticInfo") {
                    write(`    ${member}?: (${toJavascriptType(field.fieldType)} | null)${arrayOpt};`);
                } else if (
                    field.fieldType === "Variant" ||
                    field.fieldType === "DataValue" ||
                    field.fieldType === "NodeId" ||
                    field.fieldType === "QualifiedName" ||
                    field.fieldType === "LocalizedText"
                ) {
                    write(`    ${member}?: (${toJavascriptType(field.fieldType)}Like | null)${arrayOpt};`);
                } else {
                    write(`    ${member}?: ${toJavascriptType(field.fieldType)} ${arrayOpt};`);
                }
                break;
            }
            case FieldCategory.complex: {
                write(`    ${member}?: ${field.fieldType}Options ${arrayOpt};`);
                break;
            }
        }
    }
}
function toJavascriptType(fieldType: string) {
    switch (fieldType) {
        case "String":
            return "UAString";
        case "Boolean":
            return "UABoolean";
        default:
            return fieldType;
    }
}
function write_declare_class_member(write: WriteFunc, schema: IStructuredTypeSchema): void {
    const n = schema.fields.length;
    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const member = field.name;

        const arrayOpt = field.isArray ? "[] | null" : "";

        switch (field.category) {
            case FieldCategory.enumeration: {
                write(`    public ${member}: ${toJavascriptType(field.fieldType)}${arrayOpt};`);
                break;
            }
            case FieldCategory.basic: {
                if (field.fieldType === "DiagnosticInfo") {
                    write(`    public ${member}: (${toJavascriptType(field.fieldType)} | null)${arrayOpt};`);
                } else if (field.fieldType === "ExtensionObject") {
                    write(`    public ${member}: (${toJavascriptType(field.fieldType)} | null)${arrayOpt};`);
                } else {
                    write(`    public ${member}: ${toJavascriptType(field.fieldType)}${arrayOpt};`);
                }
                break;
            }
            case FieldCategory.complex: {
                write(`    public ${member}: ${toJavascriptType(field.fieldType)}${arrayOpt};`);
                break;
            }
        }
    }
}

function write_enumerations(write: WriteFunc, schema: IStructuredTypeSchema): void {
    if (!hasEnumeration(schema)) {
        return;
    }

    write("");
    write("    // Define Enumeration setters");

    const n = schema.fields.length;

    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const member = field.name;
        if (field.category === FieldCategory.enumeration) {
            write_enumeration_setter(write, schema, field, member);
        }
    }
}

function write_expose_encoder_decoder(write: WriteFunc, schema: IStructuredTypeSchema): void {
    write("");
    write('import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";');
    write('import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";');

    const n = schema.fields.length;
    const done: any = {};
    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const fieldType = field.fieldType;
        if (!(fieldType in done)) {
            done[fieldType] = field;
            switch (field.category) {
                case FieldCategory.basic:
                    break;
                case FieldCategory.enumeration:
                    write("const _enumeration" + field.fieldType + " = " + 'getEnumeration("' + field.fieldType + '");');
                    write(
                        "const encode" +
                            field.fieldType +
                            ': (value: any, stream: OutputBinaryStream) => void = getEnumeration("' +
                            field.fieldType +
                            '").encode;'
                    );
                    write(
                        "const decode" +
                            field.fieldType +
                            ': (stream: BinaryStream) => void = getEnumeration("' +
                            field.fieldType +
                            '").decode;'
                    );
                    break;
                case FieldCategory.complex:
                    write(
                        "const encode" +
                            field.fieldType +
                            ': (value: any, stream: OutputBinaryStream) => void = getBuiltInType("' +
                            field.fieldType +
                            '").encode;'
                    );
                    write(
                        "const decode" +
                            field.fieldType +
                            ': (stream: BinaryStream) => void  = getBuiltInType("' +
                            field.fieldType +
                            '").decode;'
                    );
                    break;
            }
        }
    }
}

export function writeStructuredType(write: WriteFunc, schema: IStructuredTypeSchema): void {
    const className = schema.name;
    const baseClass = schema.baseType;

    const dataTypeNodeId = getDataTypeNodeId(schema);
    const encodingBinaryNodeId = getEncodingBinaryId(schema);
    const encodingXmlNodeId = getEncodingXmlId(schema);
    const encodingJsonNodeId = getEncodingJsonId(schema);

    const needRegistration = encodingBinaryNodeId.value !== 0;

    // ----------------------------------------------- Options
    if (baseClass === "BaseUAObject" || baseClass === "ExtensionObject" || baseClass === "DataTypeDefinition") {
        write(`export interface ${className}Options {`);
    } else {
        write(`export interface ${className}Options extends ${baseClass}Options {`);
    }
    {
        write_class_constructor_options(write, schema);
    }
    write(`}`);

    write(`export class ${className} extends ${baseClass} {`);
    {
        write(`    public static get schema(): StructuredTypeSchema { return schema${className}; }`);
        const possibleFields = extract_all_fields(schema);
        write_possible_fields(write, className, possibleFields);
        // -------------------------------------------------------------------------
        // - encodingDefaultBinary
        // -------------------------------------------------------------------------
        write(`    public static dataTypeNodeId = makeExpandedNodeId(${dataTypeNodeId.value}, ${dataTypeNodeId.namespace});`);
        if (encodingBinaryNodeId) {
            write(
                `    public static encodingDefaultBinary = makeExpandedNodeId(${encodingBinaryNodeId.value}, ${encodingBinaryNodeId.namespace});`
            );
        }

        if (encodingXmlNodeId) {
            write(
                `    public static encodingDefaultXml = makeExpandedNodeId(${encodingXmlNodeId.value}, ${encodingXmlNodeId.namespace});`
            );
        } else {
            write("    public static encodingDefaultXml = null;");
        }
        if (encodingJsonNodeId) {
            write(
                `    public static encodingDefaultJson = makeExpandedNodeId(${encodingJsonNodeId.value}, ${encodingJsonNodeId.namespace});`
            );
        } else {
            write("    public static encodingDefaultJson = null;");
        }
        // xx        write(`    static schema = schema${className};`);

        write_declare_class_member(write, schema);
        write_constructor(write, schema);

        write_encode(write, schema);
        write_decode(write, schema);

        write_enumerations(write, schema);
        write_isValid(write, schema);

        write(`    public get schema(): StructuredTypeSchema { return schema${className}; }`);
    }
    write("}");

    if (dataTypeNodeId) {
        write(`${className}.schema.dataTypeNodeId = ${className}.dataTypeNodeId;`);
    }
    if (encodingBinaryNodeId) {
        write(`${className}.schema.encodingDefaultBinary = ${className}.encodingDefaultBinary;`);
    }

    if (encodingXmlNodeId) {
        write(`${className}.schema.encodingDefaultXml = ${className}.encodingDefaultXml;`);
    }
    if (encodingJsonNodeId) {
        write(`${className}.schema.encodingDefaultJson = ${className}.encodingDefaultJson;`);
    }

    if (needRegistration) {
        write(`registerClassDefinition( ${className}.dataTypeNodeId, "${className}", ${className});`);
    }
}

function getDataTypeNodeId(schema: IStructuredTypeSchema): NodeId {
    const className = schema.name;
    const encodingBinaryId = (DataTypeIds as any)[className];
    return coerceNodeId(encodingBinaryId);
}
function getEncodingBinaryId(schema: IStructuredTypeSchema): NodeId {
    const className = schema.name;
    const encodingBinaryId = (ObjectIds as any)[className + "_Encoding_DefaultBinary"];
    return coerceNodeId(encodingBinaryId);
}

function getEncodingXmlId(schema: IStructuredTypeSchema): NodeId {
    const className = schema.name;
    const encodingXmlId = (ObjectIds as any)[className + "_Encoding_DefaultXml"];
    return coerceNodeId(encodingXmlId);
}
function getEncodingJsonId(schema: IStructuredTypeSchema): NodeId {
    const className = schema.name;
    const encodingXmlId = (ObjectIds as any)[className + "_Encoding_DefaultJson"];
    return coerceNodeId(encodingXmlId);
}

/* eslint complexity:[0,50],  max-statements: [1, 254]*/
export function produce_TScript_code(
    schema: IStructuredTypeSchema,
    localSchemaFile: string,
    generatedTypescriptFilename: string
): void {
    const className = schema.name;

    generatedObjectSchema[className] = generatedTypescriptFilename;

    schema.baseType = schema.baseType || "BaseUAObject";

    const baseClass = schema.baseType;

    check_schema_correctness(schema);

    const f = new LineFile1();

    const write = makeWrite(f);

    const complexTypes = schema.fields.filter(
        (field: FieldType) => field.category === FieldCategory.complex && field.fieldType !== schema.name
    );

    const folderForSourceFile = path.dirname(generatedTypescriptFilename);

    // -------------------------------------------------------------------------
    // - insert common requires
    // -------------------------------------------------------------------------
    write("/**");
    write(" * @module node-opcua-address-space.types");
    write(" */");
    write("/* istanbul ignore file */\n");
    write('import { assert } from "node-opcua-assert";');
    write('import * as util from "util";');
    write('import { makeNodeId, makeExpandedNodeId } from "node-opcua-nodeid";');
    write(`import {`);
    write(`     parameters,`);
    write(`     check_options_correctness_against_schema,`);
    write(`     resolve_schema_field_types,`);
    write(`     initialize_field,`);
    write(`     initialize_field_array,`);
    write(`     generate_new_id,`);
    write(`     getBuiltInType,`);
    write(`     registerClassDefinition,`);
    write(`     getStructuredTypeSchema,`);
    write(`     BaseUAObject,`);
    write(`     getEnumeration`);
    write(` } from "node-opcua-factory";`);
    write('import { encodeArray, decodeArray } from "node-opcua-basic-types";');
    // xx write('import { BaseUAObject } from "node-opcua-factory";');
    write("/* tslint:disable:no-this-assignment */");
    write("/* tslint:disable:max-classes-per-file */");

    const schemaObjName = schema.name + "_Schema";

    write(`import { ${schemaObjName} } from "${localSchemaFile}";`);
    write("const schema = " + schemaObjName + ";");

    // -------------------------------------------------------------------------
    // - insert definition of complex type used by this class
    // -------------------------------------------------------------------------
    const tmpMap: any = {};
    for (const field of complexTypes) {
        if (Object.prototype.hasOwnProperty.call(tmpMap, field.fieldType)) {
            continue;
        }
        tmpMap[field.fieldType] = 1;

        const filename = get_class_TScript_filename_local(field.fieldType);
        const localFilename = normalize_require_file(folderForSourceFile, filename);

        if (fs.existsSync(filename)) {
            // xx write("const " + field.fieldType + ' = require("' + local_filename + '").' + field.fieldType + ";");
            write(`import { ${field.fieldType} } from "${localFilename}";`);
        } else {
            write(`import { ${field.fieldType} } from "../source/imports";`);
        }
    }

    // -------------------------------------------------------------------------
    // - insert definition of base class
    // -------------------------------------------------------------------------

    if (baseClass !== "BaseUAObject") {
        const filename = get_class_TScript_filename_local(baseClass);
        const localFilename = normalize_require_file(folderForSourceFile, filename);
        // xx console.log(" ===> filename", filename, localFilename, fs.existsSync(filename));

        if (fs.existsSync(filename)) {
            assert(!localFilename.match(/\\/));
            write("import { " + baseClass + ' } from "' + localFilename + '";');
        } else {
            write("const " + baseClass + ' = getStructureTypeConstructor("' + baseClass + '");');
        }
    }

    write_expose_encoder_decoder(write, schema);

    writeStructuredType(write, schema);

    f.saveFormat(generatedTypescriptFilename, (code) => {
        return code;
        /*
        const options: prettier.Options = {
            bracketSpacing: true,
            insertPragma: true,
            parser: "typescript",
            printWidth: 120
        };
        return prettier.format(code, options);
        */
    });
}
