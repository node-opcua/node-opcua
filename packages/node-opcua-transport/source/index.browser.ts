/*!
 * The MIT License (MIT)
 * Copyright (c) 2022-2025  Sterfive SAS - 833264583 RCS ORLEANS - France  (https://www.sterfive.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 */
/**
 * @module node-opcua-transport/browser
 *
 * Browser-safe subset of `node-opcua-transport`. Selected automatically by
 * bundlers (esbuild, webpack, vite, rollup) via the `"browser"` condition in
 * this package's `exports` map.
 *
 * Excludes Node-only modules whose top-level `import "node:net" | "node:os"`
 * statements would otherwise crash a `platform: "browser"` bundle even though
 * the runtime never reaches them:
 *   - `client_tcp_transport`        — opens a `net.Socket`
 *   - `default_client_transport_factory` — instantiates `ClientTCP_transport`
 *   - `server_tcp_transport`        — Node-side server endpoint
 *
 * Browser-side OPC UA transports (e.g. `ClientWS_transport` from
 * `node-opcua-client-browser`) extend `ClientTransportBase` from this entry,
 * implement their own `connect()`, and inherit the inherited HEL/ACK,
 * packet-assembly, and lifecycle machinery.
 */
export * from "./AcknowledgeMessage";
export * from "./client_transport_base";
export * from "./HelloMessage";
export * from "./i_client_transport";
export * from "./i_hello_ack_limits";
export * from "./message_builder_base";
export * from "./status_codes";
export * from "./TCPErrorMessage";
export * from "./tcp_transport";
export * from "./tools";
export * from "./utils";
