import { NodesetName, nodesets as nodesets1 } from "./index";

const nodesets = <Record<NodesetName, string>>{};
for (const name in Object.values(nodesets1)) {
    nodesets[name as NodesetName] = `nodeset:${name}`;
}

module.exports = {
    nodesets
};
