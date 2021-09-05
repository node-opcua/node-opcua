import { 
    AddressSpace, 
    Namespace, NodeIdManager, XmlLoaderFunc, generateAddressSpaceRaw } from "node-opcua-address-space";
import { buildDocumentationToString } from "./generate_markdown_doc";
import { Symbols } from "./symbol";

export interface BuildModelOptionsBase {
    version: string;
    namespaceUri: string;
    xmlFiles: string[];
    createModel: /*async*/ (addressSpace: AddressSpace) => Promise<void>;
    presetSymbols?: Symbols;
}
export interface BuildModelOptions extends BuildModelOptionsBase {
    xmlLoader: XmlLoaderFunc;
}

export async function buildModelInner(data: BuildModelOptions): Promise<{ markdown: string; xmlModel: string; symbols: Symbols }> {
    try {
        const addressSpace = AddressSpace.create();

        // create own namespace (before loading other xml files)
        const ns = addressSpace.registerNamespace(data.namespaceUri);

        const nodeIdManager = (ns as any)._nodeIdManager as NodeIdManager;
        if (data.presetSymbols) {
            nodeIdManager.setSymbols(data.presetSymbols);
        }

        await generateAddressSpaceRaw(addressSpace, data.xmlFiles, data.xmlLoader);

        await data.createModel(addressSpace);

        const xmlModel = ns.toNodeset2XML();
        const symbols = nodeIdManager.getSymbols();
        const doc = await buildDocumentationToString(ns);
        addressSpace.dispose();

        return { xmlModel, symbols, markdown: doc };
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.log("Error", err);
        throw err;
    }
}
