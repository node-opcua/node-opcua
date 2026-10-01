/**
 * @module node-opcua-server-configuration
 *
 * Clients trusted automatically in the application setup state.
 *
 * While a server reports `ServerState.NoConfiguration` (the application setup
 * state of OPC 10000-12 §G.2), push certificate management admits any client
 * and trusts its certificate, so that a CertificateManager can reach the
 * server for the first time. Anyone else who connects in that window is
 * trusted the same way. This module remembers which certificates were
 * trusted that way (leaves in the trusted list, and the issuers that came
 * with them), so that they can be withdrawn when the server leaves the setup
 * state, unless a TrustList written since then kept them.
 *
 * The record is kept next to the PKI store, so a restart in the middle of the
 * setup does not turn provisional trust into permanent trust.
 */
import fs from "node:fs";
import path from "node:path";
import type { CertificateManager } from "node-opcua-certificate-manager";
import { makeSHA1Thumbprint, readCertificateChainAsync } from "node-opcua-crypto";
import { make_errorLog, make_warningLog } from "node-opcua-debug";

const warningLog = make_warningLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");

const RECORD_FILE = "provisional_trust.json";

/** Which list of the TrustList a provisionally trusted certificate sits in. */
export type ProvisionalList = "trusted" | "issuers";

const records = new WeakMap<CertificateManager, Set<string>>();

const key = (list: ProvisionalList, thumbprint: string) => `${list}:${thumbprint}`;

function recordFile(cm: CertificateManager): string {
    return path.join(cm.rootDir, RECORD_FILE);
}

function load(cm: CertificateManager): Set<string> {
    let record = records.get(cm);
    if (record) return record;
    record = new Set<string>();
    const file = recordFile(cm);
    try {
        if (fs.existsSync(file)) {
            for (const entry of JSON.parse(fs.readFileSync(file, "utf8")) as string[]) {
                record.add(entry);
            }
        }
    } catch (err) {
        // The record is written atomically (see save), so this is not a torn
        // write: someone edited or damaged it. Nothing here can tell which
        // trusted certificates were provisional any more; say so loudly.
        errorLog(
            `[ApplicationSetup] cannot read ${file}: certificates trusted automatically during the setup will not be withdrawn.`,
            (err as Error).message
        );
    }
    records.set(cm, record);
    return record;
}

async function save(cm: CertificateManager, record: Set<string>): Promise<void> {
    const file = recordFile(cm);
    if (record.size === 0) {
        await fs.promises.rm(file, { force: true });
        return;
    }
    // Write-then-rename: a crash mid-write must not leave a record that
    // cannot be read, which would make provisional trust permanent.
    const tmp = `${file}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify([...record], null, 1), "utf8");
    await fs.promises.rename(tmp, file);
}

/** The certificate identified by `thumbprint` was put in `list` only because the server is in the setup state. */
export async function recordProvisionalTrust(cm: CertificateManager, list: ProvisionalList, thumbprint: string): Promise<void> {
    const record = load(cm);
    const entry = key(list, thumbprint);
    if (record.has(entry)) return;
    record.add(entry);
    await save(cm, record);
}

/** A TrustList write put these certificates in `list`: they are no longer provisional. */
export async function confirmTrust(cm: CertificateManager, list: ProvisionalList, thumbprints: string[]): Promise<void> {
    const record = load(cm);
    let changed = false;
    for (const thumbprint of thumbprints) {
        changed = record.delete(key(list, thumbprint)) || changed;
    }
    if (changed) {
        await save(cm, record);
    }
}

/**
 * Thumbprints (lowercase hex SHA-1, as the PKI store keys them) of the leaf
 * certificate of each certificate file in a PKI folder. A file that cannot be
 * parsed is skipped with a warning rather than failing the caller.
 */
export async function leafThumbprintsIn(folder: string): Promise<string[]> {
    return (await leafCertificatesIn(folder)).map((entry) => entry.thumbprint);
}

/** The leaf certificate of each certificate file in a PKI folder, with its thumbprint, skipping what does not parse. */
export async function leafCertificatesIn(folder: string): Promise<{ thumbprint: string; certificate: Buffer }[]> {
    if (!fs.existsSync(folder)) return [];
    const entries: { thumbprint: string; certificate: Buffer }[] = [];
    for (const file of await fs.promises.readdir(folder)) {
        const ext = path.extname(file);
        if (ext !== ".der" && ext !== ".pem") continue;
        try {
            const chain = await readCertificateChainAsync(path.join(folder, file));
            if (chain.length > 0) entries.push({ thumbprint: makeSHA1Thumbprint(chain[0]).toString("hex"), certificate: chain[0] });
        } catch (err) {
            warningLog(`[TrustList] skipping ${path.join(folder, file)}: not a certificate`, (err as Error).message);
        }
    }
    return entries;
}

/** Whether the trusted list holds at least one certificate that was not trusted provisionally. */
export async function hasConfirmedTrust(cm: CertificateManager): Promise<boolean> {
    const record = load(cm);
    return (await leafThumbprintsIn(cm.trustedFolder)).some((thumbprint) => !record.has(key("trusted", thumbprint)));
}

/**
 * Remove every provisionally trusted certificate from the TrustList. An
 * issuer that a remaining trusted certificate still needs is kept. Returns
 * the number of certificates removed.
 */
export async function withdrawProvisionalTrust(cm: CertificateManager): Promise<number> {
    const record = load(cm);
    let withdrawn = 0;
    const entries = [...record];
    for (const entry of entries.filter((e) => e.startsWith("trusted:"))) {
        if (await cm.removeTrustedCertificate(entry.slice("trusted:".length))) withdrawn++;
    }
    for (const entry of entries.filter((e) => e.startsWith("issuers:"))) {
        const issuer = await cm.removeIssuer(entry.slice("issuers:".length));
        if (!issuer) continue;
        if (await cm.isIssuerInUseByTrustedCertificate(issuer)) {
            await cm.addIssuer(issuer);
        } else {
            withdrawn++;
        }
    }
    record.clear();
    await save(cm, record);
    return withdrawn;
}

// ── TrustList stores shared between CertificateGroups ─────────────

const sharedStores = new WeakSet<CertificateManager>();

/**
 * `a` and `b` back two CertificateGroups with one PKI store. A TrustList
 * write to either group then cannot replace its list without also removing
 * the other group's certificates (see applyTrustListChanges).
 */
export function markSharedTrustListStore(a: CertificateManager, b: CertificateManager): void {
    if (a === b || path.resolve(a.rootDir) === path.resolve(b.rootDir)) {
        sharedStores.add(a);
        sharedStores.add(b);
    }
}

export function isSharedTrustListStore(cm: CertificateManager): boolean {
    return sharedStores.has(cm);
}
