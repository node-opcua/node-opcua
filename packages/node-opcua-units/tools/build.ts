/* eslint-disable complexity */
import path from "path";
import fs from "fs";
import { readFile, utils } from "xlsx-ugnis";


const j = (s: string) => s.replace(/ /gm, "_");

const a = (s: string) => (s ? s.replace("U+00a0", "").replace(" ", " ").replace(/"/gm, "\\\"").replace(/'/gm, "").replace(/\n|\r/gm, " ") : "").trim();

const makeU = (s: string) => {
    const r = a(s.replace(/ /gm, "_").replace("_[", "[").replace("_(", "(")).replace(/_-_/gm, "-");
    if (/,_/.test(r)) {
        return r.replace(/,_/, "(") + ")";
    }
    return r;
}

interface EntryAnnexeII_III {
    Name: string;
    "Common\nCode": string;
    Description: string;
    "Level /\r\nCategory": string;
    Symbol: string;
    "Conversion Factor": string;
    Status: string;
}

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
function makeDescription(u: Entry | EntryAnnexeII_III) {
    const cf = u["Conversion Factor"] || "";
    const name = a(u.Name);
    const desc = a(u.Description || "");
    let str = name;
    if (desc) {
        str += " - " + desc;
    }
    if (cf) {
        str += ` (${cf})`;
    }
    return str;
}

// eslint-disable-next-line max-statements
async function main() {

    // Reading our test file
    const file = readFile(path.join(__dirname, './rec20_Rev17e-2021.xlsx'));

    const annex1 = utils.sheet_to_json(file.Sheets[file.SheetNames[1]]) as Entry[];
    const annex2_3 = utils.sheet_to_json(file.Sheets[file.SheetNames[2]]) as EntryAnnexeII_III[];

    type Unit = Record<string, Entry>;
    type Sector = Record<string, Unit>;
    const units: Record<string, Sector> = {};
    const quantityTitles: Record<string, string> = {};

    // also add Level 3 units that are not marked with X or D ( Deleted) from annex II and III
    const uncategorizedUnits = annex2_3
        .filter((x) => !x.Status && x["Level /\r\nCategory"][0] === "3")
        .sort((a, b) => a.Name > b.Name ? 1 : -1)

    for (const e of annex1) {
        units[e.Sector] = units[e.Sector] || {};

        const sector = units[e.Sector];

        const quantity = a((e.Quantity || "generic").split(",")[0].replace(/\(.*\)/gm, ""));

        sector[quantity] = sector[quantity] || {};
        quantityTitles[quantity] = a(e.Quantity);

        const q = sector[quantity];
        q[e.Name] = e;
    }
    const str: string[] = [];
    const w = (s: string) => str.push(s);

    {
        w("// Automatically generated file, do not modify");
        w(`import { EUInformation } from "node-opcua-types";`);
        w(`import { makeEUInformation }  from "node-opcua-data-access";`);
        w(`export const categorizedUnits = { `);
        for (const [keyS, sector] of Object.entries(units)) {
            w(' /**');
            w(`  * ${keyS}`);
            w('  */');
            const shortKeyS = j(keyS.split(",")[0]);
            w(` '${a(shortKeyS)}': {`);
            for (const [keyQ, q] of Object.entries(sector)) {
                w('   /**');
                w(`    * ${quantityTitles[keyQ]}`);
                w('    */');
                w(`   '${a(j(keyQ))}': {`);
                for (const [keyU, u] of Object.entries(q)) {
                    const code = u["Common Code"];
                    const unit = makeU(keyU);
                    const description = makeDescription(u);
                    w(`       '${unit}': makeEUInformation("${code}","${a(u.Symbol || "")}","${description}"),`);

                }
                w(`    },`);
            }
            w(`  },`);
        }
        w(' /**');
        w(`  * Level 3 Units ( uncategorized)`);
        w('  */');
        for (const u of uncategorizedUnits) {
            const code = u["Common\nCode"];
            if (code === undefined || code === "undefined") {
                console.log(Object.keys(u).map((t)=>`"${t}`));
                debugger;
            }
            const keyU = u.Name;
            const unit = makeU(keyU);
            const cf = u["Conversion Factor"] || "";
            const description = makeDescription(u);
            w(`       '${unit}': makeEUInformation("${code}","${a(u.Symbol || "")}","${description}"),`);
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
            const code = u["Common Code"];
            const unit = makeU(keyU);
            const cf = u["Conversion Factor"] || "";
            const description = makeDescription(u);
            w(`       '${unit}': makeEUInformation("${code}","${a(u.Symbol || "")}","${description}"),`);
        }

        w("// Some other useful (non-SI) units");
        for (const u of uncategorizedUnits) {
            const keyU = u.Name;
            // there is a conflict with this unit denier tthat we intentionaly ignore here
            if (keyU === "denier") continue;
            const code = u["Common\nCode"];
            const unit = makeU(keyU);
            const cf = u["Conversion Factor"] || "";
            const description = makeDescription(u);
            w(`       '${unit}': makeEUInformation("${code}","${a(u.Symbol || "")}","${description}"),`);
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


