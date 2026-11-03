/**
 * @module node-opcua-file-transfer
 */

import fsOrig from "node:fs";
import { promisify, types } from "node:util";
import type {
    IAddressSpace,
    ISessionBase,
    ISessionContext,
    UAFile,
    UAFile_Base,
    UAMethod,
    UAObjectType
} from "node-opcua-address-space";
import { getContextMaxMessageSize } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { Byte, Int32, UInt32, UInt64 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { NodeId, type NodeIdLike, sameNodeId } from "node-opcua-nodeid";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { PermissionType } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import type { AbstractFs } from "../common/abstract_fs.js";
import { OpenFileMode, OpenFileModeMask } from "../open_mode.js";

const debugLog = make_debugLog("FileType");
const errorLog = make_errorLog("FileType");
const warningLog = make_warningLog("FileType");
const doDebug = checkDebugFlag("FileType");
doDebug;
/**
 *
 */
export interface FileOptions {
    /**
     * the filaname of the physical file which is managed by the OPCUA filetpye
     */
    filename: string;
    /**
     * the maximum allowed size of the physical file, in bytes.
     * A Write that would go past this size returns BadOutOfRange and writes nothing.
     * - if not specified, {@link defaultMaxSize} applies
     * - 0 means no limit
     */
    maxSize?: number;
    /**
     * an optional mimeType
     */
    mimeType?: string;

    fileSystem?: AbstractFs;

    nodeId?: NodeIdLike;

    /**
     * the maximum number of bytes that can be read from the file
     * in a single read call
     * - if not specified or 0, we assume Int32 limit
     */
    maxChunkSize?: number;

    /**
     * whether the file can be opened for writing. The Writable Property exposes this value.
     * When false, Open with the Write bit returns BadNotWritable. Read access does not change.
     * - if not specified, the file is writable
     *
     * UserWritable also takes the user access rights into account: a user without the Call
     * permission on the Write Method cannot open the file for writing (BadUserAccessDenied).
     */
    writable?: boolean;

    /**
     * the maximum number of file handles that one Session can hold at the same time, for
     * all the files of the address space. When the Session already holds this number of
     * handles, Open on this file returns BadResourceUnavailable.
     * - if not specified, {@link defaultMaxOpenFilesPerSession} applies
     */
    maxOpenFilesPerSession?: number;

    /**
     * the maximum number of file handles that all the Sessions can hold at the same time, for
     * all the files of the address space. When the Sessions already hold this number of
     * handles, Open on this file returns BadResourceUnavailable.
     * Keep this value below the file descriptor limit of the process, with a margin for sockets.
     * - if not specified, {@link defaultMaxOpenFilesPerServer} applies
     */
    maxOpenFilesPerServer?: number;

    refreshFileContentFunc?: () => Promise<void>;
}

export const defaultMaxSize = 100000000;
export const defaultMaxOpenFilesPerSession = 10;
export const defaultMaxOpenFilesPerServer = 256;

export interface UAFileType extends UAObjectType, UAFile_Base {}

/**
 * Write requires a call to the Write Method: a user that cannot call it has no write
 * access to the file, and Open must not give it one.
 */
function _hasWriteAccessRights(context: ISessionContext, file: UAFile): boolean {
    return context.checkPermission(file.write, PermissionType.Call);
}

/**
 *
 */
export class FileTypeData {
    public _fs: AbstractFs;
    public filename = "";
    public maxSize = 0;
    public mimeType = "";
    public maxChunkSizeBytes = 0;
    public writable = true;
    public maxOpenFilesPerSession = defaultMaxOpenFilesPerSession;
    public maxOpenFilesPerServer = defaultMaxOpenFilesPerServer;

    private file: UAFile;
    private _openCount = 0;
    private _fileSize = 0;

    public static maxChunkSize = 16 * 1024 * 1024; // 16 MB

    public refreshFileContentFunc?: () => Promise<void>;

    constructor(options: FileOptions, file: UAFile) {
        this.file = file;
        this._fs = options.fileSystem || fsOrig;
        this.refreshFileContentFunc = options.refreshFileContentFunc;

        this.filename = options.filename;
        this.maxSize = options.maxSize ?? 0;
        this.mimeType = options.mimeType || "";
        this.maxChunkSizeBytes = options.maxChunkSize || FileTypeData.maxChunkSize;
        this.writable = options.writable ?? true;
        this.maxOpenFilesPerSession = options.maxOpenFilesPerSession ?? defaultMaxOpenFilesPerSession;
        this.maxOpenFilesPerServer = options.maxOpenFilesPerServer ?? defaultMaxOpenFilesPerServer;

        // openCount indicates the number of currently valid file handles on the file.
        this._openCount = 0;
        file.openCount.bindVariable(
            {
                get: () => new Variant({ dataType: DataType.UInt16, value: this._openCount })
            },
            true
        );
        file.openCount.minimumSamplingInterval = 0; // changes immediately

        const readFileSize = (): { size: number; timestamp: Date } => {
            const stat = (this._fs as AbstractFs).statSync(this.filename);

            const size = stat.size;
            const timestamp = stat.mtime;
            return { size, timestamp };
        };

        const data = this;
        file.size.bindVariable(
            {
                timestamped_get(): DataValue {
                    try {
                        const { size, timestamp } = readFileSize();
                        data.fileSize = size;
                        return new DataValue({
                            sourceTimestamp: timestamp,
                            serverTimestamp: new Date(),
                            value: new Variant({ dataType: DataType.UInt64, value: data._fileSize }),
                            statusCode: StatusCodes.Good
                        });
                    } catch (_err) {
                        return new DataValue({
                            serverTimestamp: new Date(),
                            statusCode: StatusCodes.BadDataUnavailable
                        });
                    }
                }
            },
            true
        );

        file.size.minimumSamplingInterval = 0; // changes immediately

        file.writable.bindVariable(
            {
                get: () => new Variant({ dataType: DataType.Boolean, value: this.writable })
            },
            true
        );
        file.userWritable.bindVariable(
            {
                timestamped_get_ctx: async ({ context }) =>
                    new DataValue({
                        serverTimestamp: new Date(),
                        value: new Variant({
                            dataType: DataType.Boolean,
                            value: this.writable && (!context || _hasWriteAccessRights(context, file))
                        }),
                        statusCode: StatusCodes.Good
                    })
            },
            true
        );

        this.refresh();
    }

    public set openCount(value: number) {
        this._openCount = value;
        this.file.openCount.touchValue();
    }

    public get openCount(): number {
        return this._openCount;
    }

    public set fileSize(value: number) {
        this._fileSize = value;
        this.file.size.touchValue();
    }

    public get fileSize(): number {
        return this._fileSize;
    }

    /**
     * refresh position and size
     * this method should be call by the server if the file
     * is modified externally
     *
     */
    public async refresh(): Promise<void> {
        const abstractFs = this._fs;

        // lauch an async request to update filesize
        await (async function extractFileSize(self: FileTypeData) {
            try {
                if (!abstractFs.existsSync(self.filename)) {
                    self._fileSize = 0;
                    return;
                }
                const stat = await promisify(abstractFs.stat)(self.filename);
                self._fileSize = stat.size;
                /* c8 ignore next */
                doDebug && debugLog("original file size ", self.filename, " size = ", self._fileSize);
            } catch (err) {
                self._fileSize = 0;
                if (types.isNativeError(err)) {
                    warningLog("Cannot access file ", self.filename, err.message);
                }
            }
        })(this);
    }

    public async refreshFileContent() {
        if (this.refreshFileContentFunc) {
            await this.refreshFileContentFunc();
            await this.refresh();
        }
    }
}

export async function writeFile(fileSystem: AbstractFs, filename: string, content: Buffer): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        fileSystem.open(filename, "w", (err, fd) => {
            /* c8 ignore next */
            if (err) {
                return reject(err);
            }
            fileSystem.write(fd, content, 0, content.length, 0, (err) => {
                /* c8 ignore next */
                if (err) {
                    return reject(err);
                }
                fileSystem.close(fd, (err) => {
                    /* c8 ignore next */
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        });
    });
}

/**
 * @private
 */
export interface UAFileEx extends UAFile {
    $fileData: FileTypeData;
}

/**
 * @orivate
 */
export function getFileData(opcuaFile2: UAFile): FileTypeData {
    return (opcuaFile2 as UAFileEx).$fileData;
}

function getFileDataFromContext(context: ISessionContext): FileTypeData {
    return getFileData(context.object as UAFile);
}

interface FileAccessData {
    handle: number;
    fd: number; // nodejs handler
    position: UInt64; // position in file
    size: number; // size
    openMode: OpenFileMode;
    sessionId: NodeId;
    fileData: FileTypeData;
}

interface FileTypeM {
    $$currentFileHandle: number;
    $$files: { [key: number]: FileAccessData };
    $$sessionsWithShutdownTask: WeakSet<ISessionBase>;
}

interface AddressSpacePriv extends IAddressSpace, FileTypeM {}
function _prepare(addressSpace: IAddressSpace): FileTypeM {
    const _context = addressSpace as AddressSpacePriv;
    _context.$$currentFileHandle = _context.$$currentFileHandle ? _context.$$currentFileHandle : 41;
    _context.$$files = _context.$$files || {};
    _context.$$sessionsWithShutdownTask = _context.$$sessionsWithShutdownTask || new WeakSet();
    return _context as FileTypeM;
}
function _getSessionId(context: ISessionContext) {
    if (!context.session) {
        return new NodeId();
    }
    assert(context.session?.getSessionId);
    return context.session?.getSessionId() || new NodeId();
}
function _addFile(addressSpace: IAddressSpace, context: ISessionContext, openMode: OpenFileMode, fileData: FileTypeData): UInt32 {
    const _context = _prepare(addressSpace);
    _context.$$currentFileHandle++;
    const fileHandle: number = _context.$$currentFileHandle;
    const sessionId = _getSessionId(context);
    const _fileData: FileAccessData = {
        fd: -1,
        handle: fileHandle,
        openMode,
        position: [0, 0],
        size: 0,
        sessionId,
        fileData
    };
    _context.$$files[fileHandle] = _fileData;

    return fileHandle;
}

function _getFileInfo(addressSpace: IAddressSpace, context: ISessionContext, fileHandle: UInt32): FileAccessData | null {
    const _context = _prepare(addressSpace);
    const _fileInfo = _context.$$files[fileHandle];
    const sessionId = _getSessionId(context);

    if (!_fileInfo || !sameNodeId(_fileInfo.sessionId, sessionId)) {
        errorLog("Invalid session ID this file descriptor doesn't belong to this session");
        return null;
    }
    return _fileInfo;
}

function _close(addressSpace: IAddressSpace, fileData: FileAccessData) {
    const _context = _prepare(addressSpace);
    delete _context.$$files[fileData.handle];
}

function _getFilesOfSession(addressSpace: IAddressSpace, sessionId: NodeId): FileAccessData[] {
    const _context = _prepare(addressSpace);
    return Object.values(_context.$$files).filter((f) => sameNodeId(f.sessionId, sessionId));
}

/**
 * The handle becomes invalid immediately. Thus a second release of the same handle, or a
 * call that comes while the file descriptor closes, cannot use the file descriptor.
 */
async function _releaseHandle(addressSpace: IAddressSpace, fileInfo: FileAccessData): Promise<void> {
    _close(addressSpace, fileInfo);
    const fd = fileInfo.fd;
    if (fd === -1) {
        return; // the file is not open yet: _openFile sees that the handle has gone, and closes it.
    }
    fileInfo.fd = -1;
    fileInfo.fileData.openCount -= 1;
    try {
        await promisify(fileInfo.fileData._fs.close)(fd);
    } catch (err) {
        if (types.isNativeError(err)) {
            errorLog("Close error : ", err.message);
        }
    }
}

/**
 * The fileHandle is valid while the Session is open (OPC 10000-20 4.2.2): when the Session
 * closes, release the handles that the client did not close.
 * One task per Session is sufficient. A task per handle would accumulate in a long-lived
 * Session that opens and closes files.
 */
function _releaseHandlesOnSessionClose(addressSpace: IAddressSpace, context: ISessionContext): void {
    const session = context.session;
    if (!session?.registerSessionShutdownTask) {
        return;
    }
    const _context = _prepare(addressSpace);
    if (_context.$$sessionsWithShutdownTask.has(session)) {
        return;
    }
    _context.$$sessionsWithShutdownTask.add(session);
    const sessionId = _getSessionId(context);
    session.registerSessionShutdownTask(async () => {
        await Promise.all(_getFilesOfSession(addressSpace, sessionId).map((f) => _releaseHandle(addressSpace, f)));
    });
}

function toNodeJSMode(opcuaMode: OpenFileMode): string {
    let flags: string;
    switch (opcuaMode) {
        case OpenFileMode.Read:
            flags = "r";
            break;
        case OpenFileMode.ReadWrite:
        case OpenFileMode.Write:
            flags = "r+";
            break;
        case OpenFileMode.ReadWriteAppend:
        case OpenFileMode.WriteAppend:
            flags = "a+";
            break;
        case OpenFileMode.WriteEraseExisting:
        case OpenFileMode.ReadWriteEraseExisting:
            flags = "w+";
            break;
        default:
            flags = "?";
            break;
    }
    return flags;
}

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
 *
 * Method Result Codes (defined in Call Service)
 *  Result Code         Description
 *  BadNotReadable      File might be locked and thus not readable.
 *  BadNotWritable      The file is locked and thus not writable, or the file is not writable.
 *  BadInvalidState
 *  BadInvalidArgument  Mode setting is invalid.
 *  BadNotFound .
 *  BadUnexpectedError
 *
 * OPC 10000-20 does not list these codes for this Method. OPC 10000-4 defines them in general:
 *  BadUserAccessDenied     The file is writable, but not for this user.
 *  BadResourceUnavailable  The Session, or all the Sessions, already hold the maximum number of file handles.
 *
 * @private
 */

async function _openFile(this: UAMethod, inputArguments: Variant[], context: ISessionContext): Promise<CallMethodResultOptions> {
    const addressSpace = this.addressSpace;
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

    // see https://nodejs.org/api/fs.html#fs_file_system_flags

    const flags = toNodeJSMode(mode);
    if (flags === "?") {
        errorLog(`Invalid mode ${OpenFileMode[mode]} (${mode})`);
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const fileData = getFileDataFromContext(context);

    // These checks come first: the file system call below erases the file if the mode asks for it.
    if ((mode & OpenFileModeMask.WriteBit) === OpenFileModeMask.WriteBit) {
        if (!fileData.writable) {
            return { statusCode: StatusCodes.BadNotWritable };
        }
        if (!_hasWriteAccessRights(context, context.object as UAFile)) {
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }
    }

    // An in-process caller has no Session: there is nothing to limit, and no Session close to wait for.
    if (
        context.session &&
        (_getFilesOfSession(addressSpace, _getSessionId(context)).length >= fileData.maxOpenFilesPerSession ||
            Object.keys(_prepare(addressSpace).$$files).length >= fileData.maxOpenFilesPerServer)
    ) {
        return { statusCode: StatusCodes.BadResourceUnavailable };
    }

    /**
     *  fileHandle (UInt32) A handle for the file used in other method calls indicating not the
     *            file (this is done by the Object of the Method call) but the access
     *            request and thus the position in the file. The fileHandle is generated
     *            by the server and is unique for the Session. Clients cannot transfer the
     *            fileHandle to another Session but need to get a new fileHandle by calling
     *            the Open Method.
     */
    const fileHandle = _addFile(addressSpace, context, mode as OpenFileMode, fileData);

    const _fileInfo = _getFileInfo(addressSpace, context, fileHandle);
    if (!_fileInfo) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    _releaseHandlesOnSessionClose(addressSpace, context);

    const filename = fileData.filename;

    const abstractFs = _getFileSystem(context);

    try {
        // make sure file is up to date ... by delegating
        if (mode === OpenFileMode.Read) {
            await fileData.refreshFileContent();
        }

        const fd = await promisify(abstractFs.open)(filename, flags);

        // The Session can close during the wait. Its shutdown task did not see this file descriptor.
        if (_prepare(addressSpace).$$files[fileHandle] !== _fileInfo) {
            await promisify(abstractFs.close)(fd);
            return { statusCode: StatusCodes.BadSessionClosed };
        }
        _fileInfo.fd = fd;
        fileData.openCount += 1;

        // update position
        _fileInfo.position = [0, 0];

        const fileLength = (await promisify(abstractFs.stat)(filename)).size;
        _fileInfo.size = fileLength;

        if ((mode & OpenFileModeMask.AppendBit) === OpenFileModeMask.AppendBit) {
            _fileInfo.position[1] = fileLength;
        }
        if ((mode & OpenFileModeMask.EraseExistingBit) === OpenFileModeMask.EraseExistingBit) {
            _fileInfo.size = 0;
        }
        fileData.fileSize = _fileInfo.size;
    } catch (err) {
        if (types.isNativeError(err)) {
            errorLog(err.message);
            errorLog(err.stack);
        }
        await _releaseHandle(addressSpace, _fileInfo);
        return { statusCode: StatusCodes.BadUnexpectedError };
    }

    // c8 ignore next
    doDebug && debugLog("Opening file handle ", fileHandle, "filename: ", fileData.filename, "openCount: ", fileData.openCount);

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

function _getFileSystem(context: ISessionContext): AbstractFs {
    const fs: AbstractFs = getFileDataFromContext(context)._fs;
    return fs;
}

/**
 * Close is used to close a file represented by a FileType.
 * When a client closes a file the handle becomes invalid.
 *
 * @param inputArguments
 * @param context
 * @private
 */
async function _closeFile(this: UAMethod, inputArguments: Variant[], context: ISessionContext): Promise<CallMethodResultOptions> {
    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    const _fileInfo = _getFileInfo(addressSpace, context, fileHandle);
    if (!_fileInfo) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const fileData = getFileDataFromContext(context);

    // c8 ignore next
    doDebug && debugLog("Closing file handle ", fileHandle, "filename: ", fileData.filename, "openCount: ", fileData.openCount);

    await _releaseHandle(addressSpace, _fileInfo);

    return {
        statusCode: StatusCodes.Good
    };
}

/**
 * Read is used to read a part of the file starting from the current file position.
 * The file position is advanced by the number of bytes read.
 *
 * @param inputArguments
 * @param context
 * @private
 */
async function _readFile(this: UAMethod, inputArguments: Variant[], context: ISessionContext): Promise<CallMethodResultOptions> {
    const addressSpace = this.addressSpace;

    const abstractFs = _getFileSystem(context);

    //  fileHandle A handle indicating the access request and thus indirectly the
    //  position inside the file.
    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    // Length Defines the length in bytes that should be returned in data, starting from the current
    // position of the file handle. If the end of file is reached all data until the end of the file is
    // returned.

    let length: Int32 = inputArguments[1].value as Int32;

    // Only positive values are allowed.
    if (length < 0) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const _fileInfo = _getFileInfo(addressSpace, context, fileHandle);
    if (!_fileInfo) {
        return { statusCode: StatusCodes.BadInvalidState };
    }
    if ((_fileInfo.openMode & OpenFileModeMask.ReadBit) === 0x0) {
        // open mode did not specify Read Flag
        return { statusCode: StatusCodes.BadInvalidState };
    }

    // Spec says that the the Server is allowed to return less data than specified length.
    //
    // In particular, we have to make sure that the number og bytes returned is not greater than
    // the maxChunkSizeBytes specified in the server configuration.
    // length cannot exceed maxChunkSizeBytes
    const fileData = getFileDataFromContext(context);

    const maxChunkSizeBytes = fileData.maxChunkSizeBytes;
    if (length > maxChunkSizeBytes) {
        length = maxChunkSizeBytes;
    }
    // length cannot either exceed ByteStream.maxChunkSizeBytes
    if (length > BinaryStream.maxByteStringLength) {
        length = BinaryStream.maxByteStringLength;
    }

    // length cannot either exceed transport OPCUA maxMessageLength - some margin.
    const maxMessageSize = getContextMaxMessageSize(context) - 1024;
    if (maxMessageSize > 0 && length > maxMessageSize) {
        length = maxMessageSize;
    }

    // length cannot either exceed remaining buffer size from current position
    length = Math.min(_fileInfo.size - _fileInfo.position[1], length);

    const data = Buffer.alloc(length);

    let ret = { bytesRead: 0 };
    try {
        // note: we do not util.promise here as it has a wierd behavior...
        ret = await new Promise((resolve, reject) =>
            abstractFs.read(_fileInfo.fd, data, 0, length, _fileInfo.position[1], (err, bytesRead, _buff) => {
                if (err) {
                    return reject(err);
                }
                return resolve({ bytesRead });
            })
        );
        _fileInfo.position[1] += ret.bytesRead;
    } catch (err) {
        if (types.isNativeError(err)) {
            errorLog("Read error : ", err.message);
        }
        return { statusCode: StatusCodes.BadUnexpectedError };
    }

    //   Data Contains the returned data of the file. If the ByteString is empty it indicates that the end
    //     of the file is reached.
    return {
        outputArguments: [{ dataType: DataType.ByteString, value: data.subarray(0, ret.bytesRead) }],
        statusCode: StatusCodes.Good
    };
}

async function _writeFile(this: UAMethod, inputArguments: Variant[], context: ISessionContext): Promise<CallMethodResultOptions> {
    const addressSpace = this.addressSpace;

    const abstractFs = _getFileSystem(context);

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    const _fileInfo = _getFileInfo(addressSpace, context, fileHandle);
    if (!_fileInfo) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    if ((_fileInfo.openMode & OpenFileModeMask.WriteBit) === 0x00) {
        // File has not been open with write mode
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const data: Buffer = inputArguments[1].value as Buffer;

    // Writing an empty or null ByteString returns Good without any effect on the file.
    if (!data || data.length === 0) {
        return { outputArguments: [], statusCode: StatusCodes.Good };
    }

    const fileData = getFileDataFromContext(context);

    // In append mode, the file system writes at the end of the file, whatever the position is.
    // The check and the size update stay in the same tick: a concurrent Write sees the new size.
    const isAppend = (_fileInfo.openMode & OpenFileModeMask.AppendBit) === OpenFileModeMask.AppendBit;
    const offset = isAppend ? fileData.fileSize : _positionToNumber(_fileInfo.position);
    if (fileData.maxSize > 0 && offset + data.length > fileData.maxSize) {
        return { statusCode: StatusCodes.BadOutOfRange };
    }
    if (isAppend) {
        fileData.fileSize = offset + data.length;
        _fileInfo.position = _numberToPosition(offset);
    }

    let ret = { bytesWritten: 0 };
    try {
        // note: we do not util.promise here as it has a wierd behavior...
        ret = await new Promise((resolve, reject) => {
            abstractFs.write(_fileInfo.fd, data, 0, data.length, _fileInfo.position[1], (err, bytesWritten) => {
                if (err) {
                    errorLog("Err", err);
                    return reject(err);
                }
                return resolve({ bytesWritten });
            });
        });
        assert(typeof ret.bytesWritten === "number");
        _fileInfo.position[1] += ret.bytesWritten;
        _fileInfo.size = Math.max(_fileInfo.size, _fileInfo.position[1]);

        // c8 ignore next
        doDebug && debugLog(fileData.fileSize);
        fileData.fileSize = Math.max(fileData.fileSize, _fileInfo.position[1]);
        // c8 ignore next
        doDebug && debugLog(fileData.fileSize);
    } catch (err) {
        if (types.isNativeError(err)) {
            errorLog("Write error : ", err.message);
        }
        await fileData.refresh();
        return { statusCode: StatusCodes.BadUnexpectedError };
    }

    return {
        outputArguments: [],
        statusCode: StatusCodes.Good
    };
}

function _positionToNumber(position: UInt64): number {
    return position[0] * 0x100000000 + position[1];
}

function _numberToPosition(value: number): UInt64 {
    return [Math.floor(value / 0x100000000), value % 0x100000000];
}

async function _setPositionFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;
    const position: UInt64 = inputArguments[1].value as UInt64;

    const _fileInfo = _getFileInfo(addressSpace, context, fileHandle);
    if (!_fileInfo) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    // If the position is higher than the file size, the position is set to the end of the file (OPC 10000-20 4.2.7).
    _fileInfo.position = _positionToNumber(position) > _fileInfo.size ? _numberToPosition(_fileInfo.size) : position;
    return { statusCode: StatusCodes.Good };
}

async function _getPositionFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    const _fileInfo = _getFileInfo(addressSpace, context, fileHandle);
    if (!_fileInfo) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    return {
        outputArguments: [
            {
                arrayType: VariantArrayType.Scalar,
                dataType: DataType.UInt64,
                value: _fileInfo.position
            }
        ],
        statusCode: StatusCodes.Good
    };
}

function install_method_handle_on_type(addressSpace: IAddressSpace): void {
    const fileType = addressSpace.findObjectType("FileType") as unknown as UAFile;
    if (fileType.open.isBound()) {
        return;
    }
    fileType.open.bindMethod(_openFile);
    fileType.close.bindMethod(_closeFile);
    fileType.read.bindMethod(_readFile);
    fileType.write.bindMethod(_writeFile);
    fileType.setPosition.bindMethod(_setPositionFile);
    fileType.getPosition.bindMethod(_getPositionFile);
}

/**
 * bind all methods of a UAFile OPCUA node
 * @param file the OPCUA Node that has a typeDefinition of FileType
 * @param options the options
 */
export function installFileType(_file: UAFile, options: FileOptions): void {
    const file = _file as UAFileEx;
    if (file.$fileData) {
        errorLog("File already installed ", file.nodeId.toString(), file.browseName.toString());
        return;
    }

    // make sure that FileType methods are also bound.
    install_method_handle_on_type(file.addressSpace);

    // to protect the server we setup a maximum limit in bytes on the file
    // if the client try to access or set the position above this limit
    // the server will return an error
    options.maxSize = options.maxSize === undefined ? defaultMaxSize : options.maxSize;

    const $fileData = new FileTypeData(options, file);
    file.$fileData = $fileData;

    // ----- install mime type
    if (options.mimeType) {
        if (file.mimeType) {
            file.mimeType.bindVariable({
                get: () => new Variant({ dataType: DataType.String, value: file.$fileData.mimeType })
            });
        }
    }

    file.open.bindMethod(_openFile);
    file.close.bindMethod(_closeFile);
    file.read.bindMethod(_readFile);
    file.write.bindMethod(_writeFile);
    file.setPosition.bindMethod(_setPositionFile);
    file.getPosition.bindMethod(_getPositionFile);
}
