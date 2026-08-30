import fs from "node:fs";
import path from "node:path";
import should from "should";

export function getFixture(file: string): string {
    const full = path.join(__dirname, "../test_fixtures", file);
    should(fs.existsSync(full)).be.eql(true);
    return full;
}
