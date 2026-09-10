// Generates test/unece-table-snapshot.json: the subset of the OPC Foundation's
// UNECE_to_OPCUA table (extracted by extract-unece-table.cjs) that standardUnits actually
// uses, keyed by UNECE common code. Re-run after editing standardUnits or refreshing
// unece-to-opcua-table.json.
const fs = require("fs");
const path = require("path");
const table = JSON.parse(fs.readFileSync(path.join(__dirname, "unece-to-opcua-table.json"), "utf8"));

function commonCodeToUInt(code) {
    let unitId = 0;
    const m = Math.min(4, code.length);
    for (let i = 0; i < m; i++) {
        const c = code.charCodeAt(i);
        if (c === 0) return unitId;
        unitId *= 256;
        unitId |= c;
    }
    return unitId;
}

const codes = [
    "BAR", "A97", "MBR", "PAL", "D5", "MPA", "B98", "C26", "SEC", "CMT", "MTR", "MMT", "CMQ", "MTQ",
    "CEL", "FAH", "KEL", "GRM", "KGM", "MTS", "HM", "KMH", "MSK", "KHZ", "HTZ", "MHZ", "RPM", "RPS",
    "NEW", "B37", "KWT", "MAW", "WTT", "2J", "MQH", "G53", "DD", "AMP", "BQL", "CUR", "A42", "E39",
    "A53", "FAR", "GBQ", "JOU", "B29", "KGS", "KPA", "74", "2Q", "B71", "Q35", "P1", "VLT", "AD",
    "2P", "4L", "E34", "E35", "MIN", "D61", "59", "C62"
];

const snapshot = {};
for (const code of codes) {
    const id = commonCodeToUInt(code);
    const entry = table[String(id)];
    if (!entry) throw new Error("code not found in table: " + code);
    snapshot[code] = entry;
}

fs.writeFileSync(path.join(__dirname, "../test/unece-table-snapshot.json"), JSON.stringify(snapshot, null, 4) + "\n");
console.log("wrote", Object.keys(snapshot).length, "entries");
