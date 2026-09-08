/**
 * FEAT-40: a certificate check must answer even when the store's file lock is
 * unavailable.
 *
 * node-opcua-pki serialises every store update on `<rootFolder>/mutex.lock`.
 * The global-mutex node-opcua ships today takes it by creating a directory of
 * that name; the one node-opcua shipped before 2.181 created a plain file and
 * left it behind when the process died holding it. The current library never
 * recognises that file as garbage - it waits until the file looks two minutes
 * old (native provider) or retries an `rmdir` that fails with ENOTDIR for
 * hours (proper-lockfile provider) - so on such a store the first
 * rejectCertificate never answers and every OpenSecureChannel that waits on it
 * times out. Seen on the certification server's store on Windows, CTT 1.05.513:
 * Security Certificate Validation 005/009/033/045/046 reported BadTimeout.
 */
import fs from "node:fs";
import path from "node:path";
import "mocha";
import { readCertificate } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { CertificateManager } from "node-opcua-pki";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { OPCUACertificateManager, removeLegacyLockFile } from "../source/index.js";
import { scratch } from "./paths.js";

const tmpFolder = scratch("temp", "store_lock");

/** a self-signed certificate of its own, written under `folder` */
async function makeCertificate(folder: string, name: string): Promise<Buffer> {
    const pki = new CertificateManager({ keySize: 2048, location: path.join(folder, `${name}-pki`) });
    await pki.initialize();
    const certificateFile = path.join(folder, `${name}.pem`);
    await pki.createSelfSignedCertificate({
        applicationUri: `urn:${name}`,
        dns: [],
        ip: [],
        validity: 100,
        subject: `/CN=${name}`,
        startDate: new Date(),
        outputFile: certificateFile
    });
    await pki.dispose();
    return readCertificate(certificateFile);
}

/**
 * A store that has seen some use: a few trusted certificates, and the lock
 * file an older node-opcua left behind. The file's mtime is now, as it is
 * after a copy of the store, or after the older process touched it.
 */
async function populateStore(rootFolder: string, certificates: Buffer[]): Promise<void> {
    const manager = new OPCUACertificateManager({ rootFolder, automaticallyAcceptUnknownCertificate: false });
    await manager.initialize();
    for (const certificate of certificates) {
        await manager.trustCertificate(certificate);
    }
    await manager.dispose();
    fs.writeFileSync(path.join(rootFolder, "mutex.lock"), "");
}

describe("OPCUACertificateManager and the store lock (FEAT-40)", function (this: Mocha.Suite) {
    this.timeout(60_000);

    let trusted: Buffer[];
    let unknown: Buffer;

    before(async () => {
        fs.rmSync(tmpFolder, { recursive: true, force: true });
        fs.mkdirSync(tmpFolder, { recursive: true });
        trusted = [];
        for (let i = 0; i < 3; i++) {
            trusted.push(await makeCertificate(tmpFolder, `trusted${i}`));
        }
        unknown = await makeCertificate(tmpFolder, "unknown");
    });

    it("SL01 - removeLegacyLockFile removes a plain mutex.lock file and leaves a lock directory alone", () => {
        const folder = path.join(tmpFolder, "sl01");
        fs.mkdirSync(folder, { recursive: true });
        removeLegacyLockFile(folder).should.eql(false, "nothing to remove");

        fs.writeFileSync(path.join(folder, "mutex.lock"), "");
        removeLegacyLockFile(folder).should.eql(true);
        fs.existsSync(path.join(folder, "mutex.lock")).should.eql(false);

        fs.mkdirSync(path.join(folder, "mutex.lock"));
        removeLegacyLockFile(folder).should.eql(false, "a directory is a live lock");
        fs.existsSync(path.join(folder, "mutex.lock")).should.eql(true);
    });

    it("SL02 - checkCertificate answers at once on a populated store that carries a legacy lock file", async () => {
        const rootFolder = path.join(tmpFolder, "sl02");
        await populateStore(rootFolder, trusted);
        fs.existsSync(path.join(rootFolder, "mutex.lock")).should.eql(true);

        const manager = new OPCUACertificateManager({ rootFolder, automaticallyAcceptUnknownCertificate: false });
        await manager.initialize();
        try {
            // without the fix this waits for the lock file to look two minutes old
            const started = Date.now();
            const status = await manager.checkCertificate(unknown);
            const elapsed = Date.now() - started;
            status.should.eql(StatusCodes.BadCertificateUntrusted);
            elapsed.should.be.lessThan(OPCUACertificateManager.bookkeepingTimeout, "answered before the bookkeeping bound");

            // and the verdict was recorded: the certificate is in rejected/
            fs.readdirSync(path.join(rootFolder, "rejected")).length.should.eql(1);
            (await manager.getTrustStatus(unknown)).should.eql(StatusCodes.BadCertificateUntrusted);
            // the trusted ones still are
            for (const certificate of trusted) {
                (await manager.checkCertificate(certificate)).should.eql(StatusCodes.Good);
            }
        } finally {
            await manager.dispose();
        }
    });

    it("SL03 - checkCertificate answers with the verdict it knows when the store update does not settle", async () => {
        const rootFolder = path.join(tmpFolder, "sl03");
        await populateStore(rootFolder, trusted);

        // a store whose updates never complete: the lock is held elsewhere for good
        class StuckStore extends OPCUACertificateManager {
            public rejectCalls = 0;
            public override rejectCertificate(certificate: Buffer): Promise<void>;
            public override rejectCertificate(certificate: Buffer, callback: (err?: Error | null) => void): void;
            public override rejectCertificate(_certificate: Buffer, callback?: (err?: Error | null) => void): Promise<void> | void {
                this.rejectCalls++;
                if (callback) {
                    return;
                }
                return new Promise<void>(() => {
                    /* never settles */
                });
            }
        }
        const manager = new StuckStore({ rootFolder, automaticallyAcceptUnknownCertificate: false });
        await manager.initialize();

        const bookkeepingTimeout = OPCUACertificateManager.bookkeepingTimeout;
        OPCUACertificateManager.bookkeepingTimeout = 300;
        try {
            const started = Date.now();
            const status = await manager.checkCertificate(unknown);
            const elapsed = Date.now() - started;
            status.should.eql(StatusCodes.BadCertificateUntrusted);
            manager.rejectCalls.should.eql(1);
            elapsed.should.be.within(250, 5000);
        } finally {
            OPCUACertificateManager.bookkeepingTimeout = bookkeepingTimeout;
            await manager.dispose();
        }
    });

    it("SL04 - a store update that fails still fails the check", async () => {
        const rootFolder = path.join(tmpFolder, "sl04");
        await populateStore(rootFolder, trusted);

        class FailingStore extends OPCUACertificateManager {
            public override rejectCertificate(certificate: Buffer): Promise<void>;
            public override rejectCertificate(certificate: Buffer, callback: (err?: Error | null) => void): void;
            public override rejectCertificate(_certificate: Buffer, callback?: (err?: Error | null) => void): Promise<void> | void {
                if (callback) {
                    return;
                }
                return Promise.reject(new Error("disk full"));
            }
        }
        const manager = new FailingStore({ rootFolder, automaticallyAcceptUnknownCertificate: false });
        await manager.initialize();
        try {
            await should(manager.checkCertificate(unknown)).be.rejectedWith(/disk full/);
        } finally {
            await manager.dispose();
        }
    });
});
