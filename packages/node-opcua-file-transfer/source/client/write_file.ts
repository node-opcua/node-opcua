import * as fs from "node:fs";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { AttributeIds, StatusCode, StatusCodes } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { VariableIds } from "node-opcua-constants";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { IClientFile, OpenFileMode } from "./client_file";
import { readMaxByteStringLength } from "./read_max_byte_string_length";

const debugLog = make_debugLog("FileType");
// const errorLog = make_errorLog("FileType");
// const warningLog = make_warningLog("FileType");
const doDebug = checkDebugFlag("FileType");

function getTransportMaxMessageSize(session: IBasicSession): number {
    return session.getTransportSettings ? session.getTransportSettings().maxMessageSize : 0;
}

export async function writeOPCUAFile(clientFile: IClientFile, filePath: string, { chunkSize }: { chunkSize?: number }) {
    const maxMessageSize = getTransportMaxMessageSize(clientFile.session);

    chunkSize = chunkSize === undefined ? await readMaxByteStringLength(clientFile.session) : chunkSize;
    chunkSize = Math.min(chunkSize, BinaryStream.maxByteStringLength);
    if (maxMessageSize > 200) {
        chunkSize = Math.min(chunkSize, maxMessageSize - 1000);
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
    }
    const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
    await clientFile.open(OpenFileMode.WriteEraseExisting);
    await clientFile.setPosition(0);
    try {
        const outStream = new Writable({
            write(chunk, encoding, callback) {
                doDebug && debugLog("writing chunk", chunk.length);
                clientFile
                    .write(chunk)
                    .then(() => callback())
                    .catch((err) => callback(err));
            }
        });
        // note: pipeline requires NodeJS 15 or above
        await pipeline(readStream, outStream);
    } catch (e) {
        debugLog((e as Error).message);
        throw e;
    } finally {
        doDebug && debugLog("closing the OPCUA File");
        await clientFile.close();
    }
}
