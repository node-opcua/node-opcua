import fs from "node:fs";
import type { Namespace } from "node-opcua-address-space";
import { type BuildDocumentationOptions, buildDocumentationToString } from "../dist/index.js";

export async function buildDocumentationToFile(namespace: Namespace, _filename: string, options?: BuildDocumentationOptions) {
    const str = await buildDocumentationToString(namespace, options);
    const stream = fs.createWriteStream("documentation.md");
    stream.write(str);
    await new Promise<void>((resolve) => {
        stream.on("finish", resolve);
        stream.end();
    });
}
