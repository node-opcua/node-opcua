import * as path from "path";
import * as fs from "fs";
import { readFile, utils } from "xlsx";
import { string } from "yargs";
import { s } from "../../node-opcua/dist";

// eslint-disable-next-line max-statements
async function main() {

    // Reading our test file
    const file = readFile(path.join(__dirname, './rec20_Rev17e-2021.xlsx'));

    const data: any[] = [];

    const sheets = file.SheetNames

    interface Entry {
        Sector: string;
        Quantity: string;
        Name: string;
        Symbol: string;
        'Group Number': string;
        'Group ID': string;
        "Level/ Category": string;
        "Common Code": string;
        "Conversion Factor": string;
        "Description"?: string;
    }
    const annex1 = utils.sheet_to_json(file.Sheets[file.SheetNames[1]]) as Entry[];
    const annex2_3 = utils.sheet_to_json(file.Sheets[file.SheetNames[3]]) as Entry[];


    const sectors = [... new Set(annex1.map((x) => x.Sector + "/" + x.Quantity))];

    type Unit = Record<string, Entry>;
    type Sector = Record<string, Unit>;
    const units: Record<string, Sector> = {};
    for (const e of annex1) {

        units[e.Sector] = units[e.Sector] || {};
        const sector = units[e.Sector];
        sector[e.Quantity] = sector[e.Quantity] || {};
        const q = sector[e.Quantity];
        q[e.Name] = e;
    }
    const str: string[] = [];
    const w = (s: string) => str.push(s);

    const a = (s: string) => s ? s.replace("U+00a0", "").replace(/"/gm, "\\\"").replace(/'/gm, "").replace(/\n|\r/gm, " ") : "";

    // {
    //     w("// Automatically generated file, do not modify");
    //     w(`import { EUInformation } from "node-opcua-types";`);
    //     w(`export interface CategorizedUnits { `);
    //     for (const [keyS, sector] of Object.entries(units)) {
    //         w(` '${a(keyS)}': {`);
    //         for (const [keyQ, q] of Object.entries(sector)) {

    //             w(`   '${a(keyQ)}': {`);
    //             for (const [keyU, u] of Object.entries(q)) {
    //                 w(`       '${a(keyU.replace(/ /gm, "_"))}': EUInformation; `);
    //             }
    //             w(`    },`);
    //         }
    //         w(`  },`);
    //     }
    //     w(`}`);

    //     const content = str.join("\n");
    //     fs.promises.writeFile(path.join(__dirname, "../source/_generated_i_units.ts"), content);
    //     str.splice(0);
    // }

    {
        w("// Automatically generated file, do not modify");
        w(`import { makeEUInformation }  from "node-opcua-data-access";`);
        w(`export const categorizedUnits =  { `);
        for (const [keyS, sector] of Object.entries(units)) {
            w(' /**');
            w(`  * ${keyS}`);
            w('  */');
            w(` '${a(keyS)}': {`);
            for (const [keyQ, q] of Object.entries(sector)) {
                w('   /**');
                w(`    * ${keyQ}`);
                w('    */');
                w(`   '${a(keyQ)}': {`);
                for (const [keyU, u] of Object.entries(q)) {
                    const cf = u["Conversion Factor"] || "";
                    const code = u["Common Code"];
                    w(`       '${a(keyU.replace(/ /gm, "_"))}': makeEUInformation("${code}","${a(u.Symbol)}","${a(u.Name)} - ${(a(u.Description ? u.Description + " " : "") + cf)}"),`);

                }
                w(`    },`);
            }
            w(`  },`);
        }
        w(`}`);

        const content = str.join("\n");
        fs.promises.writeFile(path.join(__dirname, "../source/_generated_categorized_units.ts"), content);
        str.splice(0);
        // const sectors2 =[... new Set(annex2_3.map((x)=>x.Sector))];
        // console.log(sectors2);
        // for(const entry of annex1) {
        // }
    }
    {
        const units: Record<string, Entry> = {};
        for (const e of annex1) {
            units[a(e.Name)] = e;
        }
        w("// Automatically generated file, do not modify");
        w(`import { EUInformation } from "node-opcua-types";`);
        w(`import { makeEUInformation }  from "node-opcua-data-access";`);
        w(`export const allUnits  =  { `);
        for (const [keyU, u] of Object.entries(units).sort(([a], [b]) => a > b ? 1 : (a < b) ? -1 : 0)) {
            const cf = u["Conversion Factor"] || "";
            const code = u["Common Code"];
            w(`       '${a(keyU.replace(/ /gm, "_"))}': makeEUInformation("${code}","${a(u.Symbol)}","${a(u.Name)} - ${(a(u.Description ? u.Description + " " : "") + cf)}"),`);
        }
        w(`}`);

        const content = str.join("\n");
        fs.promises.writeFile(path.join(__dirname, "../source/_generated_all_units.ts"), content);
        str.splice(0);
        // const sectors2 =[... new Set(annex2_3.map((x)=>x.Sector))];
        // console.log(sectors2);
        // for(const entry of annex1) {
        // }
    }
}
main();