
import fs from "fs";
import path from "path";
import { NodesetMeta, NodesetName, nodesetCatalog } from "./nodeset_catalog";

export function constructNodesetFilename(filename: string) {
    const dirname = __dirname;
    let file = path.join(dirname, "../nodesets", filename);
    if (!fs.existsSync(file)) {
        if (!process.argv[1]) {
            throw new Error(
                `cannot find file ${file}\nPlease make sure that nodeset can be found in ${path.join(dirname, "../nodesets")}`
            );
        }
        // let's find alternate places where to find the nodeset folder
        let appFolder = path.dirname(process.argv[1]);
        file = path.join(appFolder, "nodesets", filename);
        if (!fs.existsSync(file)) {
            appFolder = process.cwd();
            file = path.join(appFolder, "nodesets", filename);
        }
    }
    return file;
}


// Note: The ordering of these items is not arbitrary since we map this to generate nodesets export.
//       First, we want to ensure that any dependencies of a nodeset are loaded first (precede it in the array).
//       Second, we want to preserve the historical order since this will affect the namespace indices generated
//       when converting to TypeScript. (Not necessarily crucial but would otherwise generate noise in git diffs.)
//       (This order was taken from packages/node-opcua-convert-nodeset-to-javascript/source/main.ts)
//
//       The array after the namespace URI captures the RequiredModels from the NodeSet2.xml for reference.
//       These are not actually used by the program (or exposed as API) but can be helpful for humans checking
//       the order of the items in this list.
//       All nodesets other than "standard" are assumed to depend on "standard" being loaded first, so NodesetName.standard is omitted.
//       By ensuring that dependencies are listed first, one can safely pass a mapping of this entire array
//       as OPCUAServerOptions.nodeset_filename (e.g. when constructing `new OPCUAServer(...)`) without
//       causing an error due to ordering.

export const nodesets = nodesetCatalog.reduce(
    (nodesetMap, meta) => {
        nodesetMap[meta.name] = constructNodesetFilename(meta.xmlFile);
        return nodesetMap;
    },
    <Record<NodesetName, string>>{}
);

export interface NodeSetMetaSummary {
    packageName: string;
    uri: string;
    xmlFile: string;
}
export function makeNodeSetEntry(meta: NodesetMeta): NodeSetMetaSummary {
    return {
        packageName: `node-opcua-nodeset-${meta.packageName}`,
        uri: meta.uri,
        xmlFile: constructNodesetFilename(meta.xmlFile)
    };
}
export const allNodesetMeta: NodeSetMetaSummary[] = nodesetCatalog.map(makeNodeSetEntry);
