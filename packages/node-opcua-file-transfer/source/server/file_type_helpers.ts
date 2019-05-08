import * as fs from "fs";
import {
    callbackify,
    promisify
} from "util";

import {
    AddressSpace,
    SessionContext,
    UAFileType,
    UAMethod
} from "node-opcua-address-space";
import { Byte, Int32, UInt32, UInt64 } from "node-opcua-basic-types";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

const debugLog = make_debugLog("FileType");
const errorLog = make_errorLog("FileType");
const doDebug = checkDebugFlag("FileType");

export interface FileOptions {
    maxSize?: number;
    mineType?: string; 
}

class FileTypeData {
    public filename: string = "";
    public maxSize: number = 0;
    public mimeType: string = "";

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

    private file: UAFileType;
    private _openCount: number = 0;
    private _fileSize: number = 0;

    constructor(file: UAFileType) {
        this.file = file;

        file.openCount.bindVariable({
            get: () => new Variant({ dataType: DataType.UInt16, value: this._openCount })
        }, true);
        file.openCount.minimumSamplingInterval = 0; // changed immediatly

        file.size.bindVariable({
            get: () => new Variant({ dataType: DataType.UInt64, value: this._fileSize })
        }, true);
        file.size.minimumSamplingInterval = 0; // changed immediatly

    }
}

interface FileAccessData {
    handle: number;
    fd: number; // nodejs handler
    position: UInt64; // position in file

}
interface FileTypeM {
    $$currentFileHandle: number;
    $$files: { [key: number]: FileAccessData };
}

function _prepare(addressSpace: AddressSpace, context: SessionContext): FileTypeM {

    const _context = addressSpace as any;
    _context.$$currentFileHandle = _context.$$currentFileHandle ? _context.$$currentFileHandle : 41;
    _context.$$files = _context.$$files || {};
    return _context as FileTypeM;
}

function _addFile(addressSpace: AddressSpace, context: SessionContext): UInt32 {
    const _context = _prepare(addressSpace, context);
    _context.$$currentFileHandle++;
    const fileHandle: number = _context.$$currentFileHandle;

    const _fileData: FileAccessData = {
        handle: fileHandle,
        fd: -1,
        position: [0, 0],
    };
    _context.$$files[fileHandle] = _fileData;

    return fileHandle;
}

function _getFile(addressSpace: AddressSpace, context: SessionContext, fileHandle: UInt32): FileAccessData {
    const _context = _prepare(addressSpace, context);
    return _context.$$files[fileHandle];
}

function _close(addressSpace: AddressSpace, context: SessionContext, fileData: FileAccessData) {
    const _context = _prepare(addressSpace, context);
    delete _context.$$files[fileData.fd];
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
 *  BadNotWritable      The file is locked and thus not writable.
 *  BadInvalidState
 *  BadInvalidArgument  Mode setting is invalid.
 *  BadNotFound .
 *  BadUnexpectedError
 *
 * @private
 */

async function _openFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

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
    let flags: string;
    let modeNodejs: number;
    switch (mode) {
        case 1:
            // r Open file for reading. An exception occurs if the file does not exist
            flags = "r";
            modeNodejs = fs.constants.O_RDONLY;
            break;
        case 2:
            //  w Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
            flags = "w";
            modeNodejs = fs.constants.O_WRONLY;
            break;
        case 1 + 2: // bit 0 & 1
            // w+ Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
            flags = "w+";
            modeNodejs = fs.constants.O_RDWR;
            break;
        case 4: // bit 2
            return { statusCode: StatusCodes.BadInvalidArgument };
            break;

        case 8: // bit 3 - Append
            // 'a' - Open file for appending. The file is created if it does not exist.
            // 'a+' Open file for reading and appending. The file is created if it does not exist.
            return { statusCode: StatusCodes.BadInvalidArgument };
            break;

        default:
            // this combination of flags is not supported
            return { statusCode: StatusCodes.BadInvalidArgument };
            break;
    }

    /**
     *  fileHandle (UInt32) A handle for the file used in other method calls indicating not the
     *            file (this is done by the Object of the Method call) but the access
     *            request and thus the position in the file. The fileHandle is generated
     *            by the server and is unique for the Session. Clients cannot transfer the
     *            fileHandle to another Session but need to get a new fileHandle by calling
     *            the Open Method.
     */
    const fileHandle = _addFile(addressSpace, context);

    const _fileData = _getFile(addressSpace, context, fileHandle);

    const data = (context.object as any).$data as FileTypeData;
    const filename = data.filename;

    try {
        _fileData.fd = await promisify(fs.open)(filename, flags, modeNodejs);
        _fileData.position = [0, 0];
        data.openCount += 1;

    } catch (err) {
        return { statusCode: StatusCodes.BadUnexpectedError };
    }

    debugLog("Opening file handle ", fileHandle, "filename: ", data.filename, "openCount: ", data.openCount);

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

/**
 * Close is used to close a file represented by a FileType.
 * When a client closes a file the handle becomes invalid.
 *
 * @param inputArguments
 * @param context
 * @private
 */
async function _closeFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {


    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    const _fileData = _getFile(addressSpace, context, fileHandle);
    if (!_fileData) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    const data = (context.object as any).$data as FileTypeData;

    debugLog("Closing file handle ", fileHandle, "filename: ", data.filename, "openCount: ", data.openCount);

    await promisify(fs.close)(_fileData.fd);
    _close(addressSpace, context, _fileData);
    data.openCount -= 1;

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
async function _readFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    const addressSpace = this.addressSpace;

    //  fileHandle A handle indicating the access request and thus indirectly the
    //  position inside the file.
    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    // Length Defines the length in bytes that should be returned in data, starting from the current
    // position of the file handle. If the end of file is reached all data until the end of the file is
    // returned. The Server is allowed to return less data than specified length.
    const length: Int32 = inputArguments[1].value as Int32;

    // Only positive values are allowed.
    if (length < 0) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const _fileData = _getFile(addressSpace, context, fileHandle);
    if (!_fileData) {
        return { statusCode: StatusCodes.BadInvalidState };
    }

    const data = Buffer.alloc(length);

    let ret;
    try {
        ret = await promisify(fs.read)(_fileData.fd, data, 0, length, _fileData.position[1]);
        _fileData.position[1] += ret.bytesRead;
    } catch (err) {
        return { statusCode: StatusCodes.BadUnexpectedError };
    }

    //   Data Contains the returned data of the file. If the ByteString is empty it indicates that the end
    //     of the file is reached.
    return {
        outputArguments: [
            { dataType: DataType.ByteString, value: data.slice(0, ret.bytesRead) }
        ],
        statusCode: StatusCodes.Good
    };
}

async function _writeFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    const _fileData = _getFile(addressSpace, context, fileHandle);
    if (!_fileData) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    return { statusCode: StatusCodes.BadNotImplemented };
}

async function _setPositionFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;
    const position: UInt64 = inputArguments[1].value as UInt64;

    const _fileData = _getFile(addressSpace, context, fileHandle);
    if (!_fileData) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    _fileData.position = position;
    return { statusCode: StatusCodes.Good };
}

async function _getPositionFile(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext
): Promise<CallMethodResultOptions> {

    const addressSpace = this.addressSpace;

    const fileHandle: UInt32 = inputArguments[0].value as UInt32;

    const _fileData = _getFile(addressSpace, context, fileHandle);
    if (!_fileData) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    return {
        outputArguments: [{
            arrayType: VariantArrayType.Scalar,
            dataType: DataType.UInt64,
            value: _fileData.position
        }],
        statusCode: StatusCodes.Good
    };
}

export const defaultMaxSize = 100000000;

export function installFileType(
    file: UAFileType,
    filename: string,
    options?: FileOptions
) {

    if ((file as any).$data) {
        errorLog("File already installed ", file.nodeId.toString(), file.browseName.toString());
        return;
    }
    options = options || {};

    // to protect the server we setup a maximum limite in bytes on the file
    // if the client try to access or set the position above this limit
    // the server will return an error
    options.maxSize = (options.maxSize === undefined) ? defaultMaxSize : options.maxSize;

    const $data = new FileTypeData(file);
    $data.filename = filename;
    $data.maxSize = options.maxSize!;
    $data.mimeType = options.mineType || "";
    // openCount indicates the number of currently valid file handles on the file.
    $data.openCount = 0;

    (file as any).$data = $data;

    // ----- install size
    if (options.mineType) {
        if (file.mimeType) {
            file.mimeType.bindVariable({
                get: () => (file as any).$fileOptions.mineType
            });
        }
    }

    file.open.bindMethod(callbackify(_openFile));
    file.close.bindMethod(callbackify(_closeFile));
    file.read.bindMethod(callbackify(_readFile));
    file.write.bindMethod(callbackify(_writeFile));
    file.setPosition.bindMethod(callbackify(_setPositionFile));
    file.getPosition.bindMethod(callbackify(_getPositionFile));

}
