import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AddressSpace, type BaseNode, childAccessorNamesShadowedBy, PseudoSession, type UAObject } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { NodeClass } from "node-opcua-data-model";
import { constructNodesetFilename, nodesetCatalog } from "node-opcua-nodesets";

import { convertNamespaceTypeToTypescript } from "./convert_namespace_to_typescript.js";
import { packagesFolder } from "./package_root.js";
import { cleanUpTypescriptModule } from "./remove_unused.js";
import { updateParentTSConfig } from "./update_parent_tsconfig.js";
import { setChildAccessorShadowing } from "./utils2.js";

async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let cursor = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (true) {
            const idx = cursor++;
            if (idx >= items.length) return;
            await fn(items[idx]);
        }
    });
    await Promise.all(workers);
}

async function main() {
    const addressSpace = AddressSpace.create();

    const xmlFiles = nodesetCatalog.map((set) => constructNodesetFilename(set.xmlFile));
    await generateAddressSpace(addressSpace, xmlFiles);

    // the names a generated interface must escape are the ones the runtime cannot expose on a
    // node of that class, read off a node of each class rather than listed here
    const server = addressSpace.rootFolder.objects.getFolderElementByName("Server") as UAObject | null;
    const sampleNode: Partial<Record<NodeClass, BaseNode | null | undefined>> = {
        [NodeClass.Object]: server,
        [NodeClass.Variable]: server?.getPropertyByName("NamespaceArray"),
        [NodeClass.Method]: server?.getMethodByName("GetMonitoredItems")
    };
    const shadowedByClass = new Map<NodeClass, ReadonlySet<string>>();
    setChildAccessorShadowing((nodeClass) => {
        let shadowed = shadowedByClass.get(nodeClass);
        if (!shadowed) {
            const node = sampleNode[nodeClass];
            if (!node) {
                return undefined;
            }
            shadowed = childAccessorNamesShadowedBy(node);
            shadowedByClass.set(nodeClass, shadowed);
        }
        return shadowed;
    });

    const session = new PseudoSession(addressSpace);
    const options = {
        baseFolder: packagesFolder,
        prefix: "node-opcua-nodeset-"
    };
    // const nodesetCatalog2 = nodesetCatalog.filter((meta) => meta.name == "scales");

    // Phase 1: convert each namespace sequentially.
    // The convert step writes type files into whichever package the type
    // *originates* in, not the namespace being processed. Two namespaces
    // running in parallel will both try to write e.g. node-opcua-nodeset-ua
    // files concurrently, causing Windows ERROR_SHARING_VIOLATION.
    for (const meta of nodesetCatalog) {
        const index = addressSpace.getNamespaceIndex(meta.uri);
        if (index === -1) {
            console.log("namespace not found", meta.uri);
            continue;
        }
        await convertNamespaceTypeToTypescript(session, index, {
            ...options,
            nsName: meta.name
        });
    }

    // Phase 2: clean up imports in every nodeset package that actually has a
    // source/ folder on disk. This covers cases where a catalog entry name
    // doesn't line up with its package folder (e.g. catalog "standard" writes
    // into node-opcua-nodeset-ua).
    const folders = fs
        .readdirSync(options.baseFolder)
        .filter((name) => name.startsWith(options.prefix))
        .map((name) => path.join(options.baseFolder, name))
        .filter((p) => fs.existsSync(path.join(p, "source")));

    const concurrency = Math.max(2, Math.min(os.cpus().length, 12));
    console.log(`tidying imports across ${folders.length} packages with concurrency=${concurrency}`);
    await runWithConcurrency(folders, concurrency, cleanUpTypescriptModule);
    await updateParentTSConfig();
}
void main();
