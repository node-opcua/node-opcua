/**
 * @module node-opcua-role-set-common
 *
 * Pluggable password hashing (OPC 10000-18 §5 credentials).
 *
 * Each stored credential is a single self-describing **PHC / modular-crypt
 * string** so multiple schemes can coexist and be told apart by prefix:
 *
 * ```
 * scrypt:  $scrypt$ln=<log2N>,r=<r>,p=<p>$<b64 salt>$<b64 hash>
 * bcrypt:  $2b$<cost>$<22-char salt><31-char hash>       (bcrypt's native format)
 * ```
 *
 * A {@link HasherRegistry} verifies a credential by routing on its prefix and
 * always *hashes* new credentials with the configured default (scrypt — Node
 * core, zero extra dependency). Because non-default schemes report
 * {@link PasswordHasher.needsRehash}=true, a store can transparently migrate a
 * legacy credential to the default algorithm on the next successful login
 * ("upgrade-on-login"). Additional schemes (bcrypt today, LDAP/argon2 later)
 * are just more {@link PasswordHasher}s in the registry.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/** A single password-hashing scheme. All operations are async (LDAP/argon2-ready). */
export interface PasswordHasher {
    /** Canonical scheme id, e.g. `"scrypt"`, `"bcrypt"`. */
    readonly id: string;
    /** PHC prefixes this hasher verifies, e.g. `["$scrypt$"]` or `["$2a$", "$2b$", "$2y$"]`. */
    readonly prefixes: readonly string[];
    /** Hash a clear-text password into a full PHC string. */
    hash(password: string): Promise<string>;
    /** Verify a clear-text password against a PHC string produced by this scheme. */
    verify(password: string, phc: string): Promise<boolean>;
    /** True when a credential should be re-hashed after a successful login (e.g. cost drifted). */
    needsRehash?(phc: string): boolean;
}

// ---------------------------------------------------------------------------
// scrypt (default — Node core, no extra dependency)
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384; // ln = 14
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_LN = Math.log2(SCRYPT_N);

interface ParsedScrypt {
    ln: number;
    r: number;
    p: number;
    salt: Buffer;
    hash: Buffer;
}

/** Build the canonical scrypt PHC string from a base64 salt + hash. */
export function scryptPhc(saltB64: string, hashB64: string, params?: { ln?: number; r?: number; p?: number }): string {
    const ln = params?.ln ?? SCRYPT_LN;
    const r = params?.r ?? SCRYPT_R;
    const p = params?.p ?? SCRYPT_P;
    return `$scrypt$ln=${ln},r=${r},p=${p}$${saltB64}$${hashB64}`;
}

function parseScrypt(phc: string): ParsedScrypt | null {
    // $scrypt$ln=14,r=8,p=1$<salt>$<hash>
    const m = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(phc);
    if (!m) return null;
    return {
        ln: Number(m[1]),
        r: Number(m[2]),
        p: Number(m[3]),
        salt: Buffer.from(m[4], "base64"),
        hash: Buffer.from(m[5], "base64")
    };
}

export class ScryptHasher implements PasswordHasher {
    public readonly id = "scrypt";
    public readonly prefixes = ["$scrypt$"] as const;

    public async hash(password: string): Promise<string> {
        const salt = randomBytes(SCRYPT_SALT_BYTES);
        const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
        return scryptPhc(salt.toString("base64"), hash.toString("base64"));
    }

    public async verify(password: string, phc: string): Promise<boolean> {
        const parsed = parseScrypt(phc);
        if (!parsed) return false;
        const candidate = scryptSync(password, parsed.salt, parsed.hash.length, {
            N: 2 ** parsed.ln,
            r: parsed.r,
            p: parsed.p
        });
        return candidate.length === parsed.hash.length && timingSafeEqual(candidate, parsed.hash);
    }

    public needsRehash(phc: string): boolean {
        const parsed = parseScrypt(phc);
        // Re-hash if unparsable or the work factors drifted below the current defaults.
        return !parsed || parsed.ln !== SCRYPT_LN || parsed.r !== SCRYPT_R || parsed.p !== SCRYPT_P;
    }
}

// ---------------------------------------------------------------------------
// bcrypt (verify-only default: migrated to scrypt on next login)
// ---------------------------------------------------------------------------

export class BcryptHasher implements PasswordHasher {
    public readonly id = "bcrypt";
    public readonly prefixes = ["$2a$", "$2b$", "$2y$"] as const;

    public constructor(private readonly _cost = 10) {}

    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this._cost);
    }

    public async verify(password: string, phc: string): Promise<boolean> {
        return bcrypt.compare(password, phc);
    }

    // bcrypt is only kept for interop/migration — always upgrade to the default.
    public needsRehash(): boolean {
        return true;
    }
}

// ---------------------------------------------------------------------------
// Registry — hash with the default, verify by routing on the PHC prefix
// ---------------------------------------------------------------------------

export class HasherRegistry {
    private readonly _all: PasswordHasher[];

    public constructor(
        private readonly _default: PasswordHasher,
        others: readonly PasswordHasher[] = []
    ) {
        this._all = [_default, ...others];
    }

    public get defaultId(): string {
        return this._default.id;
    }

    /** Hash a new/changed password with the configured default scheme. */
    public hash(password: string): Promise<string> {
        return this._default.hash(password);
    }

    /** Verify against whichever registered scheme owns the credential's prefix. */
    public async verify(password: string, phc: string): Promise<boolean> {
        const hasher = this._find(phc);
        return hasher ? hasher.verify(password, phc) : false;
    }

    /**
     * True when the credential should be re-hashed with the default after a
     * successful login: a different scheme than the default, or the same scheme
     * reporting drifted parameters.
     */
    public needsRehash(phc: string): boolean {
        const hasher = this._find(phc);
        if (!hasher) return false;
        if (hasher !== this._default) return true;
        return hasher.needsRehash ? hasher.needsRehash(phc) : false;
    }

    private _find(phc: string): PasswordHasher | undefined {
        return this._all.find((h) => h.prefixes.some((prefix) => phc.startsWith(prefix)));
    }
}

/**
 * Default registry: **scrypt** hashes and verifies (Node core), **bcrypt**
 * verifies legacy credentials and is upgraded to scrypt on next login.
 */
export function defaultHasherRegistry(): HasherRegistry {
    return new HasherRegistry(new ScryptHasher(), [new BcryptHasher()]);
}
