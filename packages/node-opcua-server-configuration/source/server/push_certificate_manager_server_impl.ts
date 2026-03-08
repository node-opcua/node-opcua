/**
 * @module node-opcua-server-configuration-server
 */
import { EventEmitter } from "node:events";
import { assert } from "node-opcua-assert";
import type { ByteString } from "node-opcua-basic-types";
import { CertificateManager } from "node-opcua-certificate-manager";
import { make_errorLog } from "node-opcua-debug";
import type { NodeId } from "node-opcua-nodeid";
import type { SubjectOptions } from "node-opcua-pki";
import type { StatusCode } from "node-opcua-status-code";
import { rsaCertificateTypesArray } from "../clientTools/certificate_types.js";
import type {
    CreateSigningRequestResult,
    GetRejectedListResult,
    PushCertificateManager,
    UpdateCertificateResult
} from "../push_certificate_manager.js";
import { executeApplyChanges } from "./push_certificate_manager/apply_changes.js";
import { executeCreateSigningRequest } from "./push_certificate_manager/create_signing_request.js";
import { executeGetRejectedList } from "./push_certificate_manager/get_rejected_list.js";
import { PushCertificateManagerInternalContext } from "./push_certificate_manager/internal_context.js";
import { executeUpdateCertificate } from "./push_certificate_manager/update_certificate.js";

const errorLog = make_errorLog("ServerConfiguration");

/**
 * Type-safe event map for PushCertificateManagerServerImpl.
 *
 * - `applyChangesCompleted` — fired after a successful `applyChanges()` call.
 * - `certificateUpdated`    — fired after a successful `updateCertificate()` call,
 *                             with the resolved group id and the leaf certificate.
 * - `trustListUpdated`      — fired after a successful TrustList mutation
 *                             (`CloseAndUpdate`, `AddCertificate`, `RemoveCertificate`),
 *                             with the certificate-group browse-name.
 */
export interface PushCertificateManagerEvents {
    applyChangesCompleted: () => void;
    certificateUpdated: (certificateGroupId: NodeId | string, certificate: Buffer) => void;
    trustListUpdated: (certificateGroupId: string) => void;
}

export interface PushCertificateManagerServerOptions {
    applicationGroup?: CertificateManager;
    userTokenGroup?: CertificateManager;
    httpsGroup?: CertificateManager;

    applicationUri: string;

    // Optional: Allowed certificate types for each group
    // These should be read from the CertificateTypes Property of the CertificateGroup objects in the AddressSpace
    // If not provided, defaults to all known OPC UA certificate types (backward compatibility)
    applicationGroupCertificateTypes?: NodeId[];
    userTokenGroupCertificateTypes?: NodeId[];
    httpsGroupCertificateTypes?: NodeId[];
}

export type ActionQueue = (() => Promise<void>)[];

export class PushCertificateManagerServerImpl extends EventEmitter implements PushCertificateManager {
    public applicationGroup?: CertificateManager;
    public userTokenGroup?: CertificateManager;
    public httpsGroup?: CertificateManager;

    // Use a true private reference (could be upgraded to #context in recent ES)
    private readonly _context: PushCertificateManagerInternalContext;

    /** @hidden */
    public applicationUri: string;

    // ── typed event helpers ──────────────────────────────────────────
    public on<K extends keyof PushCertificateManagerEvents>(
        event: K,
        listener: PushCertificateManagerEvents[K]
    ): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public on(event: string | symbol, listener: (...args: any[]) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public on(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    public once<K extends keyof PushCertificateManagerEvents>(
        event: K,
        listener: PushCertificateManagerEvents[K]
    ): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public once(event: string | symbol, listener: (...args: any[]) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public once(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.once(event, listener);
    }

    constructor(options: PushCertificateManagerServerOptions) {
        super();
        this._context = new PushCertificateManagerInternalContext(this);

        this.applicationUri = options ? options.applicationUri : "";

        if (options) {
            this.applicationGroup = options.applicationGroup;
            this.userTokenGroup = options.userTokenGroup;
            this.httpsGroup = options.httpsGroup;
            if (this.userTokenGroup) {
                this._context.map.DefaultUserTokenGroup = this.userTokenGroup;
                // Store allowed certificate types, or use all known types as default
                this._context.certificateTypes.DefaultUserTokenGroup = options.userTokenGroupCertificateTypes || [
                    // [...rsaCertificateTypes, ...eccCertificateTypes];
                    ...rsaCertificateTypesArray
                ]; // FIXME: ECC is not yet supported

                // c8 ignore next
                if (!(this.userTokenGroup instanceof CertificateManager)) {
                    errorLog(
                        "Expecting this.userTokenGroup to be instanceof CertificateManager :",
                        (this.userTokenGroup as unknown as { constructor: { name: string } }).constructor.name
                    );
                    throw new Error("Expecting this.userTokenGroup to be instanceof CertificateManager ");
                }
            }
            if (this.applicationGroup) {
                this._context.map.DefaultApplicationGroup = this.applicationGroup;
                // Store allowed certificate types, or use all known types as default
                this._context.certificateTypes.DefaultApplicationGroup = options.applicationGroupCertificateTypes || [
                    // [...rsaCertificateTypes, ...eccCertificateTypes];
                    ...rsaCertificateTypesArray
                ]; // FIXME: ECC is not yet supported
                assert(this.applicationGroup instanceof CertificateManager);
            }
            if (this.httpsGroup) {
                this._context.map.DefaultHttpsGroup = this.httpsGroup;
                // Store allowed certificate types, or use all known types as default
                this._context.certificateTypes.DefaultHttpsGroup = options.httpsGroupCertificateTypes || [
                    // [...rsaCertificateTypes, ...eccCertificateTypes];
                    ...rsaCertificateTypesArray
                ]; // FIXME: ECC is not yet supported
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
        return ["PEM"];
    }

    public async createSigningRequest(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        subjectName: string | SubjectOptions | null,
        regeneratePrivateKey?: boolean,
        nonce?: Buffer
    ): Promise<CreateSigningRequestResult> {
        return await executeCreateSigningRequest(
            this._context,
            certificateGroupId,
            certificateTypeId,
            subjectName,
            regeneratePrivateKey,
            nonce
        );
    }

    public async getRejectedList(): Promise<GetRejectedListResult> {
        return await executeGetRejectedList(this._context);
    }

    // eslint-disable-next-line max-statements
    public async updateCertificate(
        certificateGroupId: NodeId | string,
        certificateTypeId: NodeId | string,
        certificate: Buffer,
        issuerCertificates: ByteString[],
        privateKeyFormat?: string,
        privateKey?: Buffer | string
    ): Promise<UpdateCertificateResult> {
        return await executeUpdateCertificate(
            this._context,
            certificateGroupId,
            certificateTypeId,
            certificate,
            issuerCertificates,
            privateKeyFormat,
            privateKey
        );
    }

    /**
     *
     * ApplyChanges is used to apply pending Certificate and TrustList updates
     * and to complete a transaction as described in 7.10.2.
     *
     * ApplyChanges returns Bad_InvalidState if any TrustList is still open for writing.
     * No changes are applied and ApplyChanges can be called again after the TrustList is closed.
     *
     * If a Session is closed or abandoned then the transaction is closed and all pending changes are discarded.
     *
     * If ApplyChanges is called and there is no active transaction then the Server returns Bad_NothingToDo.
     * If there is an active transaction, however, no changes are pending the result is Good and the transaction is closed.
     *
     * When a Server Certificate or TrustList changes active SecureChannels are not immediately affected.
     * This ensures the caller of ApplyChanges can get a response to the Method call.
     * Once the Method response is returned the Server shall force existing SecureChannels affected by
     * the changes to renegotiate and use the new Server Certificate and/or TrustLists.
     *
     * Servers may close SecureChannels without discarding any Sessions or Subscriptions.
     * This will seem like a network interruption from the perspective of the Client and the Client reconnect
     * logic (see OPC 10000-4) allows them to recover their Session and Subscriptions.
     * Note that some Clients may not be able to reconnect because they are no longer trusted.
     *
     * Other Servers may need to do a complete shutdown.
     *
     * In this case, the Server shall advertise its intent to interrupt connections by setting the
     * SecondsTillShutdown and ShutdownReason Properties in the ServerStatus Variable.
     *
     * If a TrustList change only affects UserIdentity associated with a Session then Servers
     * shall re-evaluate the UserIdentity and if it is no longer valid the Session and associated
     * Subscriptions are closed.
     *
     * This Method shall be called from an authenticated SecureChannel and from the Session that
     * created the transaction and has access to the SecurityAdmin Role (see 7.2).
     *
     */
    public async applyChanges(): Promise<StatusCode> {
        return await executeApplyChanges(this._context);
    }

    public getCertificateManager(groupName: string): CertificateManager | null {
        return this._context.map[groupName] || null;
    }

    public getCertificateTypes(groupName: string): NodeId[] | undefined {
        return this._context.certificateTypes[groupName];
    }

    public async dispose(): Promise<void> {
        await this._context.dispose();
    }
}
