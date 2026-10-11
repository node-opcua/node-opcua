import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import should from "should";
import "mocha";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { buildTrustList, TrustListMasks } from "../dist/index.js";

/**
 * The certificate manager moves certificate files between its folders at any
 * time: a client trusted on first contact, a certificate rejected, a
 * provisional trust withdrawn when Application Setup ends. buildTrustList
 * lists a folder, then reads each file. A file that vanished in between used
 * to make the whole read fail with
 *
 *   ENOENT: no such file or directory, open '.../trusted/certs/<name>.pem'
 *
 * and TrustList Open answered Bad_InternalError. The race is replayed
 * deterministically: readdir reports files that are not there.
 */
describe("TrustList: a file listed but gone before it is read", () => {
    let folder: string;
    let originalReaddir: typeof fs.promises.readdir;

    before(() => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), "trust-list-vanished-"));
        originalReaddir = fs.promises.readdir;
        (fs.promises as { readdir: unknown }).readdir = async (dir: fs.PathLike, ...rest: unknown[]) => {
            const listed = (await (originalReaddir as (...a: unknown[]) => Promise<string[]>)(dir, ...rest)) as string[];
            return dir.toString() === folder ? [...listed, "vanished.pem", "vanished.der", "vanished.crl"] : listed;
        };
    });

    after(() => {
        (fs.promises as { readdir: unknown }).readdir = originalReaddir;
        fs.rmSync(folder, { recursive: true, force: true });
    });

    it("skips the vanished certificate and CRL files instead of failing", async () => {
        const certificateManager = {
            trustedFolder: folder,
            crlFolder: folder,
            issuersCertFolder: folder,
            issuersCrlFolder: folder
        } as unknown as OPCUACertificateManager;

        const trustList = await buildTrustList(certificateManager, TrustListMasks.All);

        should(trustList.trustedCertificates).eql([]);
        should(trustList.trustedCrls).eql([]);
        should(trustList.issuerCertificates).eql([]);
        should(trustList.issuerCrls).eql([]);
    });
});
