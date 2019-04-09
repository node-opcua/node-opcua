/**
 * @module node-opcua-server-configuration
 */
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import assert from "node-opcua-assert";
import { ByteString, StatusCodes } from "node-opcua-basic-types";
import { convertPEMtoDER, makeSHA1Thumbprint } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { CertificateManager } from "node-opcua-pki";
import { StatusCode } from "node-opcua-status-code";

import {
    CreateSigningRequestResult,
    GetRejectedListResult,
    PushCertificateManager,
    UpdateCertificateResult
} from "../push_certificate_manager";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

const defaultApplicationGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultApplicationGroup");
const defaultHttpsGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultHttpsGroup");
const defaultUserTokenGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultUserTokenGroup");

function findCertificateGroupName(certificateGroupNodeId: NodeId | string): string {

    if (typeof certificateGroupNodeId === "string") {
        return certificateGroupNodeId;
    }
    if (sameNodeId(certificateGroupNodeId, NodeId.nullNodeId) ||
      sameNodeId(certificateGroupNodeId, defaultApplicationGroup)) {
        return "DefaultApplicationGroup";
    }
    if (sameNodeId(certificateGroupNodeId, defaultHttpsGroup)) {
        return "DefaultHttpsGroup";
    }
    if (sameNodeId(certificateGroupNodeId, defaultUserTokenGroup)) {
        return "DefaultUserTokenGroup";
    }
    return "";
}

export interface PushCertificateManagerServerOptions {
    applicationGroup?: CertificateManager;
    userTokenGroup?: CertificateManager;
    httpsGroup?: CertificateManager;
}

export class PushCertificateManagerServerImpl implements PushCertificateManager {

    public applicationGroup?: CertificateManager;
    public userTokenGroup?: CertificateManager;
    public httpsGroup?: CertificateManager;

    private readonly _map: { [key: string]: CertificateManager } = {};

    constructor(options?: PushCertificateManagerServerOptions) {
        if (options) {
            this.applicationGroup = options.applicationGroup;
            this.userTokenGroup = options.userTokenGroup;
            this.httpsGroup = options.httpsGroup;
            if (this.userTokenGroup) {
                this._map.DefaultUserTokenGroup = this.userTokenGroup;
                assert(this.userTokenGroup instanceof CertificateManager);
            }
            if (this.applicationGroup) {
                this._map.DefaultApplicationGroup = this.applicationGroup;
                assert(this.applicationGroup instanceof CertificateManager);
            }
            if (this.httpsGroup) {
                this._map.DefaultHttpsGroup = this.httpsGroup;
                assert(this.httpsGroup instanceof CertificateManager);
            }
        }
    }

    public async initialize() {
        if (this.applicationGroup) {
            await this.applicationGroup.initialize();
        }
        if (this.userTokenGroup) {
            await this.userTokenGroup.initialize();
        }
        if (this.httpsGroup) {
            await this.httpsGroup.initialize();
        }
    }

    public get supportedPrivateKeyFormats(): string[] {
        return ["PEM"];
    }

    public async getSupportedPrivateKeyFormats(): Promise<string[]> {
        return this.supportedPrivateKeyFormats;
    }

    public async applyChanges(): Promise<StatusCode> {
        return StatusCodes.Good;
    }

    public async createSigningRequest(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      subjectName: string,
      regeneratePrivateKey?: boolean,
      nonce?: Buffer
    ): Promise<CreateSigningRequestResult> {

        const certificateManager = this.getCertificateManager(certificateGroupId);

        if (!certificateManager) {
            debugLog(" cannot find group ", certificateGroupId);
            return {
                statusCode: StatusCodes.BadInvalidArgument
            };
        }

        // todo : at this time regenerate PrivateKey is not supported
        if (regeneratePrivateKey) {
            debugLog(" regeneratePrivateKey = true not supported yet");
            return {
                statusCode: StatusCodes.BadInvalidArgument
            };
        }

        const options = {
            subject: subjectName
        };
        const csrfile = await certificateManager.createCertificateRequest(options);
        const csrPEM = await promisify(fs.readFile)(csrfile, "utf8");
        const certificateSigningRequest = convertPEMtoDER(csrPEM);
        return {
            certificateSigningRequest,
            statusCode: StatusCodes.Good
        };

    }

    public async getRejectedList(): Promise<GetRejectedListResult> {

        interface FileData {
            filename: string;
            stat: {
                mtime: Date
            };
        }

        // rejectedList comes from each group
        async function extractRejectedList(
          group: CertificateManager | undefined,
          list: FileData[]
        ): Promise<void> {
            if (!group) {
                return;
            }
            const rejectedFolder = path.join(group.rootDir, "rejected");
            const files = await promisify(fs.readdir)(rejectedFolder);

            const stat = promisify(fs.stat);
            const promises: Promise<any>[] = [];
            for (const certFile of files) {
                // read date
                promises.push(stat(path.join(rejectedFolder, certFile)));
            }
            const stats = await Promise.all(promises);

            for (let i = 0; i < stats.length; i++) {
                list.push({
                    filename: path.join(rejectedFolder, files[i]),
                    stat: stats[i]
                });
            }
        }

        const list: FileData[] = [];
        await extractRejectedList(this.applicationGroup, list);
        await extractRejectedList(this.userTokenGroup, list);
        await extractRejectedList(this.httpsGroup, list);

        // now sort list from newer file to older file
        list.sort((a: FileData, b: FileData) =>
          b.stat.mtime.getTime() - a.stat.mtime.getTime()
        );

        const readFile = promisify(fs.readFile);
        const promises: Array<Promise<string>> = [];
        for (const item of list) {
            promises.push(readFile(item.filename, "utf8"));
        }
        const certificatesPEM: string[] = await Promise.all(promises);

        const certificates: Buffer[] = certificatesPEM.map(convertPEMtoDER);
        return {
            certificates,
            statusCode: StatusCodes.Good
        };
    }

    public async updateCertificate(
      certificateGroupId: NodeId | string,
      certificateTypeId: NodeId | string,
      certificate: Buffer,
      issuerCertificates: ByteString[],
      privateKeyFormat: string,
      privateKey: Buffer
    ): Promise<UpdateCertificateResult> {
        return {
            applyChangesRequired: true,
            statusCode: StatusCodes.Good
        };
    }

    private getCertificateManager(
      certificateGroupId: NodeId | string
    ): CertificateManager | null {
        const groupName = findCertificateGroupName(certificateGroupId);
        return this._map[groupName] || null;
    }

}
