const fs = require("fs");
const path = require("path");

const cttPath =
    "C:\\Program Files\\OPC Foundation\\UA 1.05\\Compliance Test Tool\\ServerProjects\\Standard\\library\\Information\\UNECE_to_OPCUA.js";

const src = fs.readFileSync(cttPath, "utf8");
const start = src.indexOf("this.Data = {") + "this.Data = ".length;
const getTimedEntryIdx = src.indexOf("this.GetTimedEntry");
if (start < 0 || getTimedEntryIdx < 0) {
    throw new Error("Could not locate this.Data block in " + cttPath);
}
// the object literal's closing brace is the last "}" before "this.GetTimedEntry"
const closeIdx = src.lastIndexOf("}", getTimedEntryIdx);
const objText = src.slice(start, closeIdx + 1);
// eslint-disable-next-line no-eval
const data = eval("(" + objText + ")");
const count = Object.keys(data).length;

const outPath = path.join(__dirname, "unece-to-opcua-table.json");
fs.writeFileSync(outPath, JSON.stringify(data));
console.log("entries:", count);
console.log("sample C62 (one):", JSON.stringify(data["4404786"]));
console.log("sample H87 (piece):", JSON.stringify(data["4732983"]));
