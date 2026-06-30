/**
 * @module node-opcua-role-set-common
 *
 * Consolidated, single-file persistence archive for the whole RoleSet
 * configuration (identity mappings, custom Role definitions, application/
 * endpoint restrictions — and, in the future, the UserManagement store).
 *
 * The archive is JSON so most of it stays human-readable and diffable, while
 * the identity mappings — which are OPC UA `ExtensionObject`s with a canonical
 * binary encoding — are embedded as a base64 blob (reusing the proven binary
 * encoder instead of re-inventing a lossy JSON form).
 *
 * Writes are **atomic** (temp file + rename) so a crash can never leave a
 * half-written archive. When an operator-supplied `secret` is given the whole
 * payload is encrypted at rest with AES-256-GCM (key derived via scrypt); the
 * envelope is itself JSON with base64 fields. Without a secret the archive is
 * plain JSON — relying on filesystem permissions / OS-level encryption, which
 * is the appropriate baseline for config that already stores only salted,
 * one-way password hashes.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { BinaryStream } from "node-opcua-binary-stream";
import { decodeIdentityStore, encodeIdentityStore, identityStoreBinaryStoreSize } from "./binary_persistence.js";
import type { IIdentityMappingStore } from "./identity_mapping_store.js";
import type { SerializedRoleRestriction } from "./role_restriction_store.js";
import type { SerializedUserRecord } from "./user_management_store.js";

export const ROLE_SET_ARCHIVE_VERSION = 1;

/** Persisted definition of a custom Role (so its GUID NodeId survives a restart). */
export interface PersistedCustomRole {
    nodeId: string;
    roleName: string;
    namespaceUri?: string;
}

/** The whole RoleSet configuration, ready to be serialized to one file. */
export interface RoleSetArchive {
    version: number;
    /** base64 of the OPC UA binary identity-mapping store. */
    identities?: string;
    roles?: PersistedCustomRole[];
    restrictions?: SerializedRoleRestriction[];
    /** UserManagement users with salted scrypt hashes (never clear passwords). */
    users?: SerializedUserRecord[];
}

/** Encode the identity store as a base64 string (reuses the binary encoder). */
export function identitiesToBase64(store: IIdentityMappingStore): string {
    const size = identityStoreBinaryStoreSize(store);
    const stream = new BinaryStream(Buffer.alloc(size));
    encodeIdentityStore(store, stream);
    return (stream.buffer as Buffer).subarray(0, stream.length).toString("base64");
}

/** Decode a base64 identity blob back into the store (merges; empty → no-op). */
export function identitiesFromBase64(store: IIdentityMappingStore, base64: string | undefined): void {
    if (!base64) return;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) return;
    decodeIdentityStore(store, new BinaryStream(buffer));
}

/** Encryption envelope written in place of the plain archive when a secret is set. */
interface EncryptedEnvelope {
    version: number;
    encrypted: true;
    kdf: "scrypt";
    salt: string; // base64
    iv: string; // base64
    tag: string; // base64 GCM auth tag
    data: string; // base64 ciphertext of the JSON archive
}

function encrypt(plaintext: string, secret: string): EncryptedEnvelope {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(secret, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
        version: ROLE_SET_ARCHIVE_VERSION,
        encrypted: true,
        kdf: "scrypt",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: enc.toString("base64")
    };
}

function decrypt(env: EncryptedEnvelope, secret: string): string {
    const key = scryptSync(secret, Buffer.from(env.salt, "base64"), 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
    decipher.setAuthTag(Buffer.from(env.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(env.data, "base64")), decipher.final()]).toString("utf8");
}

export interface ArchiveIO {
    /** When set, the archive is encrypted at rest (AES-256-GCM, key derived from this secret via scrypt). */
    secret?: string;
}

/** Atomically write the archive (optionally encrypted) to `filePath`. */
export async function writeArchive(filePath: string, archive: RoleSetArchive, io?: ArchiveIO): Promise<void> {
    const json = JSON.stringify(archive, null, 2);
    const payload = io?.secret ? JSON.stringify(encrypt(json, io.secret), null, 2) : json;
    await fs.mkdir(dirname(filePath), { recursive: true });
    // write to a temp file then rename — rename is atomic and replaces the target
    // (libuv sets MOVEFILE_REPLACE_EXISTING on Windows), so readers never see a
    // partially written archive.
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, filePath);
}

/** Read the archive (decrypting if needed). Missing/empty file → undefined. */
export async function readArchive(filePath: string, io?: ArchiveIO): Promise<RoleSetArchive | undefined> {
    let text: string;
    try {
        text = await fs.readFile(filePath, "utf8");
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw err;
    }
    if (!text.trim()) return undefined;

    let parsed: RoleSetArchive | EncryptedEnvelope;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        throw new Error(`readArchive: '${filePath}' is not a valid archive (JSON parse failed): ${(err as Error).message}`);
    }

    if ((parsed as EncryptedEnvelope).encrypted) {
        if (!io?.secret) {
            throw new Error(`readArchive: '${filePath}' is encrypted but no secret was provided`);
        }
        try {
            parsed = JSON.parse(decrypt(parsed as EncryptedEnvelope, io.secret)) as RoleSetArchive;
        } catch (err) {
            throw new Error(`readArchive: cannot decrypt '${filePath}' (wrong secret or corrupt): ${(err as Error).message}`);
        }
    }

    const result = parsed as RoleSetArchive;
    // Future-proofing: refuse an archive written by a newer, incompatible format
    // rather than silently dropping the fields we don't understand. Older minor
    // versions are forward-compatible (unknown fields are simply ignored).
    if (typeof result.version !== "number") {
        throw new Error(`readArchive: '${filePath}' has no version field — not a RoleSet archive`);
    }
    if (result.version > ROLE_SET_ARCHIVE_VERSION) {
        throw new Error(
            `readArchive: '${filePath}' was written by a newer archive format (version ${result.version} > ${ROLE_SET_ARCHIVE_VERSION}); upgrade node-opcua to read it`
        );
    }
    return result;
}

/** A snapshot provider for one archive section (returns the current state, or undefined to omit). */
type SectionProvider<T> = () => T | undefined;

/**
 * Coordinates a single consolidated archive shared by several stores.
 *
 * `installRoleSet` and `installUserManagement` each register the section(s) they
 * own (identities/roles/restrictions vs. users) and call {@link save} after a
 * mutation; the coordinator gathers **all** registered sections and rewrites the
 * one file atomically — so neither installer clobbers the other's data. Pass the
 * same `ArchiveStore` instance to both to keep everything in one file.
 *
 * A section with **no** registered provider is not dropped: its last loaded value
 * is preserved on save. This makes the result independent of install order — even
 * a mutation between the two installs cannot lose the not-yet-registered sections.
 */
export class ArchiveStore {
    private readonly _io: ArchiveIO;
    private _identities?: SectionProvider<string>;
    private _roles?: SectionProvider<PersistedCustomRole[]>;
    private _restrictions?: SectionProvider<SerializedRoleRestriction[]>;
    private _users?: SectionProvider<SerializedUserRecord[]>;
    /** Last archive read from disk — used to preserve sections that have no provider yet. */
    private _loaded?: RoleSetArchive;

    constructor(
        public readonly filePath: string,
        io?: ArchiveIO
    ) {
        this._io = io ?? {};
    }

    public setIdentitiesProvider(fn: SectionProvider<string>): void {
        this._identities = fn;
    }
    public setRolesProvider(fn: SectionProvider<PersistedCustomRole[]>): void {
        this._roles = fn;
    }
    public setRestrictionsProvider(fn: SectionProvider<SerializedRoleRestriction[]>): void {
        this._restrictions = fn;
    }
    public setUsersProvider(fn: SectionProvider<SerializedUserRecord[]>): void {
        this._users = fn;
    }

    /** Read the persisted archive (missing file → undefined) and remember it for {@link save}. */
    public async load(): Promise<RoleSetArchive | undefined> {
        this._loaded = await readArchive(this.filePath, this._io);
        return this._loaded;
    }

    /**
     * Atomically rewrite the archive. A registered provider is authoritative for
     * its section; a section with no provider falls back to the last loaded value
     * so it is never clobbered (install-order independence).
     */
    public async save(): Promise<void> {
        const archive: RoleSetArchive = {
            version: ROLE_SET_ARCHIVE_VERSION,
            identities: this._identities ? this._identities() : this._loaded?.identities,
            roles: this._roles ? this._roles() : this._loaded?.roles,
            restrictions: this._restrictions ? this._restrictions() : this._loaded?.restrictions,
            users: this._users ? this._users() : this._loaded?.users
        };
        await writeArchive(this.filePath, archive, this._io);
        // keep the fallback snapshot in sync with what is now on disk
        this._loaded = archive;
    }
}
