import { StructuredTypeSchema } from "node-opcua-factory";
import { TypeDictionary } from "./parse_binary_xsd";

export function toTypeScript(typeDictionnary: TypeDictionary): string {

    const declaration: {[key: string]: string} = {};

    function adjustType(t: string): string {
        if (!typeDictionnary.enumeratedTypes[t] && !typeDictionnary.structuredTypes[t]) {
            declaration[t] = t;
        }
        return t;
    }
    const l: string[] = [];
    // enumeration
    for (const e of Object.values(typeDictionnary.enumeratedTypes)) {
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
    const alreadyDone: {[key: string]: StructuredTypeSchema} = {};
    function dumpType(o: StructuredTypeSchema) {
        // base type first
        const b = o.baseType;
        const bt = typeDictionnary.structuredTypes[b];
        if (b && !alreadyDone[o.baseType] && bt) {
            dumpType(bt);
        }
        alreadyDone[o.name] = o;
        const ex1 = (b && bt) ? `extends ${b} ` : "";

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

            if (o.fields.length === 0 ) {
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
    for (const o of Object.values(typeDictionnary.structuredTypes)) {
        if (alreadyDone[o.name]) {
            continue;
        }
        dumpType(o);
    }
    const opcuatypes = Object.keys(declaration).sort().join(",\n    ");
    l.unshift(`import {\n    ${opcuatypes}\n} from "node-opcua";`);
    return l.join("\n");
}
