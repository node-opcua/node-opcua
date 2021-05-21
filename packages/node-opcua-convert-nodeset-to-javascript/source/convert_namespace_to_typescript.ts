import * as path from "path";
import * as fs from "fs";

import { ReferenceDescriptionEx, walkThroughDataTypes, walkThroughObjectTypes, walkThroughVariableTypes } from "./walk_through";
import { convertTypeToTypescript } from "./convert_to_typescript";
import { Cache, Cache2, constructCache } from "./cache";
import { IBasicSession } from "node-opcua-pseudo-session";


export async function convertNamespaceTypeToTypescript(session: IBasicSession, namespaceIndex: number, cache?: Cache2) {
    
    if (!cache) {
        cache = await constructCache(session);
    }

    // walk through all Types:
    const nodeVisitor = {
        async visit(reference: ReferenceDescriptionEx, level: number): Promise<void> {
            //   console.log(getTypescriptFile(reference.browseName, cache!));

            cache!.resetRequire();

            const { content, folder, filename } = await convertTypeToTypescript(session, reference.nodeId, cache!);
            const _f = path.join(__dirname, "../tmp/" + folder);
            if (!fs.existsSync(_f)) {
                fs.mkdirSync(_f);
            }
            fs.writeFileSync(path.join(_f, filename + ".ts"), content);
        }
    };

    await walkThroughObjectTypes(session, nodeVisitor);

    await walkThroughVariableTypes(session, nodeVisitor);

    await walkThroughDataTypes(session, nodeVisitor);
}
