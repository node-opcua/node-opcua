import {
    generateAddressSpace,
    AddressSpace
} from "node-opcua-address-space";




export interface BuildModelOptions {
    version: string;
    namespaceUri: string;
    xmlFiles: string[];
    createModel: (addressSpace: AddressSpace) => void;
};


export async function buildModel(data: BuildModelOptions): Promise<string> {
    try {
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, data.xmlFiles);
        // workarround)
        (addressSpace as any)._private_namespaceIndex = 2;
        const ns = addressSpace.registerNamespace(data.namespaceUri);
        //xx console.log("own namespace = ", addressSpace.getOwnNamespace().index);
        //xx console.log("    namespace = ", ns.index);
        data.createModel(addressSpace);
        const xmlModel = ns.toNodeset2XML();
        addressSpace.dispose();
        return xmlModel;
    } catch (err) {
        console.log("Error", err);
        throw err;
    }
}

