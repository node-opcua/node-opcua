import * as path from "path";
import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { allNodesetMeta } from "node-opcua-nodesets";
import { convertNamespaceTypeToTypescript } from "./convert_namespace_to_typescript";
import { updateParentTSConfig } from './update_parent_tsconfig';

async function main() {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, allNodesetMeta.map((set) => set.xmlFile));

    const session = new PseudoSession(addressSpace);
    const options = {
        baseFolder: path.join(__dirname, "../../"),
        prefix: "node-opcua-nodeset-"
    };
    await Promise.all(allNodesetMeta.map((meta) =>
        convertNamespaceTypeToTypescript(session, addressSpace.getNamespaceIndex(meta.uri), {
            ...options,
            nsName: meta.name,
        })
    ));
    await updateParentTSConfig();
}
void main();
