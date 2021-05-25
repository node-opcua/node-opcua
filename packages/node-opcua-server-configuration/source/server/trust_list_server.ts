import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { TrustListDataType } from "node-opcua-types";

import *as fs from "fs";
import * as path from "path";
import { AbstractFs } from "node-opcua-file-transfer";
import { BinaryStream } from "node-opcua-binary-stream";
import { readCertificate, readCertificateRevocationList } from "node-opcua-crypto";

async function readAll(folder: string): Promise<Buffer[]> {

    const results: Buffer[] = [];
    const files = await fs.promises.readdir(folder);
    for (const f of files) {
        const file = path.join(folder, f);
        const ext = path.extname(file);
        if (ext === ".der" || ext === ".pem") {
            const buf = await readCertificate(file);
            results.push(buf);
        } else if (ext === ".crl") {
            const buf = await readCertificateRevocationList(file);
            results.push(buf);
        } else {
            console.log(" unknown extesnion on file ", f);
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
    All = 15,
};

export async function buildTrustList(
    certificateManager: OPCUACertificateManager,
    trustListFlag: TrustListMasks
): Promise<TrustListDataType> {
    const trustList = new TrustListDataType({
        specifiedLists: trustListFlag,
        issuerCertificates: undefined,
        issuerCrls: undefined,
        trustedCertificates: undefined,
        trustedCrls: undefined,
    });
    if ((trustListFlag & TrustListMasks.TrustedCertificates) === TrustListMasks.TrustedCertificates) {
        trustList.trustedCertificates = await readAll(certificateManager.trustedFolder);
    }
    if ((trustListFlag & TrustListMasks.TrustedCrls) === TrustListMasks.TrustedCrls) {
        trustList.trustedCrls = await readAll(certificateManager.crlFolder);
    }
    if ((trustListFlag & TrustListMasks.IssuerCertificates) === TrustListMasks.IssuerCertificates) {
        trustList.issuerCertificates = await readAll(certificateManager.issuersCertFolder);
    }
    if ((trustListFlag & TrustListMasks.IssuerCrls) === TrustListMasks.IssuerCrls) {
        trustList.issuerCrls = await readAll(certificateManager.issuersCrlFolder);
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