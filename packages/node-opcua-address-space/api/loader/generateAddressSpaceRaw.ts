import type { IAddressSpace, RequiredModel } from "node-opcua-address-space-base";
import { getMinOPCUADate } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import type { CallbackT } from "node-opcua-status-code";
import { type ReaderStateParser, type ReaderStateParserLike, Xml2Json, type XmlAttributes } from "node-opcua-xml2json";
import type { NamespacePrivate } from "../../impl/namespace_private.js";
import { adjustNamespaceArray } from "../../impl/nodeset_tools/adjust_namespace_array.js";
import type { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options.js";
import { NodeSetLoader } from "./load_nodeset2.js";
import { imageNodesetRecords, NodesetImageError, NodesetImageWriter, readNodesetImageInfo } from "./nodeset_image.js";
import { decodeHeader } from "./nodeset_image_codec.js";
import { type NodesetImageStore, nodesetImageKey, sharedMemoryNodesetImageStore } from "./nodeset_image_store.js";
import type { NodesetRecord, NodesetRecordConsumer } from "./nodeset_record.js";
import { type NodesetReader, type NodesetSource, openNodesetSource } from "./nodeset_source.js";
import { xmlNodesetRecords } from "./nodeset_xml_producer.js";

const doDebug = checkDebugFlag("generateAddressSpaceRaw");
const debugLog = make_debugLog("generateAddressSpaceRaw");
const errorLog = make_errorLog("generateAddressSpaceRaw");

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
    let currentModel: Model | undefined;
    const state0: ReaderStateParser = {
        parser: {
            UANodeSet: {
                parser: {
                    NamespaceUris: {
                        parser: {
                            Uri: <ReaderStateParserLike & { text: string }>{
                                finish(this: ReaderStateParserLike & { text: string }) {
                                    namespaceUris.push(this.text);
                                }
                            }
                        }
                    },
                    Models: {
                        parser: {
                            Model: {
                                init(_elementName: string, attrs: XmlAttributes) {
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
                                        init(_elementName: string, attrs: XmlAttributes) {
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
    parser.parseString(xmlData);
    if (models.length === 0 && namespaceUris.length >= 1) {
        models.push({
            modelUri: namespaceUris[0],
            version: "1",
            publicationDate: getMinOPCUADate(),
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
interface NodesetSourceDesc {
    index: number;
    reader: NodesetReader;
    namespaceModel: NodesetInfo;
    /** the bytes of a source that holds an image, read whole */
    image?: Uint8Array;
}

/**
 * the header of a NodeSet2 file (`NamespaceUris`, `Models`) precedes the aliases and the nodes: the
 * dependency pre-pass has read enough once both closers were seen, or once the body has begun
 */
const BODY_START =
    /<(Aliases|Extensions|UAObject|UAVariable|UADataType|UAReferenceType|UAObjectType|UAVariableType|UAMethod|UAView)[\s/>]/;
function headerComplete(text: string): boolean {
    return (text.includes("</Models>") && text.includes("</NamespaceUris>")) || BODY_START.test(text);
}

/** the `<UANodeSet ...>` opener up to the end of `</Models>` or `</NamespaceUris>`, whichever comes last */
function sliceHeader(xmlData: string, name: string): string {
    const indexStart = xmlData.match(/<UANodeSet/m)?.index;
    const i1 = (xmlData.match(/<\/Models>/m)?.index || 0) + "</Models>".length;
    const i2 = (xmlData.match(/<\/NamespaceUris>/m)?.index || 0) + "</NamespaceUris>".length;
    const indexEnd = Math.max(i1, i2);
    if (indexStart === undefined) {
        throw new Error(`nodeset source ${name}: no <UANodeSet> element found`);
    }
    return xmlData.substring(indexStart, indexEnd);
}

/**
 * Detect the order of namespace loading, reading each source no further than its header
 */
async function preLoadSources(readers: NodesetReader[]): Promise<NodesetSourceDesc[]> {
    const namespaceDesc: NodesetSourceDesc[] = [];
    for (let index = 0; index < readers.length; index++) {
        const reader = readers[index];
        doDebug && console.log("---------------------------------------------", reader.name);
        if ((await reader.probe()) === "image") {
            // an image is small (a few hundred KB) and its header is line 1: read it whole
            const image = await reader.allBytes();
            const { header } = await readNodesetImageInfo(image);
            const models: Model[] = header.models.map((m) => ({
                modelUri: m.modelUri,
                version: m.version,
                publicationDate: m.publicationDate ? new Date(m.publicationDate) : getMinOPCUADate(),
                requiredModel: m.requiredModels.map((r) => ({ ...r, publicationDate: new Date(r.publicationDate) }))
            }));
            if (models.length === 0 && header.namespaceUris.length >= 1) {
                models.push({
                    modelUri: header.namespaceUris[0],
                    version: "1",
                    publicationDate: getMinOPCUADate(),
                    requiredModel: []
                });
            }
            namespaceDesc.push({ reader, namespaceModel: { models, namespaceUris: header.namespaceUris }, index, image });
            continue;
        }
        const head = await reader.readHead(headerComplete);
        const namespaceModel = await parseDependencies(sliceHeader(head, reader.name));
        namespaceDesc.push({ reader, namespaceModel, index });
    }
    return namespaceDesc;
}

/** the same records, seen by a second consumer on their way to the loader */
async function* tee(records: AsyncIterable<NodesetRecord>, consumer: NodesetRecordConsumer): AsyncGenerator<NodesetRecord> {
    for await (const record of records) {
        consumer.apply(record);
        yield record;
    }
}

function resolveImageStore(option: NodesetImageStore | boolean | undefined): NodesetImageStore | undefined {
    if (!option) return undefined;
    return option === true ? sharedMemoryNodesetImageStore() : option;
}

/**
 * whether an image from the store can be replayed: it inflates to its end (gzip integrity), its
 * header and trailer parse, the trailer counts the lines and names the expected source. A
 * corrupt, truncated or foreign image is the store's problem, not the caller's: it is logged
 * and rebuilt from the XML.
 */
const decodeHeaderOrThrow = (info: Awaited<ReturnType<typeof readNodesetImageInfo>>) => decodeHeader(info.header);

async function isReplayable(image: Uint8Array, digest: string, name: string): Promise<boolean> {
    try {
        const info = await readNodesetImageInfo(image);
        if (!info.trailer) {
            throw new NodesetImageError("the image is truncated: no trailer");
        }
        if (info.trailer.nodes !== info.lines) {
            throw new NodesetImageError(`the image trailer announces ${info.trailer.nodes} nodes, ${info.lines} lines were read`);
        }
        if (info.trailer.sourceDigest !== digest) {
            throw new NodesetImageError("the image was built from another source (digest mismatch)");
        }
        // the header parses with the schema this loader reads
        decodeHeaderOrThrow(info);
        return true;
    } catch (err) {
        if (!(err instanceof NodesetImageError)) {
            throw err;
        }
        debugLog("discarding the image of", name, ":", err.message);
        return false;
    }
}

/**
 * load one XML source: from its image when the store holds a valid one, from the XML otherwise,
 * writing the image on the way when there is a store
 */
async function loadXmlSource(
    nodesetLoader: NodeSetLoader,
    reader: NodesetReader,
    store: NodesetImageStore | undefined
): Promise<void> {
    if (!store) {
        await nodesetLoader.addNodeSetStream(reader.chunks());
        return;
    }
    // the digest is known up front for a document given whole; a stream must be read first
    const digest = reader.imageKey ?? (reader.whole ? await reader.digest() : undefined);
    if (digest !== undefined) {
        const key = nodesetImageKey(digest);
        const image = await store.get(key);
        if (image && (await isReplayable(image, digest, reader.name))) {
            // a replay that fails half-way would leave nodes behind that the XML would then
            // collide with; the check above is what makes it safe to commit to the image here
            await nodesetLoader.addRecords(imageNodesetRecords(image, { expectedDigest: digest }));
            doDebug && debugLog("loaded", reader.name, "from its image", key);
            return;
        }
    }
    const writer = new NodesetImageWriter();
    await nodesetLoader.addRecords(tee(xmlNodesetRecords(reader.chunks()), writer));
    const sourceDigest = digest ?? (await reader.digest());
    try {
        await store.put(nodesetImageKey(sourceDigest), await writer.finish(sourceDigest, reader.length));
        doDebug && debugLog("loaded", reader.name, "from XML; image written under", nodesetImageKey(sourceDigest));
    } catch (err) {
        // a store that cannot write costs a log line, never the load
        errorLog(`generateAddressSpace: cannot store the image of ${reader.name}: ${(err as Error).message}`);
    }
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
        const xmlData2 = sliceHeader(xmlData, xmlFiles[index]);
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
export function findOrder(nodesetDescs: Array<{ namespaceModel: NodesetInfo }>): number[] {
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
                throw new Error(`Cannot find namespace for ${requiredModel.modelUri}`);
            }
            const nd = nodesetDescs[requiredModelIndex];
            for (const n of nd.namespaceModel.models) {
                visit(n);
            }
        }
        const nodesetIndex = findNodesetIndex(model.modelUri);
        const alreadyIn = order.indexOf(nodesetIndex) !== -1;
        if (!alreadyIn) order.push(nodesetIndex);
    };
    const visit2 = (nodesetDesc: { namespaceModel: NodesetInfo }) => {
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
 * populate an address space from NodeSet2 documents, in dependency order whatever the order given
 *
 * @param addressSpace the addressSpace to populate
 * @param sources the documents, each a {@link NodesetSource}: text, bytes, a stream of chunks or a
 *   function opening one; an array is always a list of documents
 * @param options
 */
export async function generateAddressSpaceRaw(
    addressSpace: IAddressSpace,
    sources: NodesetSource | NodesetSource[],
    options?: NodeSetLoaderOptions
): Promise<void>;
/**
 * @param addressSpace the addressSpace to populate
 * @param xmlFiles a list of xml file uris
 * @param xmlLoader a helper function returning the content of a xml file as a string
 * @param options
 */
export async function generateAddressSpaceRaw(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    xmlLoader: (nodeset2xmlUri: string) => Promise<string>,
    options: NodeSetLoaderOptions
): Promise<void>;
export async function generateAddressSpaceRaw(
    addressSpace: IAddressSpace,
    sourcesOrUris: NodesetSource | NodesetSource[] | string | string[],
    loaderOrOptions?: ((nodeset2xmlUri: string) => Promise<string>) | NodeSetLoaderOptions,
    maybeOptions?: NodeSetLoaderOptions
): Promise<void> {
    let readers: NodesetReader[];
    let options: NodeSetLoaderOptions;
    let store: NodesetImageStore | undefined;
    if (typeof loaderOrOptions === "function") {
        const xmlLoader = loaderOrOptions;
        const uris = (Array.isArray(sourcesOrUris) ? sourcesOrUris : [sourcesOrUris]) as string[];
        options = maybeOptions || {};
        store = resolveImageStore(options.imageStore);
        // the loader hands the document whole, so its digest is known before it is parsed
        readers = uris.map((uri, index) =>
            openNodesetSource(
                {
                    name: uri,
                    source: async function* () {
                        yield await xmlLoader(uri);
                    }
                },
                index,
                { hash: !!store, whole: true }
            )
        );
    } else {
        const list = (Array.isArray(sourcesOrUris) ? sourcesOrUris : [sourcesOrUris]) as NodesetSource[];
        options = loaderOrOptions || {};
        store = resolveImageStore(options.imageStore);
        readers = list.map((source, index) => openNodesetSource(source, index, { hash: !!store }));
    }
    const nodesetLoader = new NodeSetLoader(addressSpace, options);

    const nodesetDesc = await preLoadSources(readers);
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
        // c8 ignore next
        doDebug && debugLog(" loading ", nodesetIndex, nodeset.reader.name);
        try {
            if (nodeset.image) {
                await nodesetLoader.addRecords(imageNodesetRecords(nodeset.image));
            } else {
                await loadXmlSource(nodesetLoader, nodeset.reader, store);
            }
        } catch (err) {
            const cause = err instanceof Error ? err.message : String(err);
            const message = `generateAddressSpace: loading nodeset ${nodeset.reader.name} failed: ${cause}`;
            errorLog(message);
            throw new Error(message, { cause: err });
        }
    }

    await nodesetLoader.terminate();
    adjustNamespaceArray(addressSpace);
    // however process them in series
}

export type XmlLoaderFunc = (nodeset2xmlUri: string, callback: CallbackT<string>) => void;
export type XmlLoaderAsyncFunc = (nodeset2xmlUri: string) => Promise<string>;
