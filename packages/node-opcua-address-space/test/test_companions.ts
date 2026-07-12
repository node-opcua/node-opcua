import "should";
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

    it("LADS", async () => {
        const addressSpace = AddressSpace.create();

        const xmlFiles = [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.machinery,
            nodesets.amb,
            nodesets.lads
        ];
        await generateAddressSpace(addressSpace, xmlFiles);

        const nsIndex = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/LADS/");
        nsIndex.should.not.eql(-1);

        addressSpace.dispose();
    });

    it("I4AAS", async () => {
        const addressSpace = AddressSpace.create();

        const xmlFiles = [nodesets.standard, nodesets.i4aas];
        await generateAddressSpace(addressSpace, xmlFiles);

        const nsIndex = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/I4AAS/");
        nsIndex.should.not.eql(-1);

        addressSpace.dispose();
    });

    it("Weihenstephan", async () => {
        const addressSpace = AddressSpace.create();

        const xmlFiles = [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.machinery,
            nodesets.packML,
            nodesets.weihenstephan
        ];
        await generateAddressSpace(addressSpace, xmlFiles);

        const nsIndex = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Weihenstephan/");
        nsIndex.should.not.eql(-1);

        addressSpace.dispose();
    });
});
