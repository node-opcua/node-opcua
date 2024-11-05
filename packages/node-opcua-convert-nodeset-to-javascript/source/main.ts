import path from "path";
import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { constructNodesetFilename, nodesetCatalog } from "node-opcua-nodesets";
import { convertNamespaceTypeToTypescript } from "./convert_namespace_to_typescript";
import { updateParentTSConfig } from './update_parent_tsconfig';

async function main() {
    const addressSpace = AddressSpace.create();

    const xmlFiles = nodesetCatalog.map((set) => constructNodesetFilename(set.xmlFile));
    await generateAddressSpace(addressSpace, xmlFiles);

    const session = new PseudoSession(addressSpace);
    const options = {
        baseFolder: path.join(__dirname, "../../"),
        prefix: "node-opcua-nodeset-",
    };
    await Promise.all(nodesetCatalog.map((meta) => {
        const index = addressSpace.getNamespaceIndex(meta.uri);
        if (index === -1) {
            console.log("namespace not found", meta.uri);
            return;
        }
        convertNamespaceTypeToTypescript(session, index, {
            ...options,
            nsName: meta.name,
        })
    }
    ));
    await updateParentTSConfig();
}
void main();
