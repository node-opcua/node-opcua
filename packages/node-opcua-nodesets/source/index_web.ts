import { NodesetName } from './index';

const nodesets = <Record<NodesetName, string>> {};
for (const key in NodesetName) {
    const name = NodesetName[<NodesetName>key];
    nodesets[name] = `nodeset:${name}`;
}

module.exports = {
    nodesets
};
