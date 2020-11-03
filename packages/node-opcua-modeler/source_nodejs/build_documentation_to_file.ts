import * as fs from "fs";
import { Namespace } from "node-opcua-address-space";
import { buildDocumentationToString } from "..";

export async function buildDocumentationToFile(namespace: Namespace, filename: string) {
    const str = await buildDocumentationToString(namespace);
    const stream = fs.createWriteStream("documentation.md");
    stream.write(str);
    await new Promise((resolve) => {
        stream.on("finish", resolve);
        stream.end();
    });
}
