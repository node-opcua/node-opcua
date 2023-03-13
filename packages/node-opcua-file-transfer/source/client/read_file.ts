import { coerceInt32 } from "node-opcua-basic-types";
import { IClientFile, OpenFileMode } from "./client_file";

export async function readFile(clientFile: IClientFile): Promise<Buffer> {
    await clientFile.open(OpenFileMode.Read);
    try {
        const fileSize = coerceInt32(await clientFile.size());
        /**
         *  Read file 
         */
        const data = await clientFile.read(fileSize);
        if (data.length >= fileSize) {
            // everything has been read
            return data;
        }

        // wee need to loop to complete the read
        const chunks = [data];
        let remaining = fileSize - data.length;
        while (remaining > 0) {
            const buf = await clientFile.read(remaining);
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
