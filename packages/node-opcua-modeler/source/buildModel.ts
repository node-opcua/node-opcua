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

        // create own namespace (before loading other xml files)
        const ns = addressSpace.registerNamespace(data.namespaceUri);

        await generateAddressSpace(addressSpace, data.xmlFiles);

        data.createModel(addressSpace);
        const xmlModel = ns.toNodeset2XML();
        addressSpace.dispose();
        return xmlModel;
    } catch (err) {
        console.log("Error", err);
        throw err;
    }
}

