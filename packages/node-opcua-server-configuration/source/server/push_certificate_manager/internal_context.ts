import { CertificateManager } from "node-opcua-certificate-manager";
import { NodeId } from "node-opcua-nodeid";
import { FileTransactionManager } from "../file_transaction_manager";

export type ActionQueue = (() => Promise<void>)[];

export interface IPushCertificateManagerServer {
    applicationGroup?: CertificateManager;
    userTokenGroup?: CertificateManager;
    httpsGroup?: CertificateManager;
    applicationUri: string;

    getCertificateManager(groupName: string): CertificateManager | null;
    getCertificateTypes(groupName: string): NodeId[] | undefined;
    emit(eventName: string | symbol, ...args: any[]): boolean;
}

export class PushCertificateManagerInternalContext {
    public readonly map: { [key: string]: CertificateManager } = {};
    public readonly certificateTypes: { [key: string]: NodeId[] } = {};
    public readonly fileTransactionManager = new FileTransactionManager();
    public tmpCertificateManager?: CertificateManager;
    public actionQueue: ActionQueue = [];
    public operationInProgress = false;

    constructor(private readonly server: IPushCertificateManagerServer) { }

    get applicationGroup() { return this.server.applicationGroup; }
    get userTokenGroup() { return this.server.userTokenGroup; }
    get httpsGroup() { return this.server.httpsGroup; }
    get applicationUri() { return this.server.applicationUri; }

    getCertificateManager(groupName: string) { return this.server.getCertificateManager(groupName); }
    getCertificateTypes(groupName: string) { return this.server.getCertificateTypes(groupName); }
    emit(eventName: string | symbol, ...args: any[]) { return this.server.emit(eventName, ...args); }

    public async dispose(): Promise<void> {
        if (this.tmpCertificateManager) {
            await this.tmpCertificateManager.dispose();
            this.tmpCertificateManager = undefined;
        }

        if (this.fileTransactionManager) {
            await this.fileTransactionManager.abortTransaction();
        }

        this.actionQueue.length = 0;
    }
}
