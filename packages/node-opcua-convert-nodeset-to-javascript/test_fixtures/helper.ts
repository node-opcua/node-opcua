import fs from "node:fs";
import should from "should";
import { testFixture } from "../test/paths.js";

export function getFixture(file: string): string {
    const full = testFixture(file);
    should(fs.existsSync(full)).be.eql(true, `expecting a fixture at ${full}`);
    return full;
}
