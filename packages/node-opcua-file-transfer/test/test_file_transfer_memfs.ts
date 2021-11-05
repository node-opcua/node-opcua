import { AddressSpace, UAFile } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";

describe("FileTransfer with virtual file system", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        const xmlFiles = [nodesets.standard];
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("Own");
    });
    after(() => {
        addressSpace.dispose();
    });

    let opcuaFile: UAFile;
    let opcuaFile2: UAFile;

    it("should ", async () => {
        /** todo  */
    });
});
