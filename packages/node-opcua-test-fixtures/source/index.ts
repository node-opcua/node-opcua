import * as  path from "path";
export function getFixture(relativeName: string) {
    const filename =  path.join(__dirname, ".." , relativeName);
    return filename;
}
