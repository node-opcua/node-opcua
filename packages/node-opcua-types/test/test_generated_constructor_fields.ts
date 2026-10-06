import { FieldCategory, type IStructuredTypeSchema, initialize_field } from "node-opcua-factory";
import should from "should";
import * as types from "../dist/index.js";

/**
 * The generated constructors set a basic field with code written out per field rather than
 * through initialize_field. For every generated type and every scalar basic field, the value
 * must be the one initialize_field gives: the field left out, given, or null.
 */
type Constructor = (new (
    options?: Record<string, unknown> | null
) => Record<string, unknown>) & {
    schema?: IStructuredTypeSchema;
};

function isGeneratedType(value: unknown): value is Constructor {
    return (
        typeof value === "function" &&
        Object.hasOwn(value, "schema") &&
        Array.isArray((value as { schema?: { fields?: unknown } }).schema?.fields)
    );
}

function generatedTypes(): [string, Constructor][] {
    const result: [string, Constructor][] = [];
    for (const [name, value] of Object.entries(types as Record<string, unknown>)) {
        if (isGeneratedType(value)) {
            result.push([name, value]);
        }
    }
    return result;
}

function lowerFirst(name: string) {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

function optionsFor(schema: IStructuredTypeSchema, options: Record<string, unknown>) {
    return (schema.constructHook ? schema.constructHook(options) : options) as Record<string, unknown>;
}

describe("GCF - generated constructors give a basic field the value initialize_field gives", () => {
    const all = generatedTypes();

    it("GCF-0 finds the generated types", () => {
        should(all.length).be.greaterThan(300);
    });

    for (const variant of ["left out", "given", "null"] as const) {
        it(`GCF-${variant} matches initialize_field for every scalar basic field ${variant}`, () => {
            let checked = 0;
            const mismatches: string[] = [];
            for (const [name, Type] of all) {
                const schema = Type.schema as IStructuredTypeSchema;
                for (const field of schema.fields) {
                    if (field.category !== FieldCategory.basic || field.isArray) {
                        continue;
                    }
                    const member = lowerFirst(field.name);
                    let given: unknown;
                    if (variant === "given") {
                        given = initialize_field(field, undefined); // a value of the field's type
                    } else if (variant === "null") {
                        given = null;
                    }
                    const options: Record<string, unknown> = variant === "left out" ? {} : { [member]: given };
                    let expected: unknown;
                    let expectedError: string | undefined;
                    try {
                        expected = initialize_field(field, optionsFor(schema, { ...options })[member]);
                    } catch (err) {
                        expectedError = (err as Error).message;
                    }
                    let actual: unknown;
                    let actualError: string | undefined;
                    try {
                        actual = new Type(options)[member];
                    } catch (err) {
                        actualError = (err as Error).message;
                    }
                    checked++;
                    if (expectedError !== undefined || actualError !== undefined) {
                        if (expectedError !== actualError) {
                            mismatches.push(
                                `${name}.${member}: threw ${actualError} where initialize_field threw ${expectedError}`
                            );
                        }
                        continue;
                    }
                    try {
                        should(actual).eql(expected);
                    } catch {
                        mismatches.push(`${name}.${member}: ${String(actual)} instead of ${String(expected)}`);
                    }
                }
            }
            should(mismatches).eql([]);
            should(checked).be.greaterThan(500);
        });
    }
});
