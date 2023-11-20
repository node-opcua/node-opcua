import { coerceInt32 } from "node-opcua-basic-types";
import { IClientFile, OpenFileMode } from "./client_file";
import { readMaxByteStringLength } from "./read_max_byte_string_length";
import { ISessionWithTransportSettings, getTransportMaxMessageSize } from "./get_transport_max_size";



export async function readFile(clientFile: IClientFile, options?: { chunkSize?: number }): Promise<Buffer> {
    options = options || { chunkSize: await readMaxByteStringLength(clientFile.session) };
    let maxBlockSize = options.chunkSize || 1024;
    const transportMaxSize = getTransportMaxMessageSize(clientFile.session as ISessionWithTransportSettings);
    maxBlockSize = transportMaxSize > 0 ? Math.min(maxBlockSize, transportMaxSize) : maxBlockSize;

    await clientFile.open(OpenFileMode.Read);
    try {
        const fileSize = coerceInt32(await clientFile.size());
        /**
         *  Read file
         */
        const data = await clientFile.read(Math.min(fileSize, maxBlockSize));
        if (data.length >= fileSize) {
            // everything has been read
            return data;
        }

        // wee need to loop to complete the read
        const chunks = [data];
        let remaining = fileSize - data.length;
        while (remaining > 0) {
            const buf = await clientFile.read(Math.min(remaining, maxBlockSize));
            if (buf.length === 0) break;
            chunks.push(buf);
            remaining -= buf.length;
        }
        return Buffer.concat(chunks);
    } finally {
        await clientFile.close();
    }
}

export async function readOPCUAFile(clientFile: IClientFile): Promise<Buffer> {
    return await readFile(clientFile);
}
