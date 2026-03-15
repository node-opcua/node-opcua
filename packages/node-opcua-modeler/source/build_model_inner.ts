import { AddressSpace, generateAddressSpaceRaw, type NodeIdManager, type XmlLoaderAsyncFunc } from "node-opcua-address-space";
import { buildDocumentationToString } from "./generate_markdown_doc";
import type { Symbols } from "./symbol";

export interface BuildModelOptionsBase {
    version: string;
    namespaceUri: string;
    xmlFiles: string[];
    createModel: /*async*/ (addressSpace: AddressSpace) => Promise<void>;
    presetSymbols?: Symbols;
}
export interface BuildModelOptions extends BuildModelOptionsBase {
    xmlLoader: XmlLoaderAsyncFunc;
}

export async function buildModelInner(data: BuildModelOptions): Promise<{ markdown: string; xmlModel: string; symbols: Symbols }> {
    try {
        const addressSpace = AddressSpace.create();

        // create own namespace (before loading other xml files)
        const ns = addressSpace.registerNamespace(data.namespaceUri);

        const nodeIdManager = (ns as unknown as { _nodeIdManager: NodeIdManager })._nodeIdManager;
        if (data.presetSymbols) {
            nodeIdManager.setSymbols(data.presetSymbols);
        }

        await generateAddressSpaceRaw(addressSpace, data.xmlFiles, data.xmlLoader, {});

        (addressSpace.getOwnNamespace() as unknown as { registerSymbolicNames: boolean }).registerSymbolicNames = true;
        await data.createModel(addressSpace);
        (addressSpace.getOwnNamespace() as unknown as { registerSymbolicNames: boolean }).registerSymbolicNames = false;

        const xmlModel = ns.toNodeset2XML();
        const symbols = nodeIdManager.getSymbols();
        const doc = await buildDocumentationToString(ns, {});
        addressSpace.dispose();

        return { xmlModel, symbols, markdown: doc };
    } catch (err) {
        console.log("Error", err);
        throw err;
    }
}
