import fs from "node:fs";
import path from "node:path";
import { BinaryStream } from "node-opcua-binary-stream";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { readCertificateChainAsync, readCertificateRevocationList } from "node-opcua-crypto";
import { make_errorLog } from "node-opcua-debug";
import type { AbstractFs } from "node-opcua-file-transfer";
import { TrustListDataType } from "node-opcua-types";

const errorLog = make_errorLog("TrustListServer");

/**
 * Read all certificate (chains) and CRLs in a folder
 * @param folder
 * @returns
 */
async function readAll(folder: string): Promise<Buffer[]> {
    const results: Buffer[] = [];
    const files = await fs.promises.readdir(folder);
    for (const f of files) {
        const file = path.join(folder, f);
        const ext = path.extname(file);
        if (ext === ".der" || ext === ".pem") {
            const chain = await readCertificateChainAsync(file);
            const concatenated = Buffer.concat(chain);
            results.push(concatenated);
        } else if (ext === ".crl") {
            // Strict validation: only accept valid CRL files
            const buf = await readCertificateRevocationList(file);
            results.push(buf);
        } else {
            errorLog(" unknown extension on file ", f);
        }
    }
    return results;
}

export enum TrustListMasks {
    None = 0,
    TrustedCertificates = 1,
    TrustedCrls = 2,
    IssuerCertificates = 4,
    IssuerCrls = 8,
    All = 15
}

export async function buildTrustList(
    certificateManager: OPCUACertificateManager,
    trustListFlag: TrustListMasks
): Promise<TrustListDataType> {
    const trustList = new TrustListDataType({
        specifiedLists: trustListFlag,
        issuerCertificates: undefined,
        issuerCrls: undefined,
        trustedCertificates: undefined,
        trustedCrls: undefined
    });
    if ((trustListFlag & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates) {
        trustList.trustedCertificates = await readAll(certificateManager.trustedFolder);
    }
    if ((trustListFlag & TrustListMasks.TrustedCrls) === TrustListMasks.TrustedCrls) {
        const crlFolder = certificateManager.crlFolder;
        if (fs.existsSync(crlFolder)) {
            trustList.trustedCrls = await readAll(crlFolder);
        } else {
            trustList.trustedCrls = [];
        }
    }
    if ((trustListFlag & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates) {
        const issuersCertFolder = certificateManager.issuersCertFolder;
        if (fs.existsSync(issuersCertFolder)) {
            trustList.issuerCertificates = await readAll(issuersCertFolder);
        } else {
            trustList.issuerCertificates = [];
        }
    }
    if ((trustListFlag & TrustListMasks.IssuerCrls) === TrustListMasks.IssuerCrls) {
        const issuersCrlFolder = certificateManager.issuersCrlFolder;
        if (fs.existsSync(issuersCrlFolder)) {
            trustList.issuerCrls = await readAll(issuersCrlFolder);
        } else {
            trustList.issuerCrls = [];
        }
    }
    return trustList;
}

export async function writeTrustList(
    fs: AbstractFs,
    filename: string,
    trustListFlag: TrustListMasks,

    certificateManager: OPCUACertificateManager
): Promise<void> {
    const trustList = await buildTrustList(certificateManager, trustListFlag);
    const stream = new BinaryStream(trustList.binaryStoreSize());
    trustList.encode(stream);
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, stream.buffer, "binary", (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}
