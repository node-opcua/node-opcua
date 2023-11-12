import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { CallbackT } from "node-opcua-status-code";
import { IAddressSpace, RequiredModel } from "node-opcua-address-space-base";
import { ReaderStateParserLike, Xml2Json } from "node-opcua-xml2json";
import { minDate } from "node-opcua-date-time";
import { adjustNamespaceArray } from "../../src/nodeset_tools/adjust_namespace_array";
import { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options";
import { NamespacePrivate } from "../../src/namespace_private";
import { NodeSetLoader } from "./load_nodeset2";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

interface Model extends RequiredModel {
    requiredModel: RequiredModel[];
}
interface NodesetInfo {
    namespaceUris: string[];
    models: Model[];
}

async function parseDependencies(xmlData: string): Promise<NodesetInfo> {
    const namespaceUris: string[] = [];

    const models: Model[] = [];
    let currentModel: Model | undefined = undefined;
    const state0: ReaderStateParserLike = {
        parser: {
            UANodeSet: {
                parser: {
                    NamespaceUris: {
                        parser: {
                            Uri: {
                                finish() {
                                    namespaceUris.push(this.text);
                                }
                            }
                        }
                    },
                    Models: {
                        parser: {
                            Model: {
                                init(elementName: string, attrs: any) {
                                    const modelUri = attrs.ModelUri;
                                    const version = attrs.Version;
                                    const publicationDate = new Date(Date.parse(attrs.PublicationDate));
                                    currentModel = {
                                        modelUri,
                                        version,
                                        publicationDate,
                                        requiredModel: []
                                    };
                                    doDebug && console.log(`currentModel = ${JSON.stringify(currentModel)}`);
                                    models.push(currentModel);
                                },
                                parser: {
                                    RequiredModel: {
                                        init(elementName: string, attrs: any) {
                                            const modelUri = attrs.ModelUri;
                                            const version = attrs.Version;
                                            const publicationDate = new Date(Date.parse(attrs.PublicationDate));

                                            if (!currentModel) {
                                                throw new Error("Internal Error");
                                            }
                                            currentModel.requiredModel.push({
                                                modelUri,
                                                version,
                                                publicationDate
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    const parser = new Xml2Json(state0);
    parser.parseStringSync(xmlData);
    if (models.length === 0 && namespaceUris.length >= 1) {
        models.push({
            modelUri: namespaceUris[0],
            version: "1",
            publicationDate: minDate,
            requiredModel: []
        });
    }
    return { models, namespaceUris: namespaceUris };
}
interface NodesetDesc {
    index: number;
    xmlData: string;
    namespaceModel: NodesetInfo;
}
/**
 * Detect order of namespace loading
 */
export async function preLoad(xmlFiles: string[], xmlLoader: (nodeset2xmlUri: string) => Promise<string>): Promise<NodesetDesc[]> {
    // a nodeset2 file may define multiple namespaces
    const namespaceDesc: NodesetDesc[] = [];
    for (let index = 0; index < xmlFiles.length; index++) {
        doDebug && console.log("---------------------------------------------", xmlFiles[index]);
        const xmlData = await xmlLoader(xmlFiles[index]);

        const indexStart = xmlData.match(/<UANodeSet/m)?.index;
        const i1 = (xmlData.match(/<\/Models>/m)?.index || 0) + "</Models>".length;
        const i2 = (xmlData.match(/<\/NamespaceUris>/m)?.index || 0) + "</NamespaceUris>".length;

        const indexEnd = Math.max(i1, i2);
        if (indexStart === undefined || indexEnd === undefined) {
            throw new Error("Internal Error");
        }
        const xmlData2 = xmlData.substring(indexStart, indexEnd);
        doDebug &&
            console.log(
                xmlData2
                    .split("\n")
                    .splice(0, 46)
                    .map((x, i) => `${i + 0} ${x}`)
                    .join("\n")
            );
        const namespaceModel = await parseDependencies(xmlData2);
        namespaceDesc.push({ xmlData, namespaceModel, index });
    }
    return namespaceDesc;
}
export function findOrder(nodesetDescs: NodesetDesc[]): number[] {
    // compute the order of loading of the namespaces
    const order: number[] = [];
    const visited: Set<string> = new Set<string>();

    const findNodesetIndex = (namespaceUri: string) => {
        const index = nodesetDescs.findIndex((x) => x.namespaceModel.models.findIndex((e) => e.modelUri === namespaceUri) !== -1);
        return index;
    };
    const visit = (model: Model) => {
        const key = model.modelUri;
        if (visited.has(key)) {
            return;
        }
        visited.add(key);
        for (const requiredModel of model.requiredModel) {
            const requiredModelIndex = findNodesetIndex(requiredModel.modelUri);
            if (requiredModelIndex === -1) {
                throw new Error("Cannot find namespace for " + requiredModel.modelUri);
            }
            const nd = nodesetDescs[requiredModelIndex];
            for (const n of nd.namespaceModel.models) {
                visit(n);
            }
        }
        const nodesetIndex = findNodesetIndex(model.modelUri);
        const alreadyIn = order.findIndex((x) => x === nodesetIndex) !== -1;
        if (!alreadyIn) order.push(nodesetIndex);
    };
    const visit2 = (nodesetDesc: NodesetDesc) => {
        for (const model of nodesetDesc.namespaceModel.models.values()) {
            visit(model);
        }
    };
    for (let index = 0; index < nodesetDescs.length; index++) {
        const nodesetDesc = nodesetDescs[index];
        visit2(nodesetDesc);
    }
    return order;
}
/**
 * @param addressSpace the addressSpace to populate
 * @xmlFiles: a lis of xml files
 * @param xmlLoader - a helper function to return the content of the xml file
 */
export async function generateAddressSpaceRaw(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    xmlLoader: (nodeset2xmlUri: string) => Promise<string>,
    options: NodeSetLoaderOptions
): Promise<void> {
    const nodesetLoader = new NodeSetLoader(addressSpace, options);

    if (!Array.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }

    const nodesetDesc = await preLoad(xmlFiles, xmlLoader);
    const order = findOrder(nodesetDesc);

    // register namespace in the same order as specified in the xmlFiles array
    for (let index = 0; index < order.length; index++) {
        const n = nodesetDesc[index];
        for (const model of n.namespaceModel.models) {
            const ns = addressSpace.registerNamespace(model.modelUri) as NamespacePrivate;
            ns.setRequiredModels(model.requiredModel);
        }
    }


    for (let index = 0; index < order.length; index++) {
        const nodesetIndex = order[index];
        const nodeset = nodesetDesc[nodesetIndex];
        debugLog(" loading ", nodesetIndex, nodeset.xmlData.length);
        try {
            await nodesetLoader.addNodeSetAsync(nodeset.xmlData);
        } catch (err) {
            errorLog("generateAddressSpace:  Loading xml file ", xmlFiles[index], " failed with error ", (err as Error).message);
            throw err;
        }
    }

    await nodesetLoader.terminateAsync();
    adjustNamespaceArray(addressSpace);
    // however process them in series
}

export type XmlLoaderFunc = (nodeset2xmlUri: string, callback: CallbackT<string>) => void;
export type XmlLoaderAsyncFunc = (nodeset2xmlUri: string) => Promise<string>;
