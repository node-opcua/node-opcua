import fs from "node:fs";
import path from "node:path";
import should from "should";
import { allUnits, categorizedUnits, unitsNotInFoundationTable } from "../dist/index.js";

/**
 * The OPC Foundation's own UNECE-code -> OPC UA EUInformation mapping table (same 1562 rows
 * as node-opcua-data-access's tools/unece-to-opcua-table.json - see that package's
 * tools/extract-unece-table.cjs / tools/check-unece-table.ts for how it is extracted and why).
 * It is what the CTT 1.05.513 "Base Info Engineering Units" 001/004 test cases validate every
 * EUInformation.displayName / description against, and it is what tools/build.ts here now
 * generates allUnits / categorizedUnits from for every code it knows.
 */
interface FoundationEntry {
    UNECECode: string;
    UnitId: string;
    DisplayName: string;
    Description: string;
}

const tablePath = path.join(import.meta.dirname, "../tools/unece-to-opcua-table.json");
const table = JSON.parse(fs.readFileSync(tablePath, "utf8")) as Record<string, FoundationEntry>;

interface EUInformationLike {
    unitId: number;
    displayName?: { text?: string };
    description?: { text?: string };
}

// allUnits is flat; categorizedUnits nests table-backed units under sector -> quantity, and the
// "Level 3 Units (uncategorized)" ones directly at the top level (see tools/build.ts).
function flattenEUInformationEntries(obj: Record<string, unknown>, out: Record<string, EUInformationLike>, prefix: string) {
    for (const [key, value] of Object.entries(obj)) {
        if (!value || typeof value !== "object") continue;
        if ("unitId" in value) {
            out[`${prefix}${key}`] = value as EUInformationLike;
        } else {
            flattenEUInformationEntries(value as Record<string, unknown>, out, `${prefix}${key}.`);
        }
    }
    return out;
}

function checkAgainstFoundationTable(name: string, flat: Record<string, EUInformationLike>) {
    for (const [key, eu] of Object.entries(flat)) {
        const entry = table[String(eu.unitId)];
        if (!entry) {
            it(`${name}.${key} (unitId ${eu.unitId}) is recorded in unitsNotInFoundationTable`, () => {
                should(unitsNotInFoundationTable.has(eu.unitId)).eql(
                    true,
                    `${name}.${key} unitId ${eu.unitId} is absent from the Foundation table but not in unitsNotInFoundationTable`
                );
            });
            continue;
        }
        it(`${name}.${key} (unitId ${eu.unitId}) matches the OPC Foundation table`, () => {
            should(eu.displayName?.text ?? "").eql(entry.DisplayName, `${name}.${key} displayName mismatch`);
            should(eu.description?.text ?? "").eql(entry.Description, `${name}.${key} description mismatch`);
        });
    }
}

describe("allUnits/categorizedUnits vs the OPC Foundation UNECE_to_OPCUA table", () => {
    const flatAllUnits = flattenEUInformationEntries(allUnits as unknown as Record<string, unknown>, {}, "");
    const flatCategorizedUnits = flattenEUInformationEntries(categorizedUnits as unknown as Record<string, unknown>, {}, "");

    checkAgainstFoundationTable("allUnits", flatAllUnits);
    checkAgainstFoundationTable("categorizedUnits", flatCategorizedUnits);

    it("categorizedUnits.piece (H87) is not an official UNECE Foundation code", () => {
        should.exist(categorizedUnits.piece);
        should(categorizedUnits.piece.unitId).eql(4732983);
        should(unitsNotInFoundationTable.has(categorizedUnits.piece.unitId)).eql(true);
    });
});
