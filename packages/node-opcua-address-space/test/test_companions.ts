import { nodesets } from "node-opcua-nodesets";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("Companion ", () => {
    it("Kitchen", async () => {
        const addressSpace = AddressSpace.create();

        const xmlFiles = [nodesets.standard, nodesets.di, nodesets.commercialKitchenEquipment];
        await generateAddressSpace(addressSpace, xmlFiles);

        addressSpace.dispose();
    });
});
