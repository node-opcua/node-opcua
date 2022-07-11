/**
 * take a OPCUA version string and make it compliant with the semver specification
 * @param version
 * @returns
 */
export function makeSemverCompatible(version?: string): string {
    version = version || "0.0.0";

    const matches = version.match(/[0-9]+(\.[0-9]+(\.[0-9]+)?)?/);
    if (!matches) {
        return "0.0.0";
    }
    version = matches[0];
    const version_array = version.split(".").map((a) => parseInt(a, 10));

    if (version_array.length === 1) {
        version_array.push(0);
    }
    if (version_array.length === 2) {
        version_array.push(0);
    }
    return version_array.map((a) => a.toString()).join(".");
}
