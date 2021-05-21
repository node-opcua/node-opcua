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
        }
        if (ext === ".clr") {
            const buf = await readCertificateRevocationList(file);
            results.push(buf);
        }
    }
    return results;
}

async function buildTrustList(certificateManager: OPCUACertificateManager): Promise<TrustListDataType> {
    const trustList = new TrustListDataType({
        issuerCertificates: [],
        issuerCrls: [],
        specifiedLists: 15,
        trustedCertificates: [],
        trustedCrls: [],
    });
    trustList.trustedCertificates = await readAll(certificateManager.trustedFolder);
    trustList.trustedCrls = await readAll(certificateManager.crlFolder);
    trustList.issuerCertificates = await readAll(certificateManager.issuersCertFolder);
    trustList.issuerCrls = await readAll(certificateManager.issuersCrlFolder);
    return trustList;
}

export async function writeTrustList(fs: AbstractFs, filename: string, certificateManager: OPCUACertificateManager): Promise<void> {
    const trustList = await buildTrustList(certificateManager);
    const stream = new BinaryStream(trustList.binaryStoreSize());
    trustList.encode(stream);
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, stream.buffer, "binary", (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}