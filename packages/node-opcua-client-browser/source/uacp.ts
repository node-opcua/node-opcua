/**
 * @module node-opcua-client-browser
 * @internal
 *
 * UACP primitives usable in the browser.
 *
 * These are thin re-exports of the byte-level encoders/decoders from
 * `node-opcua-transport`. Those modules are pure-JS (only `node:events` is
 * pulled in, which Vite polyfills automatically) and are therefore safe to
 * bundle for the browser. Consolidating them here gives us a single point of
 * audit if a future release of `node-opcua-transport` introduces a Node-only
 * import.
 */

export {
    AcknowledgeMessage,
    HelloMessage,
    packTcpMessage,
    readRawMessageHeader,
    TCPErrorMessage,
    type TransportSettingsOptions
} from "node-opcua-transport";
