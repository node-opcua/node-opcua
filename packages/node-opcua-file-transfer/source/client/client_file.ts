import { Byte, Int32, UInt64 } from "node-opcua-basic-types";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantArrayType } from "node-opcua-variant";

export class ClientFile {

    public fileHandle: number = 0;

    private session: IBasicSession;
    private readonly fileNodeId: NodeId;

    private openMethodNodeId?: NodeId;
    private closeMethodNodeId?: NodeId;
    private setPositionNodeId?: NodeId;
    private getPositionNodeId?: NodeId;
    private readNodeId?: NodeId;
    private writeNodeId?: NodeId;

    constructor(session: IBasicSession, nodeId: NodeId) {
        this.session = session;
        this.fileNodeId = nodeId;
    }

    public async open(mode: Byte): Promise<number> {

        if (this.fileHandle) {
            throw new Error("File has already be opened");
        }
        if (!this.openMethodNodeId) {
            await this.extractMethodsIds();
        }

        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.Byte, value: mode }
            ],
            methodId: this.openMethodNodeId,
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
            throw new Error("cannot open file statusCode = " + result.statusCode.toString());
        }

        this.fileHandle = result.outputArguments![0].value;

        return this.fileHandle;
    }

    public async close(): Promise<void> {
        if (!this.fileHandle) {
            throw new Error("File has node been opened yet");
        }

        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle }
            ],
            methodId: this.openMethodNodeId,
            objectId: this.fileNodeId
        });

        this.fileHandle = 0;
    }

    public async getPosition(): Promise<UInt64> {
        if (!this.fileHandle) {
            throw new Error("File has node been opened yet");
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

    public async setPosition(position: UInt64): Promise<void> {
        if (!this.fileHandle) {
            throw new Error("File has node been opened yet");
        }
        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle },
                {
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.UInt64,
                    value: position }
            ],
            methodId: this.setPositionNodeId,
            objectId: this.fileNodeId
        });
        if (result.statusCode !== StatusCodes.Good) {
            throw new Error("Error " + result.statusCode.toString());
        }
        return;
    }

    public async read(byteToRead: Int32): Promise<Buffer> {

        if (!this.fileHandle) {
            throw new Error("File has node been opened yet");
        }
        const result = await this.session.call({
            inputArguments: [
                { dataType: DataType.UInt32, value: this.fileHandle },
                {
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.Int32,
                    value: byteToRead }
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

    private async extractMethodsIds(): Promise<void> {
        const browsePaths: BrowsePath[] = [
            makeBrowsePath(this.fileNodeId, "/Open"),
            makeBrowsePath(this.fileNodeId, "/Close"),
            makeBrowsePath(this.fileNodeId, "/SetPosition"),
            makeBrowsePath(this.fileNodeId, "/GetPosition"),
            makeBrowsePath(this.fileNodeId, "/Write"),
            makeBrowsePath(this.fileNodeId, "/Read")
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
        if (results[4].statusCode !== StatusCodes.Good) {
            throw new Error("fileType object does not expose mandatory Read Method");
        }

        this.openMethodNodeId = results[0].targets![0].targetId;
        this.closeMethodNodeId = results[1].targets![0].targetId;
        this.setPositionNodeId = results[2].targets![0].targetId;
        this.getPositionNodeId = results[3].targets![0].targetId;
        this.writeNodeId = results[4].targets![0].targetId;
        this.readNodeId = results[5].targets![0].targetId;
    }
}
