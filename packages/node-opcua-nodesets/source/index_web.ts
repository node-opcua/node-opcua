import { NodesetName, nodesetCatalog, NodesetMeta } from "./nodeset_catalog";


export const allNodesetMeta: NodesetMeta[] = nodesetCatalog.map(({
    name, packageName, uri, xmlFile, dependencies, licence}) => ({
    name,
    packageName: `<not implemented>`,
    uri,
    xmlFile: "<not implemented>",
    licence: licence,
    dependencies: dependencies.map((dep) => dep as NodesetName)
}));

export const nodesets = <Record<NodesetName, string>>{};
for (const array in nodesetCatalog) {
    const [name] = array;
    nodesets[name as NodesetName] = `nodeset:${name}`;
}
export * from "./nodeset_catalog";
