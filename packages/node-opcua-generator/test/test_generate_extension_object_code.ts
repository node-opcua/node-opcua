/**
 * The code generator, tested through the entry point that is actually used.
 *
 * `generate(bsdFile, outputFile)` is what node-opcua-types' `generate` script calls, and it
 * is what produces that whole package from Opc.Ua.Types.bsd. Running it over a miniature
 * dictionary covers the same path over something small enough to assert on.
 *
 * This package reported "0 passing" before these. Its five test files had been disabled in
 * the 2018 TypeScript port and were written against a `registerObject(schemaObject, folder)`
 * signature that no longer exists, so they could not be revived, only replaced.
 */
import fs from "node:fs";
import path from "node:path";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NumericRange } from "node-opcua-numeric-range";
import { Variant } from "node-opcua-variant";
import should from "should";
import ts from "typescript";

import { generate } from "../dist/index.js";
import { generatedFolder, testFixture } from "./paths.js";

// Loading these registers them with the factory, and the schema cannot be parsed until they
// are: an IndexRange field resolves to NumericRange, and without it parseBinaryXSD stops
// with "Cannot find schema for simple type NumericRange". node-opcua-types' own generate
// script carries the same imports, under the name _force_inclusion.
const _force_inclusion = [NumericRange, QualifiedName, LocalizedText, Variant, DataValue];

describe("generating TypeScript from a binary schema", () => {
    const outputFolder = generatedFolder("extension_object_code");
    const outputFile = path.join(outputFolder, "_generated_sample_types.ts");
    let code = "";

    before(async () => {
        fs.rmSync(outputFolder, { recursive: true, force: true });
        fs.mkdirSync(outputFolder, { recursive: true });
        await generate(testFixture("SampleTypes.bsd"), outputFile);
        code = fs.readFileSync(outputFile, "utf8");
    });

    after(() => {
        fs.rmSync(outputFolder, { recursive: true, force: true });
    });

    it("should write the file it was asked for", () => {
        fs.existsSync(outputFile).should.eql(true, `expecting ${outputFile} to have been generated`);
        code.length.should.be.greaterThan(0);
    });

    it("should emit a class per structured type in the dictionary", () => {
        code.should.match(/export class SampleLeaf\b/);
        code.should.match(/export class SampleHolder\b/);
        code.should.match(/export class SampleDerivedHolder\b/);
    });

    it("should extend the base type named by the schema, not always ExtensionObject", () => {
        // SampleDerivedHolder declares BaseType="tns:SampleHolder"
        code.should.match(/export class SampleDerivedHolder extends SampleHolder\b/);
    });

    it("should carry every field through to the generated class", () => {
        for (const field of ["name", "weight", "title", "leaf", "leaves", "extra"]) {
            code.should.match(new RegExp(`\\b${field}\\b`), `expecting field ${field} in the generated code`);
        }
    });

    it("should register each type with the factory", () => {
        // the generated module is what makes these types decodable, so this is the line
        // that matters most in it
        code.should.match(/registerClassDefinition\(/);
    });

    it("should stamp the generated file with a generation time", () => {
        code.should.match(/^\/\/ -+ This code has been automatically generated !!! \d{4}-\d{2}-\d{2}T[\d:.]+Z/);
    });

    it("should emit TypeScript that parses", () => {
        // the generated file is compiled as part of node-opcua-types, so a syntax error in
        // the emitter breaks that build rather than anything here. Parsing it is the cheapest
        // check that the emitter still produces a well-formed module.
        const result = ts.transpileModule(code, {
            reportDiagnostics: true,
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
        });
        const syntactic = (result.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
        syntactic.should.eql([], `expecting the generated code to parse cleanly, got: ${syntactic.join("; ")}`);
    });

    it("should reject a schema file that is not there", async () => {
        let caught: Error | undefined;
        try {
            await generate(testFixture("NoSuchFile.bsd"), path.join(outputFolder, "_never.ts"));
        } catch (err) {
            caught = err as Error;
        }
        // should.exist first: a check on the message says nothing if nothing was thrown
        should.exist(caught, "expecting generate to reject a missing schema file");
        should(caught?.message).match(/ENOENT|no such file/i);
    });
});
