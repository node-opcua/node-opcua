/**
 * @module node-opcua-file-transfer
 */
import { Byte, coerceInt32, Int32, Int64, UInt16, UInt32, UInt64 } from "node-opcua-basic-types";
import { AttributeIds, QualifiedName } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSessionAsync } from "node-opcua-pseudo-session";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { MethodIds } from "node-opcua-constants";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

const debugLog = make_debugLog("FileType");
const doDebug = checkDebugFlag("FileType");

import { OpenFileMode } from "../open_mode";
export { OpenFileMode } from "../open_mode";

export interface IClientFile {
    fileHandle: number;
    open(mode: OpenFileMode): Promise<number>;
    close(): Promise<void>;
    getPosition(): Promise<UInt64>;
    setPosition(position: UInt64 | UInt32): Promise<void>;
    read(bytesToRead: UInt32 | Int32 | Int64 | UInt64): Promise<Buffer>;
    write(data: Buffer): Promise<void>;
    openCount(): Promise<UInt16>;
    size(): Promise<UInt64>;
    session: IBasicSessionAsync;
}
export interface IClientFilePriv extends IClientFile {
    readonly fileNodeId: NodeId;
    openMethodNodeId?: NodeId;
    closeMethodNodeId?: NodeId;
    setPositionNodeId?: NodeId;
    getPositionNodeId?: NodeId;
    readNodeId?: NodeId;
    writeNodeId?: NodeId;
    openCountNodeId?: NodeId;
    sizeNodeId?: NodeId;
    ensureInitialized(): Promise<void>;
}

/**
 *
 *
 */
export class ClientFile implements IClientFile {
    public static useGlobalMethod = false;

    public fileHandle = 0;
    public session: IBasicSessionAsync;

    public readonly nodeId: NodeId;

    private openMethodNodeId?: NodeId;
    private closeMethodNodeId?: NodeId;
    private setPositionNodeId?: NodeId;
    private getPositionNodeId?: NodeId;
    private readNodeId?: NodeId;
    private writeNodeId?: NodeId;
    private openCountNodeId?: NodeId;
    private sizeNodeId?: NodeId;

    constructor(session: IBasicSessionAsync, nodeId: NodeId) {
        this.session = session;
        this.nodeId = nodeId;
    }

    /**
     * @deprecated use nodeId instead
     */
    protected get fileNodeId(): NodeId {
        return this.nodeId;
    }

    public async browseName(): Promise<QualifiedName> {
        const dataValue = await this.session.read({ nodeId: this.nodeId, attributeId: AttributeIds.BrowseName });
        return dataValue.value.value as QualifiedName;
    }

    public async open(mode: OpenFileMode): Promise<number> {
        if (mode === null || mode === undefined) {
            throw new Error("expecting a validMode " + OpenFileMode[mode]);
        }
        if (this.fileHandle) {
            throw new Error("File has already be opened");
        }
        await this.ensureInitialized();

        const result = await this.session.call({
            inputArguments: [{ dataType: DataType.Byte, value: mode as Byte }],
            methodId: this.openMethodNodeId,
            objectId: this.nodeId
        });
        if (result.statusCode.isNotGood()) {
            debugLog("Cannot open file : ");
            throw new Error("cannot open file statusCode = " + result.statusCode.toString() + " mode = " + OpenFileMode[mode]);
        }

        this.fileHandle = result.outputArguments![0].value;

        return this.fileHandle;
    }

    public async close(): Promise<void> {
        if (!this.fileHandle) {
            throw new Error("File has not been opened yet");
        }
        await this.ensureInitialized();

        const result = await this.session.call({
            inputArguments: [{ dataType: DataType.UInt32, value: this.fileHandle }],
            methodId: this.closeMethodNodeId,
            objectId: this.nodeId
        });
        if (result.statusCode.isNotGood()) {
            debugLog("Cannot close file : ");
            throw new Error("cannot close file statusCode = " + result.statusCode.toString());
        }

        this.fileHandle = 0;
    }

    public async getPosition(): Promise<UInt64> {
        await this.ensureInitialized();
        if (!this.fileHandle) {
            throw new Error("File has not been opened yet");
        }

        const result = await this.session.call({
            inputArguments: [{ dataType: DataType.UInt32, value: this.fileHandle }],
            methodId: this.getPositionNodeId,
            objectId: this.nodeId
        });
        if (result.statusCode.isNotGood()) {
            throw new Error("Error " + result.statusCode.toString());
        }
        return result.outputArguments![0].value as UInt64;
    }

    public async setPosition(position: UInt64 | UInt32): Promise<void> {
        await this.ensureInitialized();
        if (!this.fileHandle) {
            throw new Error("File has not been opened yet");
        }
        if (typeof position === "number") {
            position = [0, position];
        }
        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle },
                {
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.UInt64,
                    value: position
                }
            ],
            methodId: this.setPositionNodeId,
            objectId: this.nodeId
        });
        if (result.statusCode.isNotGood()) {
            throw new Error("Error " + result.statusCode.toString());
        }
        return;
    }

    public async read(bytesToRead: UInt32 | Int32 | Int64 | UInt64): Promise<Buffer> {
        await this.ensureInitialized();
        if (!this.fileHandle) {
            throw new Error("File has not been opened yet");
        }
        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle },
                {
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.Int32,
                    value: coerceInt32(bytesToRead)
                }
            ],
            methodId: this.readNodeId,
            objectId: this.nodeId
        });
        if (result.statusCode.isNotGood()) {
            throw new Error("Error " + result.statusCode.toString());
        }
        if (!result.outputArguments || result.outputArguments[0].dataType !== DataType.ByteString) {
            throw new Error("Error invalid output");
        }
        return result.outputArguments![0].value as Buffer;
    }

    public async write(data: Buffer): Promise<void> {
        await this.ensureInitialized();
        if (!this.fileHandle) {
            throw new Error("File has not been opened yet");
        }
        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle },
                {
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.ByteString,
                    value: data
                }
            ],
            methodId: this.writeNodeId,
            objectId: this.nodeId
        });
        if (result.statusCode.isNotGood()) {
            throw new Error("Error " + result.statusCode.toString());
        }
        return;
    }

    public async openCount(): Promise<UInt16> {
        await this.ensureInitialized();
        const nodeToRead: ReadValueIdOptions = { nodeId: this.openCountNodeId!, attributeId: AttributeIds.Value };
        const dataValue = await this.session.read(nodeToRead);

        // istanbul ignore next
        if (doDebug) {
            debugLog(" OpenCount ", nodeToRead.nodeId!.toString(), dataValue.toString());
        }
        return dataValue.value.value;
    }

    public async size(): Promise<UInt64> {
        await this.ensureInitialized();
        const nodeToRead = { nodeId: this.sizeNodeId, attributeId: AttributeIds.Value };
        const dataValue = await this.session.read(nodeToRead);
        return dataValue.value.value;
    }

    // eslint-disable-next-line max-statements
    protected async extractMethodsIds(): Promise<void> {
        if (ClientFile.useGlobalMethod) {
            debugLog("Using GlobalMethodId");
            this.openMethodNodeId = resolveNodeId(MethodIds.FileType_Open);
            this.closeMethodNodeId = resolveNodeId(MethodIds.FileType_Close);
            this.setPositionNodeId = resolveNodeId(MethodIds.FileType_SetPosition);
            this.getPositionNodeId = resolveNodeId(MethodIds.FileType_GetPosition);
            this.writeNodeId = resolveNodeId(MethodIds.FileType_Write);
            this.readNodeId = resolveNodeId(MethodIds.FileType_Read);
            const browsePaths: BrowsePath[] = [makeBrowsePath(this.nodeId, "/OpenCount"), makeBrowsePath(this.nodeId, "/Size")];
            const results = await this.session.translateBrowsePath(browsePaths);
            if (results[0].statusCode.isNotGood()) {
                throw new Error("fileType object does not expose mandatory OpenCount Property");
            }
            if (results[1].statusCode.isNotGood()) {
                throw new Error("fileType object does not expose mandatory Size Property");
            }
            this.openCountNodeId = results[0].targets![0].targetId;
            this.sizeNodeId = results[1].targets![0].targetId;
            return;
        }
        const browsePaths: BrowsePath[] = [
            makeBrowsePath(this.nodeId, "/Open"),
            makeBrowsePath(this.nodeId, "/Close"),
            makeBrowsePath(this.nodeId, "/SetPosition"),
            makeBrowsePath(this.nodeId, "/GetPosition"),
            makeBrowsePath(this.nodeId, "/Write"),
            makeBrowsePath(this.nodeId, "/Read"),
            makeBrowsePath(this.nodeId, "/OpenCount"),
            makeBrowsePath(this.nodeId, "/Size")
        ];

        const results = await this.session.translateBrowsePath(browsePaths);

        if (results[0].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory Open Method");
        }
        if (results[1].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory Close Method");
        }
        if (results[2].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory SetPosition Method");
        }
        if (results[3].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory GetPosition Method");
        }
        if (results[4].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory Write Method");
        }
        if (results[5].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory Read Method");
        }
        if (results[6].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory OpenCount Variable");
        }
        if (results[7].statusCode.isNotGood()) {
            throw new Error("fileType object does not expose mandatory Size Variable");
        }

        if (false && doDebug) {
            results.map((x: any) => debugLog(x.toString()));
        }
        this.openMethodNodeId = results[0].targets![0].targetId;
        this.closeMethodNodeId = results[1].targets![0].targetId;
        this.setPositionNodeId = results[2].targets![0].targetId;
        this.getPositionNodeId = results[3].targets![0].targetId;
        this.writeNodeId = results[4].targets![0].targetId;
        this.readNodeId = results[5].targets![0].targetId;
        this.openCountNodeId = results[6].targets![0].targetId;
        this.sizeNodeId = results[7].targets![0].targetId;
    }

    protected async ensureInitialized(): Promise<void> {
        if (!this.openMethodNodeId) {
            await this.extractMethodsIds();
        }
    }
}

/**
 * 5.2.10 UserRolePermissions
 *
 * The optional UserRolePermissions Attribute specifies the Permissions that apply to a Node for
 * all Roles granted to current Session. The value of the Attribute is an array of
 * RolePermissionType Structures (see Table 8).
 * Clients may determine their effective Permissions by logically ORing the Permissions for each
 * Role in the array.
 *  The value of this Attribute is derived from the rules used by the Server to map Sessions to
 * Roles. This mapping may be vendor specific or it may use the standard Role model defined in 4.8.
 * This Attribute shall not be writeable.
 * If not specified, the value of DefaultUserRolePermissions Property from the Namespace
 * Metadata Object associated with the Node is used instead. If the NamespaceMetadata Object
 * does not define the Property or does not exist, then the Server does not publish any information
 * about Roles mapped to the current Session.
 *
 *
 * 5.2.11 AccessRestrictions
 * The optional AccessRestrictions Attribute specifies the AccessRestrictions that apply to a Node.
 * Its data type is defined in 8.56. If a Server supports AccessRestrictions for a particular
 * Namespace it adds the DefaultAccessRestrictions Property to the NamespaceMetadata Object
 * for that Namespace (see Figure 8). If a particular Node in the Namespace needs to override
 * the default value the Server adds the AccessRestrictions Attribute to the Node.
 * If a Server implements a vendor specific access restriction model for a Namespace, it does not
 * add the DefaultAccessRestrictions Property to the NamespaceMetadata Object.
 *
 *
 * DefaultAccessRestrictions
 *
 */
