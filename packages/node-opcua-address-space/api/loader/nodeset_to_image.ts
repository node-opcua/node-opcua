/**
 * @module node-opcua-address-space
 */
import { imageNodesetRecords, NodesetImageWriter, type NodesetImageWriterOptions } from "./nodeset_image.js";
import { type NodesetSource, openNodesetSource } from "./nodeset_source.js";
import { xmlNodesetRecords } from "./nodeset_xml_producer.js";

export interface NodesetToImageOptions extends Pick<NodesetImageWriterOptions, "addressSpaceVersion" | "createdAt"> {}

/**
 * the precompiled image of a NodeSet2 document, built from the source alone: converting a file
 * needs neither its dependencies nor an address space. A source that already holds an image is
 * returned as it is, once read through to check it.
 */
export async function nodesetToImage(source: NodesetSource, options: NodesetToImageOptions = {}): Promise<Uint8Array> {
    const reader = openNodesetSource(source, 0, { hash: true });
    if ((await reader.probe()) === "image") {
        const bytes = await reader.allBytes();
        for await (const _record of imageNodesetRecords(bytes)) {
            /* a corrupt image is refused here rather than at load time */
        }
        return bytes;
    }
    const writer = new NodesetImageWriter({ ...options });
    for await (const record of xmlNodesetRecords(reader.chunks())) {
        writer.apply(record);
    }
    return writer.finish(await reader.digest(), reader.length);
}
