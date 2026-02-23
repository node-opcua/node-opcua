import fs from "node:fs";
import path from "node:path";
import type { CertificateManager } from "node-opcua-certificate-manager";
import { convertPEMtoDER } from "node-opcua-crypto";
import { StatusCodes } from "node-opcua-status-code";
import type { GetRejectedListResult } from "../../push_certificate_manager";
import type { PushCertificateManagerInternalContext } from "./internal_context";

interface FileData {
    filename: string;
    stat: {
        mtime: Date;
    };
}

async function extractRejectedList(group: CertificateManager | undefined, certificateList: FileData[]): Promise<void> {
    if (!group) {
        return;
    }
    const rejectedFolder = path.join(group.rootDir, "rejected");
    try {
        const files = await fs.promises.readdir(rejectedFolder);

        const promises: Promise<fs.Stats>[] = [];
        for (const certFile of files) {
            promises.push(fs.promises.stat(path.join(rejectedFolder, certFile)));
        }
        const stats = await Promise.all(promises);

        for (let i = 0; i < stats.length; i++) {
            certificateList.push({
                filename: path.join(rejectedFolder, files[i]),
                stat: stats[i]
            });
        }
    } catch (_err) {
        // Directory might not exist yet, ignore
    }
}

export async function executeGetRejectedList(serverImpl: PushCertificateManagerInternalContext): Promise<GetRejectedListResult> {
    const list: FileData[] = [];

    await extractRejectedList(serverImpl.applicationGroup, list);
    await extractRejectedList(serverImpl.userTokenGroup, list);
    await extractRejectedList(serverImpl.httpsGroup, list);

    // sort list from newer file to older file
    list.sort((a: FileData, b: FileData) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    const promises: Promise<string>[] = [];
    for (const item of list) {
        promises.push(fs.promises.readFile(item.filename, "utf8"));
    }
    const certificatesPEM: string[] = await Promise.all(promises);

    const certificates: Buffer[] = certificatesPEM.map(convertPEMtoDER);

    return {
        certificates,
        statusCode: StatusCodes.Good
    };
}
