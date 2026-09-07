/**
 * @module node-opcua-address-space
 */
import { NDJSON_IMAGE_FORMAT, registerBuiltinNodesetFormats } from "./nodeset_builtin_formats.js";
import { nodesetFormatByName } from "./nodeset_format.js";
import { imageNodesetRecords, NodesetImageWriter, type NodesetImageWriterOptions } from "./nodeset_image.js";
import { type NodesetSource, nodesetDocumentOf, openNodesetSource } from "./nodeset_source.js";

registerBuiltinNodesetFormats();

export interface NodesetToImageOptions extends Pick<NodesetImageWriterOptions, "addressSpaceVersion" | "createdAt"> {}

/**
 * the precompiled image of a nodeset document, built from the source alone: converting a file
 * needs neither its dependencies nor an address space. A source that already holds an image is
 * returned as it is, once read through to check it.
 *
 * Any registered format can be the input, not only NodeSet2 XML: an image is a cache of records,
 * and records are what every format produces.
 */
export async function nodesetToImage(source: NodesetSource, options: NodesetToImageOptions = {}): Promise<Uint8Array> {
    const reader = openNodesetSource(source, 0, { hash: true });
    const formatName = await reader.probe();
    if (formatName === NDJSON_IMAGE_FORMAT) {
        const bytes = await reader.allBytes();
        for await (const _record of imageNodesetRecords(bytes)) {
            /* a corrupt image is refused here rather than at load time */
        }
        return bytes;
    }
    const format = nodesetFormatByName(formatName);
    if (!format) {
        throw new Error(`nodeset source ${reader.name}: its format is no longer registered`);
    }
    const writer = new NodesetImageWriter({ ...options });
    for await (const record of format.records(nodesetDocumentOf(reader))) {
        writer.apply(record);
    }
    return writer.finish(await reader.digest(), reader.length);
}
