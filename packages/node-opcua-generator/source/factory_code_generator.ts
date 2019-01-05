/**
 * @module node-opcua-generator
 */

// tslint:disable:max-line-length
// tslint:disable:max-depth

import * as fs from "fs";
import { assert } from "node-opcua-assert";
import {
    check_schema_correctness,
    extract_all_fields,
    FieldCategory,
    FieldType,
    getStructuredTypeSchema,
    StructuredTypeSchema
} from "node-opcua-factory";
import * as  os from "os";
import * as path from "path";
import * as  prettier from "prettier";
import * as _ from "underscore";

import { ObjectIds } from "node-opcua-constants";
import { make_debugLog } from "node-opcua-debug";
import { coerceNodeId, makeExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { capitalizeFirstLetter, LineFile, normalize_require_file } from "node-opcua-utils";

const produceComment = false;
const debugLog = make_debugLog(__filename);

const generatedObjectSchema: any = {};

function quotify(str: string): string {
    return "\"" + str + "\"";
}

function makeFieldType(field: FieldType) {
    return "{" + field.fieldType + (field.isArray ? "[" : "") + (field.isArray ? "]" : "") + "}";
}

function convertToJavascriptCode(obj: any): string {
    const lines: string[] = [];

    if (typeof (obj) === "object" && !(obj instanceof Array)) {
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
    } else if (typeof (obj) === "function") {

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
                throw new Error("get_class_tscript_filename: Cannot find folder " + optionalFolder);
            }
        }
        folder = optionalFolder;
    } else {
        folder = exports.folder_for_generated_file;
        throw new Error("get_class_javascript_filename : DEPRECATED ");
    }
    return folder;
}

export function get_class_tscript_filename(schemaName: string, optionalFolder?: string): string {
    const folder = get_class_folder(schemaName, optionalFolder);
    return path.join(folder, "_" + schemaName + ".ts");
}

export function get_class_jscript_filename(schemaName: string, optionalFolder?: string): string {
    const folder = get_class_folder(schemaName, optionalFolder);
    return path.join(folder, "_" + schemaName + ".js");
}

function get_class_tscript_filename_local(schemaName: string): string {

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

type WriteFunc = (...args: string[]) => void;

function write_enumeration_setter(
  write: WriteFunc,
  schema: StructuredTypeSchema,
  field: FieldType, member: string
): void {
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

function write_enumeration(
  write: WriteFunc,
  schema: StructuredTypeSchema,
  field: FieldType,
  member: string,
  i: number
): void {
    assert(!field.isArray); // would not work in this case
    const capMember = capitalizeFirstLetter(member);
    write(
      `        this.${field.name} = this.set${capMember}(initialize_field(schema.fields[${i}], options.${field.name}));`
    );
}

function write_complex_fast_construct(write: WriteFunc, schema: StructuredTypeSchema, field: FieldType, member: string) {

    if (field.isArray) {
        write(`       this.${member} =  null; /* null array */`);
    } else {
        write(`       this.${member} =  new ${field.fieldType}();`);
    }
}

function write_complex(write: WriteFunc, schema: StructuredTypeSchema, field: FieldType, member: string /*, i*/) {

    if (field.isArray) {
        if (field.hasOwnProperty("defaultValue")) {
            // todo: fix me => should call field defaultValue in the live version
            write(`        this.${member} = []; // should default`);
        } else {
            write(`        this.${member} = [];`);
        }
        write(`        if (options.${member}) {`);
        write(`            assert(_.isArray(options.${member}));`);
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

function write_basic(write: WriteFunc, schema: StructuredTypeSchema, field: FieldType, member: string, i: number): void {

    assert(field.category === FieldCategory.basic);

    if (field.isArray) {
        // write(`this.${member} = [];`);
        // write(`if (options.${member}) {`);
        // write(`    assert(_.isArray(options.${member}));`);
        // write(`    this.${member} = options.browsePath.map(e => field.coerce(e) );`);
        // write(`}`);
        write(`        this.${member} = initialize_field_array(schema.fields[${i}], options.${field.name});`);
    } else {
        write(`        this.${member} = initialize_field(schema.fields[${i}], options.${field.name});`);
    }
}

function write_constructor(write: WriteFunc, schema: StructuredTypeSchema): void {

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
                if (_.isFunction(field.defaultValue)) {
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

    write(`    constructor(options?: ${className}Options) {`);
    write("");
    if (baseClass) {
        if (baseClass === "BaseUAObject") {
            write("        super();");
        } else {
            write("        super(options);");
        }
        write("");
    }

    write(`        const schema = ${className}.schema;`);
    if (_.isFunction(schema.constructHook)) {
        write("        options = schema.constructHook(options);");
    } else {
        write("        options = schema.constructHook ? schema.constructHook(options) : options;");
    }
    // write("        options = options || {};");
    write("        if (options === undefined || options === null) { options = {}; }");

    write("        /* istanbul ignore next */");
    write("        if (parameters.debugSchemaHelper) {");
    write("            check_options_correctness_against_schema(this, schema, options);");
    write("        }");

    // -----------------------------------------------------------------------------------------------------------------
    // Special case when options === null => fast constructor for deserialization
    // -----------------------------------------------------------------------------------------------------------------
    if (hasComplex(schema)) {
        write("        if (options === null) {");
        {
            if (baseClass) {
                // write("        " + baseclass + ".call(this,options);");
                // write("        " + baseclass + ".call(this,options);");
            }
            for (let i = 0; i < n; i++) {

                const field = schema.fields[i];
                const member = field.name;

                switch (field.category) {
                    case FieldCategory.enumeration:
                    case FieldCategory.basic:
                        break;
                    case FieldCategory.complex:
                        write_complex_fast_construct(write, schema, field, member);
                        break;
                }
            }
        }
        write("      }");
    }

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

function write_isValid(write: WriteFunc, schema: StructuredTypeSchema): void {
    // ---------------------------------------
    if (_.isFunction(schema.isValid)) {
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

function write_encode(write: WriteFunc, schema: StructuredTypeSchema): void {

    if (_.isFunction(schema.encode)) {
        write("    public encode(stream: BinaryStream): void {");
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
        write("     public encode(stream: BinaryStream): void {");
        write("        super.encode(stream);");

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
                        write(
                          `        encodeArray(this.${member}, stream, (obj, stream1) => { obj.encode(stream1); });`);
                    } else {
                        write(`        this.${member}.encode(stream);`);
                    }
                    break;
            }
        }
        write("    }");
    }

}

function write_decode(write: WriteFunc, schema: StructuredTypeSchema): void {

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
                    if (_.isFunction(field.decode)) {
                        write("        this." + member + " = " + "schema" + ".fields[" + i + "].decode(stream);");
                    } else {
                        write("        this." + member + " = decode" + field.fieldType + "(stream);");
                    }
                }
            }
        } else {
            assert(field.category === FieldCategory.complex);
            if (field.isArray) {
                write("        this." + member + " = decodeArray(stream, (stream1: BinaryStream) => {");
                write("            const obj = new " + field.fieldType + "();");
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
    if (_.isFunction(schema.decode)) {

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

        if (!_.isFunction(schema.decodeDebug)) {
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
        write("        super.decode(stream);");

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

function hasEnumeration(schema: StructuredTypeSchema): boolean {
    for (const field of schema.fields) {
        if (field.category === FieldCategory.enumeration) {
            return true;
        }
    }
    return false;
}

function hasComplex(schema: StructuredTypeSchema): boolean {
    for (const field of schema.fields) {
        if (field.category === FieldCategory.complex) {
            return true;
        }
    }
    return false;
}

function write_class_constructor_options(write: WriteFunc, schema: StructuredTypeSchema): void {

    const n = schema.fields.length;
    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const member = field.name;

        const arrayOpt = field.isArray ? "[] | null" : "";

        switch (field.category) {
            case FieldCategory.enumeration: {
                write(`    ${member}?: ${field.fieldType}${arrayOpt};`);
                break;
            }
            case FieldCategory.basic: {
                if (field.fieldType === "ExtensionObject") {
                    write(`    ${member}?: (${field.fieldType} | null)${arrayOpt};`);
                } else if (field.fieldType === "Variant" || field.fieldType === "NodeId" || field.fieldType === "QualifiedName" || field.fieldType === "LocalizedText") {
                    write(`    ${member}?: (${field.fieldType}Like | null)${arrayOpt};`);
                } else {
                    write(`    ${member}?: ${field.fieldType} ${arrayOpt};`);
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

function write_declare_class_member(write: WriteFunc, schema: StructuredTypeSchema): void {
    const n = schema.fields.length;
    for (let i = 0; i < n; i++) {
        const field = schema.fields[i];
        const member = field.name;

        const arrayOpt = field.isArray ? "[] | null" : "";

        switch (field.category) {
            case FieldCategory.enumeration: {
                write(`    public ${member}: ${field.fieldType}${arrayOpt};`);
                break;
            }
            case FieldCategory.basic: {
                if (field.fieldType === "ExtensionObject") {
                    write(`    public ${member}: (${field.fieldType} | null)${arrayOpt};`);
                } else {
                    write(`    public ${member}: ${field.fieldType}${arrayOpt};`);
                }
                break;
            }
            case FieldCategory.complex: {
                write(`    public ${member}: ${field.fieldType}${arrayOpt};`);
                break;
            }
        }
    }
}

function write_enumerations(write: WriteFunc, schema: StructuredTypeSchema): void {

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

function write_expose_encoder_decoder(write: WriteFunc, schema: StructuredTypeSchema): void {
    write("");
    write("import { BinaryStream } from \"node-opcua-binary-stream\";");
    write("import { ExpandedNodeId, NodeId } from \"node-opcua-nodeid\";");

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
                    write("const _enumeration" + field.fieldType + " = " + "getEnumeration(\"" + field.fieldType + "\");");
                    write("const encode" + field.fieldType + ": (value: any, stream: BinaryStream) => void = getEnumeration(\"" + field.fieldType + "\").encode;");
                    write("const decode" + field.fieldType + ": (stream: BinaryStream) => void = getEnumeration(\"" + field.fieldType + "\").decode;");
                    break;
                case FieldCategory.complex:
                    write("const encode" + field.fieldType + ": (value: any, stream: BinaryStream) => void = getBuildInType(\"" + field.fieldType + "\").encode;");
                    write("const decode" + field.fieldType + ": (stream: BinaryStream) => void  = getBuildInType(\"" + field.fieldType + "\").decode;");
                    break;
            }
        }
    }
}

export function writeStructuredType(write: WriteFunc, schema: StructuredTypeSchema) {

    const className = schema.name;
    const baseClass = schema.baseType;

    const encodingBinaryNodeId = getEncodingBinaryId(schema);
    const encodingXmlNodeId = getEncodingXmlId(schema);

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
        if (encodingBinaryNodeId) {
            write(`    public static encodingDefaultBinary = makeExpandedNodeId(${encodingBinaryNodeId.value}, ${encodingBinaryNodeId.namespace});`
            );
        }

        if (encodingXmlNodeId) {
            write(
              `    public static encodingDefaultXml = makeExpandedNodeId(${encodingXmlNodeId.value}, ${encodingXmlNodeId.namespace});`
            );
        } else {
            write("    public static encodingDefaultXml = null;");
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

    if (encodingBinaryNodeId) {
        write(`${className}.schema.encodingDefaultBinary = ${className}.encodingDefaultBinary;`);
    }

    if (encodingXmlNodeId) {
        write(`${className}.schema.encodingDefaultXml = ${className}.encodingDefaultXml;`);
    }

    if (needRegistration) {
        write(`registerClassDefinition("${className}", ${className});`);
    }
}

function getEncodingBinaryId(schema: StructuredTypeSchema): NodeId {
    const className = schema.name;
    const encodingBinarylId = (ObjectIds as any)[className + "_Encoding_DefaultBinary"];
    return coerceNodeId(encodingBinarylId);
}

function getEncodingXmlId(schema: StructuredTypeSchema): NodeId {
    const className = schema.name;
    const encodingXmlId = (ObjectIds as any)[className + "_Encoding_DefaultXml"];
    return coerceNodeId(encodingXmlId);
}

/* eslint complexity:[0,50],  max-statements: [1, 254]*/
export function produce_tscript_code(
  schema: StructuredTypeSchema,
  localSchemaFile: string,
  generatedTypescriptFilename: string
) {

    const className = schema.name;

    generatedObjectSchema[className] = generatedTypescriptFilename;

    schema.baseType = schema.baseType || "BaseUAObject";

    const baseClass = schema.baseType;

    check_schema_correctness(schema);

    const f = new LineFile();

    function write(...args: string[]) {
        f.write.apply(f, args);
    }

    // Xx resolve_schema_field_types(schema, generatedObjectSchema);

    const complexTypes = schema.fields.filter(
      (field: FieldType) => field.category === FieldCategory.complex && field.fieldType !== schema.name);

    const folderForSourceFile = path.dirname(generatedTypescriptFilename);

    // -------------------------------------------------------------------------
    // - insert common require's
    // -------------------------------------------------------------------------
    write("/**");
    write(" * @module opcua.address_space.types");
    write(" */");
    write("import assert from \"node-opcua-assert\";");
    write("import * as util from \"util\";");
    write("import * as _ from \"underscore\";");
    write("import { makeNodeId, makeExpandedNodeId } from \"node-opcua-nodeid\";");
    write(`import {`);
    write(`     parameters,`);
    write(`     check_options_correctness_against_schema,`);
    write(`     resolve_schema_field_types,`);
    write(`     initialize_field,`);
    write(`     initialize_field_array,`);
    write(`     generate_new_id,`);
    write(`     getBuildInType,`);
    write(`     registerClassDefinition,`);
    write(`     getStructuredTypeSchema,`);
    write(`     BaseUAObject,`);
    write(`     getEnumeration`);
    write(` } from "node-opcua-factory";`);
    write("import { encodeArray, decodeArray } from \"node-opcua-basic-types\";");
    // xx write('import { BaseUAObject } from "node-opcua-factory";');
    write("/* tslint:disable:no-this-assignment */");
    write("/* tslint:disable:max-classes-per-file */");

    const schemaObjName = schema.name + "_Schema";

    write(
      `import { ${schemaObjName} } from "${localSchemaFile}";`
    );
    write("const schema = " + schemaObjName + ";");

    // -------------------------------------------------------------------------
    // - insert definition of complex type used by this class
    // -------------------------------------------------------------------------
    const tmpMap: any = {};
    for (const field of complexTypes) {
        if (tmpMap.hasOwnProperty(field.fieldType)) {
            continue;
        }
        tmpMap[field.fieldType] = 1;

        const filename = get_class_tscript_filename_local(field.fieldType);
        const localFilename = normalize_require_file(folderForSourceFile, filename);

        if (fs.existsSync(filename)) {
            // xx write("const " + field.fieldType + ' = require("' + local_filename + '").' + field.fieldType + ";");
            write(
              `import { ${field.fieldType} } from "${localFilename}";`
            );
        } else {
            write(
              `import { ${field.fieldType} } from "../source/imports";`
            );
        }
    }

    // -------------------------------------------------------------------------
    // - insert definition of base class
    // -------------------------------------------------------------------------

    if (baseClass !== "BaseUAObject") {

        const filename = get_class_tscript_filename_local(baseClass);
        const localFilename = normalize_require_file(folderForSourceFile, filename);
        // xx console.log(" ===> filename", filename, localFilename, fs.existsSync(filename));

        if (fs.existsSync(filename)) {
            assert(!localFilename.match(/\\/));
            write("import { " + baseClass + " } from \"" + localFilename + "\";");
        } else {
            write("const " + baseClass + " = getStructureTypeConstructor(\"" + baseClass + "\");");
        }
    }

    write_expose_encoder_decoder(write, schema);

    writeStructuredType(write, schema);

    f.saveFormat(generatedTypescriptFilename, (code) => {
        const options: prettier.Options = {
            bracketSpacing: true,
            insertPragma: true,
            parser: "typescript",
            printWidth: 120
        };
        return prettier.format(code, options);
    });
}
