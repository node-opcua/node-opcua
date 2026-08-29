import path from "node:path";

// The one place this module learns where it sits on disk. `import.meta.dirname`
// cannot be used while this package emits CommonJS (TS1470), so the ESM migration
// has this single line to change rather than several scattered uses.
const here = __dirname;

export function getFixture(relativeName: string) {
    const filename = path.join(here, "..", relativeName);
    return filename;
}
