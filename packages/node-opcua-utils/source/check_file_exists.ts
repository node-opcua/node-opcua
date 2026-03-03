import fs from "fs";

/**
 * Checks if a file exists and is strictly greater than 0 bytes.
 * This is useful for guarding against race conditions where a lockfile
 * system touch-creates a file just before writing to it, preventing
 * clients from reading an intermediate 0-byte state.
 */
export function checkFileExistsAndIsNotEmpty(filename: string): boolean {
    try {
        return fs.statSync(filename).size > 0;
    } catch {
        // file may not exist
        return false;
    }
}
