import path from "node:path";

const here = import.meta.dirname;

export function getFixture(relativeName: string) {
    const filename = path.join(here, "..", relativeName);
    return filename;
}
