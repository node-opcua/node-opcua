import fs from "node:fs";
import path from "node:path";
import { commonCodeToUInt } from "node-opcua-data-access";
import { readFile, utils } from "xlsx-ugnis";

/**
 * The OPC Foundation's own UNECE-code -> OPC UA EUInformation mapping table
 * (http://www.opcfoundation.org/UA/EngineeringUnits/UNECE/UNECE_to_OPCUA.csv), extracted the
 * same way as node-opcua-data-access's copy (see
 * ../../node-opcua-data-access/tools/extract-unece-table.cjs and the comment in
 * ../../node-opcua-data-access/tools/check-unece-table.ts): it is what the CTT 1.05.513
 * "Base Info Engineering Units" 001/004 test cases validate every EUInformation against, and
 * it disagrees with the hand-written rec20 text this generator used to emit (e.g. "pascal [unit
 * of pressure]" vs the table's "pascal"). unece-to-opcua-table.json here is a copy of that
 * package's tools/unece-to-opcua-table.json (same 1562 rows); refresh both together by re-running
 * extract-unece-table.cjs and copying its output.
 */
interface FoundationEntry {
    UNECECode: string;
    UnitId: string;
    DisplayName: string;
    Description: string;
}
const foundationTable = JSON.parse(fs.readFileSync(path.join(__dirname, "./unece-to-opcua-table.json"), "utf8")) as Record<
    string,
    FoundationEntry
>;

/** UnitIds (see commonCodeToUInt) whose Common Code is not a key of the Foundation table. */
const unitsNotInFoundationTable = new Set<number>();

/**
 * Resolves the displayName/description to emit for a Common Code: the OPC Foundation table's
 * DisplayName/Description when the code is one of its 1562 entries (the CTT accepts nothing
 * else), otherwise the rec20-derived fallback, and the code is recorded in
 * unitsNotInFoundationTable so callers can tell the two apart.
 */
function resolveUnit(code: string, fallbackSymbol: string, fallbackDescription: string) {
    const unitId = commonCodeToUInt(code);
    const entry = foundationTable[String(unitId)];
    if (entry) {
        return { symbol: entry.DisplayName ?? "", description: entry.Description ?? "", inFoundationTable: true };
    }
    unitsNotInFoundationTable.add(unitId);
    return { symbol: fallbackSymbol, description: fallbackDescription, inFoundationTable: false };
}

const j = (s: string) => s.replace(/ /gm, "_");

const a = (s: string) =>
    (s ? s.replace("U+00a0", "").replace(" ", " ").replace(/"/gm, '\\"').replace(/'/gm, "").replace(/\n|\r/gm, " ") : "").trim();

const makeU = (s: string) => {
    const r = a(s.replace(/ /gm, "_").replace("_[", "[").replace("_(", "(")).replace(/_-_/gm, "-");
    if (/,_/.test(r)) {
        return `${r.replace(/,_/, "(")})`;
    }
    return r;
};

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
    "Group Number": string;
    "Group ID": string;
    "Level/ Category": string;
    "Common Code": string;
    "Conversion Factor": string;
    Description?: string;
}
/**
 * Writes one `key: makeEUInformation(...)` line, using the OPC Foundation table's
 * displayName/description when the code is one of its entries (with a doc comment flagging
 * the ones that are not).
 */
function emitUnitLine(w: (s: string) => void, keyU: string, code: string, fallbackSymbol: string, fallbackDescription: string) {
    const unit = makeU(keyU);
    const resolved = resolveUnit(code, fallbackSymbol, fallbackDescription);
    if (!resolved.inFoundationTable) {
        w(
            `       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ${code}. displayName/description below are node-opcua's own, from UNECE rec20. */`
        );
    }
    w(
        `       '${unit}': makeEUInformation(${JSON.stringify(code)},${JSON.stringify(resolved.symbol)},${JSON.stringify(resolved.description)}),`
    );
}

function makeDescription(u: Entry | EntryAnnexeII_III) {
    const cf = u["Conversion Factor"] || "";
    const name = a(u.Name);
    const desc = a(u.Description || "");
    let str = name;
    if (desc) {
        str += ` - ${desc}`;
    }
    if (cf) {
        str += ` (${cf})`;
    }
    return str;
}

async function main() {
    // Reading our test file
    const file = readFile(path.join(__dirname, "./rec20_Rev17e-2021.xlsx"));

    const annex1 = utils.sheet_to_json(file.Sheets[file.SheetNames[1]]) as Entry[];
    const annex2_3 = utils.sheet_to_json(file.Sheets[file.SheetNames[2]]) as EntryAnnexeII_III[];

    type Unit = Record<string, Entry>;
    type Sector = Record<string, Unit>;
    const units: Record<string, Sector> = {};
    const quantityTitles: Record<string, string> = {};

    // also add Level 3 units that are not marked with X or D ( Deleted) from annex II and III
    const uncategorizedUnits = annex2_3
        .filter((x) => !x.Status && x["Level /\r\nCategory"][0] === "3")
        .sort((a, b) => (a.Name > b.Name ? 1 : -1));

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
            w(" /**");
            w(`  * ${keyS}`);
            w("  */");
            const shortKeyS = j(keyS.split(",")[0]);
            w(` '${a(shortKeyS)}': {`);
            for (const [keyQ, q] of Object.entries(sector)) {
                w("   /**");
                w(`    * ${quantityTitles[keyQ]}`);
                w("    */");
                w(`   '${a(j(keyQ))}': {`);
                for (const [keyU, u] of Object.entries(q)) {
                    const code = u["Common Code"];
                    emitUnitLine(w, keyU, code, a(u.Symbol || ""), makeDescription(u));
                }
                w(`    },`);
            }
            w(`  },`);
        }
        w(" /**");
        w(`  * Level 3 Units ( uncategorized)`);
        w("  */");
        for (const u of uncategorizedUnits) {
            const code = u["Common\nCode"];
            if (code === undefined || code === "undefined") {
                console.log(Object.keys(u).map((t) => `"${t}`));
                // debugger;
            }
            const keyU = u.Name;
            emitUnitLine(w, keyU, code, a(u.Symbol || ""), makeDescription(u));
        }
        w(`}`);

        const content = str.join("\n");
        fs.promises.writeFile(path.join(__dirname, "../source/_generated_categorized_units.ts"), content);
        str.splice(0);
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
        for (const [keyU, u] of Object.entries(units).sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))) {
            const code = u["Common Code"];
            emitUnitLine(w, keyU, code, a(u.Symbol || ""), makeDescription(u));
        }

        w("// Some other useful (non-SI) units");
        for (const u of uncategorizedUnits) {
            const keyU = u.Name;
            // there is a conflict with this unit denier tthat we intentionaly ignore here
            if (keyU === "denier") continue;
            const code = u["Common\nCode"];
            emitUnitLine(w, keyU, code, a(u.Symbol || ""), makeDescription(u));
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
    {
        // Codes that appear in allUnits/categorizedUnits but are not keys of the OPC
        // Foundation's UNECE_to_OPCUA table: the CTT's Base Info Engineering Units 001/004
        // rejects an EUInformation using one of these as "not an official UNECE definition".
        w("// Automatically generated file, do not modify");
        w(
            `/**\n * UnitIds (see node-opcua-data-access's commonCodeToUInt) used by allUnits/categorizedUnits\n * whose Common Code is not a key of the OPC Foundation's UNECE_to_OPCUA table. The CTT's Base\n * Info Engineering Units 001/004 test cases reject an EUInformation carrying one of these as\n * "not an official UNECE definition"; the displayName/description on the matching entry are\n * node-opcua's own text (UNECE rec20), not the Foundation's.\n */`
        );
        const sortedIds = [...unitsNotInFoundationTable].sort((x, y) => x - y);
        w(`export const unitsNotInFoundationTable: ReadonlySet<number> = new Set([${sortedIds.join(", ")}]);`);

        const content = str.join("\n");
        fs.promises.writeFile(path.join(__dirname, "../source/_generated_units_not_in_foundation_table.ts"), content);
        str.splice(0);
    }
}
main();
