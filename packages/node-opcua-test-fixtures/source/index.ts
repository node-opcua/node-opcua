import path from "node:path";
export function getFixture(relativeName: string) {
    const filename = path.join(__dirname, "..", relativeName);
    return filename;
}
