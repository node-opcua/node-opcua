/**
 * @module node-opcua-address-space
 *
 * Ready-made {@link NodesetSource} values for the common places a NodeSet2 document comes
 * from. Each is lazy: nothing is opened or fetched until the loader reaches the document, and
 * the same value can be given to a later load. The file helpers live in the Node.js build
 * (`nodesetSourceFromFile`, `nodesetSourceFromGzipFile`); these two need nothing but the
 * platform and serve the browser build too.
 */
import type { NamedNodesetSource, NodesetChunkStream } from "./nodeset_source.js";

/** a document from anything that opens a stream of chunks, under a name for error messages */
export function nodesetSourceFromStream(name: string, open: () => NodesetChunkStream): NamedNodesetSource {
    return { name, source: open };
}

export interface NodesetSourceFromUrlOptions {
    /** passed to `fetch`: headers, credentials, a signal */
    init?: RequestInit;
    /**
     * whether the body is gzip and must be inflated here. `fetch` inflates a response that
     * carries `Content-Encoding: gzip` on its own; this is for a `.gz` file served as is.
     * @default true when the url path ends in `.gz`
     */
    gzip?: boolean;
}

/**
 * a document fetched from a URL when the loader gets to it. A response that is not ok rejects
 * the load with the status and the url; nothing is retried.
 */
export function nodesetSourceFromUrl(url: string, options: NodesetSourceFromUrlOptions = {}): NamedNodesetSource {
    const gzip = options.gzip ?? /\.gz$/i.test(new URL(url, "http://localhost").pathname);
    const init = options.init;
    return {
        name: url,
        source: async function* (): AsyncGenerator<Uint8Array> {
            const response = await fetch(url, init);
            if (!response.ok || !response.body) {
                throw new Error(`cannot fetch ${url}: ${response.status} ${response.statusText}`.trimEnd());
            }
            const body = gzip
                ? response.body.pipeThrough(
                      new DecompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
                  )
                : response.body;
            yield* body as unknown as AsyncIterable<Uint8Array>;
        }
    };
}
