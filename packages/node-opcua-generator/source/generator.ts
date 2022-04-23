/* istanbul ignore file */
/**
 * @module node-opcua-generator
 */
// tslint:disable:max-line-length
// tslint:disable:no-console
import * as fs from "fs";
// node 14 onward : import { mkdir } from "fs/promises";
const { mkdir } = fs.promises;

import * as path from "path";
import * as ts from "typescript";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ConstructorFunc } from "node-opcua-factory";

import { get_class_TScript_filename, produce_TScript_code } from "./factory_code_generator";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */

function compileTScriptCode(typescriptFilename: string): string {
    const content = fs.readFileSync(typescriptFilename, "utf-8");

    const compilerOptions = {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2016,

        skipLibCheck: true,

        declaration: true,
        sourceMap: true,
        strict: true,

        noImplicitAny: true,
        noImplicitReturns: true
    };

    const res1 = ts.transpileModule(content, { compilerOptions, moduleName: "myModule2" });

    const javascriptFilename = typescriptFilename.replace(/\.ts$/, ".js");
    const sourceMapFilename = typescriptFilename.replace(/\.ts$/, ".js.map");

    fs.writeFileSync(javascriptFilename, res1.outputText, "utf-8");
    fs.writeFileSync(sourceMapFilename, res1.sourceMapText!, "utf-8");

    return res1.outputText;
}

export const verbose = false;

function get_caller_source_filename() {
    // let's find source code where schema file is described
    // to do make change this
    // the line has the following shape:
    //      'at blah (/home/toto/myFile.js:53:34)'
    const err = new Error("");
    const re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    if (!err.stack) {
        return "";
    }
    console.log(err.stack.split("\n"));
    const ma = err.stack.split("\n");
    let m = re.exec(ma[8]);
    if (!m) {
        m = re.exec(ma[4]);
    }
    if (!m) {
        return "../";
        // throw new Error("Invalid: cannot find caller_source_filename : " + err.stack + "\n =============");
    }
    const schemaFile = m[1];
    return schemaFile;
}

export async function generateCode(schemaName: string, localSchemaFile: string, generatedCodeFolder?: string): Promise<void> {
    const schemaTypescriptFile = schemaName + "_Schema.ts";

    const currentFolder = process.cwd();
    //
    const localSchemaFileExists = fs.existsSync(localSchemaFile);

    if (!localSchemaFileExists) {
        throw new Error(`Cannot find source file for schema ${schemaTypescriptFile}`);
    }

    if (!generatedCodeFolder) {
        generatedCodeFolder = path.join(currentFolder, "_generated_");
    }

    const generatedCodeFolderExists = fs.existsSync(generatedCodeFolder);
    if (!generatedCodeFolderExists) {
        await mkdir(generatedCodeFolder);
    }

    const generatedTypescriptSource = path.join(generatedCodeFolder, "_" + schemaName + ".ts");

    const generatedSourceExists = fs.existsSync(generatedTypescriptSource);

    let schemaFileIsNewer = false;
    let codeGeneratorIsNewer = true;

    if (generatedSourceExists) {
        const generatedSourceMtime = new Date(fs.statSync(generatedTypescriptSource).mtime).getTime();

        const schemaFileMtime = new Date(fs.statSync(localSchemaFile).mtime).getTime();

        schemaFileIsNewer = generatedSourceMtime <= schemaFileMtime;

        let codeGeneratorScript = path.join(__dirname, "factory_code_generator.ts");
        if (!fs.existsSync(codeGeneratorScript)) {
            codeGeneratorScript = path.join(__dirname, "factory_code_generator.js");
        }

        assert(fs.existsSync(codeGeneratorScript), "cannot get code factory_code_generator" + codeGeneratorScript);
        const codeGeneratorScriptMtime = new Date(fs.statSync(codeGeneratorScript).mtime).getTime();

        codeGeneratorIsNewer = generatedSourceMtime <= codeGeneratorScriptMtime;
    }
    const generatedSourceIsOutdated = !generatedSourceExists || codeGeneratorIsNewer || schemaFileIsNewer;

    if (generatedSourceIsOutdated) {
        const module = await import(localSchemaFile);
        const schema = module[schemaName + "_Schema"];

        if (!schema) {
            throw new Error(`module must export a Schema with name ${schemaName}_Schema  in ${generatedTypescriptSource}`);
        }

        debugLog(" generated_source_is_outdated ", schemaName, " to ", generatedTypescriptSource);
        if (exports.verbose) {
            console.log(" generating ", schemaName, " in ", generatedTypescriptSource);
        }
        const localSchemaFile1 = path.join("../schemas", schemaName + "_schema");
        produce_TScript_code(schema, localSchemaFile1, generatedTypescriptSource);
    }
}

export async function generateTypeScriptCodeFromSchema(schemaName: string): Promise<void> {
    const currentFolder = process.cwd();
    const schemaFilename = path.join(currentFolder, "schemas", schemaName + "_schema.ts");
    const generatedCodeFolder = path.join(process.cwd(), "_generated_");
    await generateCode(schemaName, schemaFilename, generatedCodeFolder);
}

export async function registerObject(schema: string, generateCodeFolder?: string): Promise<ConstructorFunc | null> {
    if (!schema.split) {
        console.log("error !", schema);
        // xx process.exit(1);
    }
    // we expect <schema>|<hint>
    const hintSchema = schema.split("|");
    if (hintSchema.length === 1) {
        // no hint provided
        const callerFolder = get_caller_source_filename();

        const defaultHint = path.join(path.dirname(callerFolder), "schemas");
        hintSchema.unshift(defaultHint);
        generateCodeFolder = generateCodeFolder ? generateCodeFolder : path.join(path.dirname(callerFolder), "_generated_");
    }

    const folderHint = hintSchema[0];
    schema = hintSchema[1];

    const schemaName = schema + "_Schema";
    const schemaFile = path.join(folderHint, schema + "_schema.ts");
    const module = await import(schemaFile);
    if (!module) {
        throw new Error("cannot find " + schemaFile);
    }
    const schemaObj = module[schemaName];

    await generateCode(schemaName, schemaFile, generateCodeFolder);

    return null;
}

export function unregisterObject(schema: { name: string }, folder: string): void {
    const generateTypeScriptSource = get_class_TScript_filename(schema.name, folder);
    if (fs.existsSync(generateTypeScriptSource)) {
        fs.unlinkSync(generateTypeScriptSource);
        assert(!fs.existsSync(generateTypeScriptSource));
    }
}
