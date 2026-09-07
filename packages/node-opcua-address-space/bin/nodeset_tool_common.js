/**
 * What the nodeset command line tools share: resolving the files a document requires, and the
 * shape of a NodesetSource over a file on disk.
 */
const fs = require("node:fs");
const path = require("node:path");
const { preLoad } = require("../dist/api/index.js");
const { readNodeSet2XmlFile } = require("../distNodeJS/index.js");

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/** a NodeSet2 file as the loader takes it: named, and read whole when asked for */
const asFile = (file) => ({ name: file, source: () => [new Uint8Array(fs.readFileSync(file))] });

const imageFileOf = (file, outDir) => {
    const base = path.basename(file).replace(/\.xml$/i, "");
    return path.join(outDir ?? path.dirname(file), `${base}.ndjson.gz`);
};

/** the files `file` requires, in load order, from the node-opcua-nodesets catalog and `requireFiles` */
async function dependencyChain(file, requireFiles = []) {
    let catalog = [];
    let nodesets = {};
    try {
        ({ nodesetCatalog: catalog, nodesets } = require("node-opcua-nodesets"));
    } catch {
        /* the catalog is optional */
    }
    const known = new Map(); // model uri -> file
    for (const meta of catalog) {
        if (nodesets[meta.name] && fs.existsSync(nodesets[meta.name])) known.set(meta.uri, nodesets[meta.name]);
    }
    for (const required of requireFiles) {
        const [desc] = await preLoad([required], readNodeSet2XmlFile);
        for (const model of desc.namespaceModel.models) known.set(model.modelUri, required);
    }
    const order = [];
    const visit = async (f) => {
        const [desc] = await preLoad([f], readNodeSet2XmlFile);
        for (const model of desc.namespaceModel.models) {
            for (const required of model.requiredModel) {
                const dependency = known.get(required.modelUri);
                if (!dependency) {
                    throw new Error(
                        `${path.basename(f)} requires ${required.modelUri}: not in the catalog, pass it with --require`
                    );
                }
                if (!order.includes(dependency) && dependency !== f) await visit(dependency);
            }
        }
        if (!order.includes(f)) order.push(f);
    };
    await visit(file);
    return order;
}

module.exports = { asFile, dependencyChain, imageFileOf, kb };
