// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
import { callbackify } from "util";

import {
    AddressSpace,
    generateAddressSpace, PseudoSession,
    SessionContext,
    UAFileType,
    UAMethod
} from "node-opcua-address-space";
import { Byte } from "node-opcua-basic-types";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { IBasicSession } from "node-opcua-pseudo-session";
import { CallMethodResultOptions } from "node-opcua-service-call";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";

/**
 * Open is used to open a file represented by an Object of FileType.
 * When a client opens a file it gets a file handle that is valid while the
 * session is open. Clients shall use the Close Method to release the handle
 * when they do not need access to the file anymore. Clients can open the
 * same file several times for read.
 * A request to open for writing shall return Bad_NotWritable when the file is
 * already opened.
 * A request to open for reading shall return Bad_NotReadable
 * when the file is already opened for writing.
 * @private
 */
async function _openFile(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    const mode = inputArguments[0].value as Byte;

    /**
     * mode (Byte) Indicates whether the file should be opened only for read operations
     *      or for read and write operations and where the initial position is set.
     *      The mode is an 8-bit unsigned integer used as bit mask with the structure
     *      defined in the following table:
     *      Field        Bit  Description
     *      Read          0   The file is opened for reading. If this bit is not
     *                        set the Read Method cannot be executed.
     *      Write         1   The file is opened for writing. If this bit is not
     *                        set the Write Method cannot be executed.
     *      EraseExisting 2   This bit can only be set if the file is opened for writing
     *                        (Write bit is set). The existing content of the file is
     *                        erased and an empty file is provided.
     *      Append        3   When the Append bit is set the file is opened at end
     *                        of the file, otherwise at begin of the file.
     *                        The SetPosition Method can be used to change the position.
     *      Reserved     4:7  Reserved for future use. Shall always be zero.
     */
    /**
     *  fileHandle (UInt32) A handle for the file used in other method calls indicating not the
     *            file (this is done by the Object of the Method call) but the access
     *            request and thus the position in the file. The fileHandle is generated
     *            by the server and is unique for the Session. Clients cannot transfer the
     *            fileHandle to another Session but need to get a new fileHandle by calling
     *            the Open Method.
     */
    const fileHandle = 100;
    /**
     * Method Result Codes (defined in Call Service)
     *  Result Code         Description
     *  BadNotReadable      File might be locked and thus not readable.
     *  BadNotWritable
     *  BadInvalidState     The file is locked and thus not writable.
     *  BadInvalidArgument  Mode setting is invalid.
     *  BadNotFound .
     *  BadUnexpectedError
     */

    const callMethodResult = {
        outputArguments: [
            {
                dataType: DataType.UInt32,
                value: fileHandle
            }
        ],
        statusCode: StatusCodes.Good
    };
    return callMethodResult;

}

async function _closeFile(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    return { statusCode: StatusCodes.BadNotImplemented };
}

async function _readFile(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    return { statusCode: StatusCodes.BadNotImplemented };
}

async function _writeFile(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    return { statusCode: StatusCodes.BadNotImplemented };
}

async function _setPositionFile(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    return { statusCode: StatusCodes.BadNotImplemented };
}

async function _getPositionFile(
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext
): Promise<CallMethodResultOptions> {

    return { statusCode: StatusCodes.BadNotImplemented };
}

function installFileType(file: UAFileType) {

    //
    file.open.bindMethod(callbackify(_openFile));
    file.close.bindMethod(callbackify(_closeFile));
    file.read.bindMethod(callbackify(_readFile));
    file.write.bindMethod(callbackify(_writeFile));
    file.setPosition.bindMethod(callbackify(_setPositionFile));
    file.getPosition.bindMethod(callbackify(_getPositionFile));

}

export class ClientFileType {

    private session: IBasicSession;
    private fileNodeId: NodeId;

    private fileHandle: number = 0;

    private openMethodNodeId?: NodeId;
    private closeMethodNodeId?: NodeId;

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
        this.fileHandle = 1;
        return this.fileHandle;
    }

    public async close(): Promise<void> {
        if (!this.fileHandle) {
            throw new Error("File has node been openned yet");
        }

        this.fileHandle = 0;
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
            throw new Error("fileType object does not expose Open Method");
        }

        this.openMethodNodeId = results[0]!.targets[0]!.targetId;
        this.closeMethodNodeId = results[1]!.targets[0]!.targetId;

    }
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("FileTransfer", () => {

    let addressSpace: AddressSpace;

    before(async () => {
        const xmlFiles = [
            nodesets.standard
        ];
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("Own");
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should expose a File Transfer node", async () => {

        const namespace = addressSpace.getOwnNamespace();

        const fileType = addressSpace.findObjectType("FileType")!;
        should.exists(fileType);

        const f = fileType.instantiate({
            browseName: "FileTransferObj",
            organizedBy: addressSpace.rootFolder.objects.server
        });

        installFileType(f as UAFileType);

        const session = new PseudoSession(addressSpace);

        const clientFile = new ClientFileType(session, f.nodeId);

        const handle = await clientFile.open(1);
        handle.should.not.eql(0);

        await clientFile.close();

    });
});
