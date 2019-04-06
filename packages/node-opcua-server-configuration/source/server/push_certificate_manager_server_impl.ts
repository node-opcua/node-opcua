/**
 * @module node-opcua-server-configuration
 */
import * as fs from "fs";
import { promisify } from "util";

import assert from "node-opcua-assert";
import { ByteString, StatusCodes } from "node-opcua-basic-types";
import { convertPEMtoDER } from "node-opcua-crypto";
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

        console.log(certificateSigningRequest.toString("base64"));
        return {
            certificateSigningRequest,
            statusCode: StatusCodes.Good
        };

    }

    public async getRejectedList(): Promise<GetRejectedListResult> {
        return {
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
