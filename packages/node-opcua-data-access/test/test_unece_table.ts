import fs from "node:fs";
import path from "node:path";
import should from "should";
import { standardUnits } from "../dist/index.js";

// A committed snapshot of the OPC Foundation's UNECE-code -> EUInformation mapping table
// (http://www.opcfoundation.org/UA/EngineeringUnits/UNECE/UNECE_to_OPCUA.csv), restricted to
// the UNECE codes standardUnits carries. This is the same table the CTT 1.05.513
// "Base Info Engineering Units" 001/004 test cases validate every EUInformation.displayName
// and description against - see tools/check-unece-table.ts for the full-table checker and
// tools/extract-unece-table.cjs / tools/make-snapshot.cjs for how the snapshot is produced
// (from the CTT's own embedded copy of the table, since the Foundation's URL is not reachable
// anonymously from this environment).
interface UneceEntry {
    UNECECode: string;
    UnitId: string;
    DisplayName: string;
    Description: string;
}

const snapshotPath = path.join(__dirname, "unece-table-snapshot.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as Record<string, UneceEntry>;

// unitId 20529 (percent, code P1): the Foundation table's DisplayName is "% or pct", but the
// CTT's own 004.js test case also accepts the literal "%" or "pct" - see check-unece-table.ts.
const displayNameAlternatives: Record<number, string[]> = {
    20529: ["%", "pct"]
};

describe("standardUnits vs the OPC Foundation UNECE_to_OPCUA table", () => {
    for (const [code, entry] of Object.entries(snapshot)) {
        it(`code ${code} (unitId ${entry.UnitId}) matches the table`, () => {
            const found = Object.values(standardUnits).find((eu) => eu.unitId === Number(entry.UnitId));
            should.exist(found, `no standardUnits entry uses unitId ${entry.UnitId} (code ${code})`);

            const displayName = found!.displayName?.text ?? "";
            const okDisplayNames = [entry.DisplayName, ...(displayNameAlternatives[Number(entry.UnitId)] ?? [])];
            should(okDisplayNames.includes(displayName)).eql(
                true,
                `displayName "${displayName}" should be one of ${JSON.stringify(okDisplayNames)} for code ${code}`
            );

            const description = found!.description?.text ?? "";
            should(description).eql(entry.Description, `description mismatch for code ${code}`);
        });
    }

    it("standardUnits.one (C62) is the table-backed count unit that replaces the non-standard H87 (piece)", () => {
        should(standardUnits.one.unitId).eql(4404786);
        should(standardUnits.one.displayName?.text).eql("1");
        should(standardUnits.one.description?.text).eql("one");
    });
});
