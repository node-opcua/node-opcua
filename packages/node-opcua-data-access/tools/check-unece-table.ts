/**
 * Compares node-opcua-data-access's `standardUnits` table against the OPC Foundation's
 * official UNECE-code -> OPC UA EUInformation mapping table
 * (http://www.opcfoundation.org/UA/EngineeringUnits/UNECE/UNECE_to_OPCUA.csv), which is what
 * the CTT 1.05.513 "Base Info Engineering Units" 001/004 test cases validate every
 * EUInformation.displayName / description against.
 *
 * The live URL above redirects to a GitHub login page in this environment (no anonymous
 * access), so this script falls back to the identical table embedded by the CTT itself as
 * JavaScript:
 *   C:\Program Files\OPC Foundation\UA 1.05\Compliance Test Tool\ServerProjects\Standard\
 *     library\Information\UNECE_to_OPCUA.js
 * (1562 entries, fields UNECECode / UnitId / DisplayName / Description). A committed snapshot
 * of that data lives next to this script as unece-to-opcua-table.json (see
 * extract-unece-table.cjs) and is what node-opcua-data-access.test.ts uses too, so this
 * check and the unit test can never drift apart.
 *
 * Run with: npx tsx tools/check-unece-table.ts
 */
import fs from "node:fs";
import path from "node:path";
import { standardUnits } from "../source/EUInformation";

interface UneceEntry {
    UNECECode: string;
    UnitId: string;
    DisplayName: string;
    Description: string;
}

const tablePath = path.join(__dirname, "unece-to-opcua-table.json");
const table = JSON.parse(fs.readFileSync(tablePath, "utf8")) as Record<string, UneceEntry>;

// Base Info Engineering Units 004.js accepts more than the table's literal DisplayName/Description
// for a handful of unitIds (either of two historic spellings, or the table value itself).
const displayNameAlternatives: Record<number, string[]> = {
    4478030: ["dt", "dtn"], // dt | dtn
    4338485: ["kg/l", "kg/L"], // kg/l | kg/L
    4732976: ["U", "RU"], // U | RU
    20529: ["%", "pct"] // % | pct
};
const descriptionAlternatives: Record<number, string[]> = {
    5002318: ["ton (UK)", "long ton (US)"],
    5461070: ["ton (US)", "short ton (UK/US)"],
    4280410: ["troy ounce", "apothecary ounce"],
    4405558: ["reciprocal pascal", "pascal to the power minus one"],
    4405553: ["reciprocal kelvin", "kelvin to the power minus one"],
    5059120: ["reciprocal megakelvin", "megakelvin to the power minus one"]
};

let mismatches = 0;
let missing = 0;
let ok = 0;

for (const [key, eu] of Object.entries(standardUnits)) {
    const unitId = eu.unitId as number;
    const entry = table[String(unitId)];
    if (!entry) {
        missing++;
        console.log(
            `MISSING FROM TABLE: ${key} unitId=${unitId} displayName=${eu.displayName?.text} description=${eu.description?.text}`
        );
        continue;
    }
    const displayName = eu.displayName?.text ?? "";
    const description = eu.description?.text ?? "";
    const problems: string[] = [];
    const okDisplayNames = [entry.DisplayName, ...(displayNameAlternatives[unitId] ?? [])];
    const okDescriptions = [entry.Description, ...(descriptionAlternatives[unitId] ?? [])];
    if (!okDisplayNames.includes(displayName)) {
        problems.push(`displayName "${displayName}" !== table "${entry.DisplayName}"`);
    }
    if (!okDescriptions.includes(description)) {
        problems.push(`description "${description}" !== table "${entry.Description}"`);
    }
    if (problems.length) {
        mismatches++;
        console.log(`MISMATCH: ${key} (${entry.UNECECode}) ${problems.join("; ")}`);
    } else {
        ok++;
    }
}

console.log(
    `\n${ok} ok, ${mismatches} mismatched, ${missing} missing (of ${Object.keys(standardUnits).length} standardUnits entries)`
);
if (mismatches > 0 || missing > 0) {
    process.exitCode = 1;
}
