import { ConstructorFuncWithSchema, DataTypeFactory, EnumerationDefinitionSchema, IStructuredTypeSchema, StructuredTypeSchema } from "node-opcua-factory";

export function toTypeScript(dataTypeFactory: DataTypeFactory): string {
    const enumeratedTypes: Map<string, EnumerationDefinitionSchema> = (dataTypeFactory as any)._enumerations;
    const structuredTypes: Map<string, ConstructorFuncWithSchema> = (dataTypeFactory as any)._structureTypeConstructorByNameMap;

    const declaration: Map<string, string> = new Map();

    function adjustType(t: string): string {
        if (t === "String") {
            t = "UAString";
        } else if (t === "Boolean") {
            t = "UABoolean";
        }
      
        if (!enumeratedTypes.has(t) && !structuredTypes.has(t)) {
            declaration.set(t, t);
        }
        return t;
    }
    const l: string[] = [];
    // enumeration
    for (const e of enumeratedTypes.values()) {
        l.push(`export enum ${e.name} {`);
        // console.log((e.typedEnum as any).enumItems);
        for (const v of Object.entries(e.enumValues as any)) {
            const vv = parseInt(v[0], 10);
            if (vv >= 0) {
                continue;
            }
            l.push(`    ${v[0]} = ${v[1]},`);
        }
        l.push(`}`);
    }
    const alreadyDone: Set<string> = new Set();
    function dumpType(o: IStructuredTypeSchema) {
        // base type first
        const b = o.baseType;

        const bt = structuredTypes.get(b)?.schema;

        if (b && !alreadyDone.has(o.baseType) && bt) {
            dumpType(bt);
        }
        alreadyDone.add(o.name);
        const ex1 = b && bt ? `extends ${b} ` : "";

        if (o.baseType === "Union") {
            const p: string[] = [];

            let switchFieldName = "";
            // find switchFieldName
            for (const field of o.fields) {
                if (field.switchValue === undefined) {
                    // this is the switch value field
                    switchFieldName = field.name;
                    break;
                }
            }
            // export all flavors
            for (const field of o.fields) {
                const name = field.name;
                if (field.switchValue === undefined) {
                    continue;
                }
                const a = field.isArray ? "[]" : "";
                const fieldType = adjustType(field.schema.name);
                l.push(`interface ${o.name}${field.switchValue} ${ex1}{`);
                l.push(`    ${switchFieldName}: ${field.switchValue};`);
                l.push(`    ${field.name}: ${fieldType}${a};`);
                l.push(`}`);
                p.push(`${o.name}${field.switchValue}`);
            }
            const pp = p.join(" | ");
            l.push(`type ${o.name} = ${pp};`);
        } else {
            if (o.fields.length === 0) {
                l.push("// tslint:disable-next-line: no-empty-interface");
            }

            l.push(`interface ${o.name} ${ex1}{`);
            for (const f of o.fields) {
                if (f.documentation) {
                    l.push(`    // ${f.documentation}`);
                }
                const isOpt = f.switchBit !== undefined ? "?" : "";
                const fieldType = adjustType(f.schema.name);
                if (f.isArray) {
                    l.push(`    ${f.name}${isOpt}: ${fieldType}[];`);
                } else {
                    l.push(`    ${f.name}${isOpt}: ${fieldType};`);
                }
            }
            l.push(`}`);
        }
    }
    // objects
    for (const o of structuredTypes.values()) {
        if (alreadyDone.has(o.schema.name)) {
            continue;
        }
        dumpType(o.schema);
    }
    const opcuaTypes = [...declaration.keys()].sort().join(",\n    ");
    l.unshift(`import {\n    ${opcuaTypes}\n} from "node-opcua";`);
    return l.join("\n");
}
