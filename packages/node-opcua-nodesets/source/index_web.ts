import { NodesetName, nodesetCatalog, NodesetMeta } from "./nodeset_catalog";


export const allNodesetMeta: NodesetMeta[] = nodesetCatalog.map(([name, packageSuffix, uri, xmlFileName, _requiredModels]) => ({
    name,
    packageName: `<not implemented>`,
    uri,
    xmlFile: "<not implemented>"
}));

export const nodesets = <Record<NodesetName, string>>{};
for (const array in nodesetCatalog) {
    const [name] = array;
    nodesets[name as NodesetName] = `nodeset:${name}`;
}
export * from "./nodeset_catalog";
