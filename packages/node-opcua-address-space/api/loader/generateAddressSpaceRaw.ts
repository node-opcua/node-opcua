import type { IAddressSpace, RequiredModel } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import type { CallbackT } from "node-opcua-status-code";
import semver from "semver";
import type { NamespacePrivate } from "../../impl/namespace_private.js";
import { adjustNamespaceArray } from "../../impl/nodeset_tools/adjust_namespace_array.js";
import type { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options.js";
import { NodeSetLoader } from "./load_nodeset2.js";
import { makeSemverCompatible } from "./make_semver_compatible.js";
import { NDJSON_IMAGE_FORMAT, registerBuiltinNodesetFormats } from "./nodeset_builtin_formats.js";
import {
    type NodesetModel as Model,
    type NodesetDocument,
    type NodesetFormat,
    type NodesetModelInfo as NodesetInfo,
    nodesetFormatByName
} from "./nodeset_format.js";
import {
    imageLinesToRecords,
    inflatedImageLines,
    NodesetImageError,
    NodesetImageWriter,
    nodesetImageProblem,
    readNodesetImageInfo,
    releaseInflatedImageLines
} from "./nodeset_image.js";
import { decodeHeader } from "./nodeset_image_codec.js";
import { type NodesetImageStore, nodesetImageKey, sharedMemoryNodesetImageStore } from "./nodeset_image_store.js";
import type { NodesetRecord, NodesetRecordConsumer } from "./nodeset_record.js";
import { type NodesetReader, type NodesetSource, nodesetDocumentOf, openNodesetSource } from "./nodeset_source.js";
import { parseDependencies, sliceHeader } from "./nodeset_xml_header.js";

// the loader reads NodeSet2 XML and its own NDJSON images out of the box: registering them is
// what makes that true, and it has to happen before any source is sniffed
registerBuiltinNodesetFormats();

const doDebug = checkDebugFlag("generateAddressSpaceRaw");
const debugLog = make_debugLog("generateAddressSpaceRaw");
const errorLog = make_errorLog("generateAddressSpaceRaw");

interface NodesetDesc {
    index: number;
    xmlData: string;
    namespaceModel: NodesetInfo;
}
interface NodesetSourceDesc {
    index: number;
    reader: NodesetReader;
    namespaceModel: NodesetInfo;
    /** the format that claimed this source */
    format: NodesetFormat;
    /** the source seen as a document, so the read and the inflate are shared with the pre-pass */
    document: NodesetDocument;
}

/**
 * Detect the order of namespace loading, reading each source no further than its header
 */
async function preLoadSources(readers: NodesetReader[]): Promise<NodesetSourceDesc[]> {
    const namespaceDesc: NodesetSourceDesc[] = [];
    for (let index = 0; index < readers.length; index++) {
        const reader = readers[index];
        doDebug && console.log("---------------------------------------------", reader.name);
        const format = nodesetFormatByName(await reader.probe());
        // probe() only returns a name it found in the registry, so this cannot be missing; the
        // check is here because a caller may unregister a format between the probe and the load
        if (!format) {
            throw new Error(`nodeset source ${reader.name}: its format is no longer registered`);
        }
        const document = nodesetDocumentOf(reader);
        const namespaceModel = await format.readModels(document);
        namespaceDesc.push({ reader, document, format, namespaceModel, index });
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
async function isReplayable(image: Uint8Array, digest: string, name: string): Promise<boolean> {
    try {
        const info = await readNodesetImageInfo(image);
        const problem = nodesetImageProblem(info, digest);
        if (problem) {
            throw new NodesetImageError(problem);
        }
        // the header parses with the schema this loader reads
        decodeHeader(info.header);
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
 * load one source through the image cache: from its image when the store holds a valid one, by
 * parsing it otherwise, writing the image on the way when there is a store.
 *
 * This used to be the XML path, because XML was the only thing worth caching a parse of. It is
 * now every format except the image itself: the cache is keyed on the digest of the bytes that
 * were read, and nothing about that reasoning was ever specific to XML. A published nodeset in
 * any format therefore gets a cache sibling on first read and loads at image speed after it.
 */
async function loadThroughCache(
    nodesetLoader: NodeSetLoader,
    format: NodesetFormat,
    document: NodesetDocument,
    reader: NodesetReader,
    store: NodesetImageStore | undefined
): Promise<void> {
    if (!store) {
        await nodesetLoader.addRecords(format.records(document));
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
            try {
                await nodesetLoader.addRecords(imageLinesToRecords(await inflatedImageLines(image), { expectedDigest: digest }));
            } finally {
                releaseInflatedImageLines(image);
            }
            doDebug && debugLog("loaded", reader.name, "from its image", key);
            return;
        }
    }
    const writer = new NodesetImageWriter();
    await nodesetLoader.addRecords(tee(format.records(document), writer));
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
/**
 * whether a model required by a document of this call, and provided by none of them, is
 * satisfied anyway: the predicate says so for a model the address space already holds
 * (see {@link loadedModelSatisfies}); by default nothing outside the call counts
 */
export type RequiredModelPredicate = (requiredModel: RequiredModel, requiredBy: string) => boolean;

/**
 * a required model that the address space already holds, from an earlier call or from an
 * earlier `registerNamespace`: satisfied when the namespace is registered with a version at
 * least the required one. A lower version is an error naming both versions; an absent
 * namespace is not satisfied, and left to the caller to report as missing.
 */
export function loadedModelSatisfies(addressSpace: IAddressSpace): RequiredModelPredicate {
    return (requiredModel: RequiredModel, requiredBy: string): boolean => {
        const namespace = addressSpace.getNamespace(requiredModel.modelUri);
        if (!namespace) {
            return false;
        }
        const loaded = makeSemverCompatible(namespace.version);
        const required = makeSemverCompatible(requiredModel.version);
        if (semver.lt(loaded, required)) {
            throw new Error(
                `Namespace ${requiredModel.modelUri} is loaded with version ${namespace.version || "unknown"}` +
                    ` but ${requiredBy} requires version ${requiredModel.version} or later`
            );
        }
        return true;
    };
}

/**
 * the order in which the documents of one call load, each after the documents it requires
 *
 * @param nodesetDescs the documents of the call, each with the models it defines and requires
 * @param isSatisfied a required model that no document of the call defines is an error unless
 *   this says it is satisfied, typically because the address space holds it already
 */
export function findOrder(
    nodesetDescs: Array<{ namespaceModel: NodesetInfo }>,
    isSatisfied: RequiredModelPredicate = () => false
): number[] {
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
                if (isSatisfied(requiredModel, model.modelUri)) {
                    continue;
                }
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
 * populate an address space from NodeSet2 documents, in dependency order whatever the order given.
 * A model that a document requires may come from the same call or from an earlier one: what
 * the address space already holds, with a sufficient version, counts as loaded.
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
    const order = findOrder(nodesetDesc, loadedModelSatisfies(addressSpace));

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
            if (nodeset.format.name === NDJSON_IMAGE_FORMAT) {
                // an image is already the cache: replaying it through the cache would be storing
                // a copy of what was just read
                try {
                    await nodesetLoader.addRecords(nodeset.format.records(nodeset.document));
                } finally {
                    releaseInflatedImageLines(await nodeset.document.rawBytes());
                }
            } else {
                await loadThroughCache(nodesetLoader, nodeset.format, nodeset.document, nodeset.reader, store);
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
