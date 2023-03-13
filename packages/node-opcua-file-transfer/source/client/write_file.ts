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

const debugLog = make_debugLog("FileType");
// const errorLog = make_errorLog("FileType");
// const warningLog = make_warningLog("FileType");
const doDebug = checkDebugFlag("FileType");

async  function readMaxByteStringLength(session: IBasicSession) {
    const dataValue = await session.read({
        nodeId: resolveNodeId(VariableIds.Server_ServerCapabilities_MaxByteStringLength),
        attributeId: AttributeIds.Value
    });
    if (dataValue.statusCode !== StatusCodes.Good) {
        return 1024;
    }
    return dataValue.value.value || BinaryStream.maxByteStringLength;
}

export async function writeOPCUAFile(clientFile: IClientFile, filePath: string, { chunkSize }: { chunkSize?: number }) {

    const maxByteStringLength = chunkSize === undefined ? await readMaxByteStringLength(clientFile.session) : chunkSize;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
    }
    const readStream = fs.createReadStream(filePath, { highWaterMark: maxByteStringLength });
    await clientFile.open(OpenFileMode.WriteEraseExisting);
    await clientFile.setPosition(0);
    try {
        const outStream = new Writable({
            write(chunk, encoding, callback) {
                doDebug && debugLog("writing chunk", chunk.length);
                clientFile.write(chunk).then(() => callback()).catch((err)=>callback(err));
            }
          });   
          // note: pipeline requires NodeJS 15 or above       
          await pipeline(readStream, outStream);

    } catch (e) {
        debugLog((e as Error).message);
        throw e;
    }
    finally {
        doDebug && debugLog("closing the OPCUA File");
        await clientFile.close();
    }
}