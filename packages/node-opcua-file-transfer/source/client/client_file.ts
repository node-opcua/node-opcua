/**
 * @module node-opcua-file-transfer
 */
import { Byte, Int32, UInt16, UInt32, UInt64 } from "node-opcua-basic-types";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { MethodIds } from "node-opcua-constants";

import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";

const debugLog = make_debugLog("FileType");
const errorLog = make_errorLog("FileType");
const doDebug = checkDebugFlag("FileType");

import { OpenFileMode } from "../open_mode";
export { OpenFileMode } from "../open_mode";

/**
 *
 *
 */
export class ClientFile {

    public static useGlobalMethod = false;

    public    fileHandle = 0;
    protected session: IBasicSession;
    protected readonly fileNodeId: NodeId;

    private openMethodNodeId?: NodeId;
    private closeMethodNodeId?: NodeId;
    private setPositionNodeId?: NodeId;
    private getPositionNodeId?: NodeId;
    private readNodeId?: NodeId;
    private writeNodeId?: NodeId;
    private openCountNodeId?: NodeId;
    private sizeNodeId?: NodeId;

    constructor(session: IBasicSession, nodeId: NodeId) {
        this.session = session;
        this.fileNodeId = nodeId;
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
            inputArguments: [
                { dataType: DataType.Byte, value: mode as Byte }
            ],
            methodId: this.openMethodNodeId,
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
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
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle }
            ],
            methodId: this.closeMethodNodeId,
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
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
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle }
            ],
            methodId: this.getPositionNodeId,
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
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
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
            throw new Error("Error " + result.statusCode.toString());
        }
        return;
    }

    public async read(bytesToRead: Int32): Promise<Buffer> {
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
                    value: bytesToRead
                }
            ],
            methodId: this.readNodeId,
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
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
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
            throw new Error("Error " + result.statusCode.toString());
        }
        return;
    }

    public async openCount(): Promise<UInt16> {
        await this.ensureInitialized();
        const nodeToRead: ReadValueIdOptions = { nodeId: this.openCountNodeId!, attributeId: AttributeIds.Value };
        const dataValue = await this.session.read(nodeToRead);

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
            const browsePaths: BrowsePath[] = [
                makeBrowsePath(this.fileNodeId, "/OpenCount"),
                makeBrowsePath(this.fileNodeId, "/Size")
            ];
            const results = await this.session.translateBrowsePath(browsePaths);
            if (results[0].statusCode !== StatusCodes.Good) {
                throw new Error("fileType object does not expose mandatory OpenCount Property");
            }
            if (results[1].statusCode !== StatusCodes.Good) {
                throw new Error("fileType object does not expose mandatory Size Property");
            }
            this.openCountNodeId = results[0].targets![0].targetId;
            this.sizeNodeId = results[1].targets![0].targetId;
            return;
        }
        const browsePaths: BrowsePath[] = [
            makeBrowsePath(this.fileNodeId, "/Open"),
            makeBrowsePath(this.fileNodeId, "/Close"),
            makeBrowsePath(this.fileNodeId, "/SetPosition"),
            makeBrowsePath(this.fileNodeId, "/GetPosition"),
            makeBrowsePath(this.fileNodeId, "/Write"),
            makeBrowsePath(this.fileNodeId, "/Read"),
            makeBrowsePath(this.fileNodeId, "/OpenCount"),
            makeBrowsePath(this.fileNodeId, "/Size")
        ];

        const results = await this.session.translateBrowsePath(browsePaths);

        if (results[0].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory Open Method");
        }
        if (results[1].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory Close Method");
        }
        if (results[2].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory SetPosition Method");
        }
        if (results[3].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory GetPosition Method");
        }
        if (results[4].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory Write Method");
        }
        if (results[5].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory Read Method");
        }
        if (results[6].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory OpenCount Variable");
        }
        if (results[7].statusCode !== StatusCodes.Good) {
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
