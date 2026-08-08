/**
 * @module node-opcua-alias-name-server
 *
 * Persistence for `LastChange` (OPC 10000-17 clause 6.3.1).
 *
 * Clause 6.3.1 is blunt about why this exists: *"The LastChange shall be
 * persisted. A Client that detects a LastChange that is older than what it has
 * cached, shall clear all cached AliasNameCategories and related AliasNames."*
 *
 * So a restart that reset `LastChange` to zero would not merely lose
 * information — it would order every connected Client to throw away a cache
 * that is still perfectly valid, silently and on every restart. That is a
 * Server-side bug whose only symptom is remote.
 *
 * The archive is plain JSON: a version and a map of category NodeId to
 * VersionTime. There is nothing secret in it, so unlike the RoleSet archive it
 * is not encrypted — it is a handful of integers describing when things last
 * changed. Writes are atomic (temp file + rename) so a crash cannot leave a
 * half-written archive, which would be worse than no archive at all.
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";

/** Bumped when the on-disk shape changes incompatibly. */
export const ALIAS_NAME_ARCHIVE_VERSION = 1;

/** The persisted form of a Server's `LastChange` state. */
export interface AliasNameArchive {
    version: number;
    /** Category NodeId (as a string) to VersionTime (UInt32 seconds since 2000-01-01Z). */
    lastChange: Record<string, number>;
}

/**
 * Read an archive, or return `null` when there is none.
 *
 * A missing file is normal — the first start. A corrupt or
 * future-versioned file is **not** silently ignored: continuing with a zeroed
 * `LastChange` is exactly the cache-clearing bug persistence exists to prevent,
 * so the caller is told rather than left to discover it from a Client.
 */
export async function readAliasNameArchive(path: string): Promise<AliasNameArchive | null> {
    let raw: string;
    try {
        raw = await fs.readFile(path, "utf-8");
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
        }
        throw err;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(
            `readAliasNameArchive: ${path} is not valid JSON. Delete it to start fresh, but note that a Client that has cached AliasNames will be told to clear its cache.`
        );
    }

    const archive = parsed as Partial<AliasNameArchive>;
    if (archive.version !== ALIAS_NAME_ARCHIVE_VERSION) {
        throw new Error(
            `readAliasNameArchive: ${path} has version ${String(archive.version)}, expected ${ALIAS_NAME_ARCHIVE_VERSION}`
        );
    }
    return { version: archive.version, lastChange: archive.lastChange ?? {} };
}

/**
 * Write an archive atomically.
 *
 * Temp file plus rename, so a crash mid-write leaves either the previous
 * archive or the new one, never a truncated file that would fail to parse on
 * the next start.
 */
export async function writeAliasNameArchive(path: string, archive: AliasNameArchive): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(archive, null, 2), "utf-8");
    await fs.rename(temporaryPath, path);
}
