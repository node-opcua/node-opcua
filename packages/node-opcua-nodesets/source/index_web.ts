import { type NodesetMeta, type NodesetName, nodesetCatalog } from "./nodeset_catalog.js";

export const allNodesetMeta: NodesetMeta[] = nodesetCatalog.map(({ name, uri, dependencies, licence }) => ({
    name,
    packageName: `<not implemented>`,
    uri,
    xmlFile: "<not implemented>",
    licence: licence,
    dependencies: dependencies.map((dep) => dep as NodesetName)
}));

export const nodesets = <Record<NodesetName, string>>{};
for (const { name } of nodesetCatalog) {
    nodesets[name] = `nodeset:${name}`;
}

export * from "./nodeset_catalog.js";
