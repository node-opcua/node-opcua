/**
 * @module node-opcua-common/browser
 *
 * Browser-safe subset of `node-opcua-common`. Selected automatically by
 * bundlers (esbuild, webpack, vite, rollup) via the `"browser"` condition
 * in this package's `exports` map.
 *
 * Omits modules whose top-level imports drag Node-only built-ins into the
 * bundle:
 *   - `applicationurn`                    — uses `crypto.createHash`
 *   - `disk_certificate_key_pair_provider` — uses `node:fs`
 *   - `opcua_secure_object`               — uses `node:events` and re-exports
 *                                            `DiskCertificateKeyPairProvider`
 *
 * Browser consumers that need a stable identity URN should build it
 * themselves (e.g. from a stored UUID) — the OPC UA spec does not require
 * the SHA-1 host-derived form.
 */

// Pure interfaces — compile away to nothing at runtime.
export * from "./i_certificate_store";

// Runtime class `StaticCertificateChainProvider` + interfaces; only depends
// on `node-opcua-crypto/web` and the type-only re-export from
// `./opcua_secure_object` (erased at compile time).
export * from "./certificate_chain_provider";

// Runtime — uses only `node-opcua-crypto/web`. The
// `import type { ICertificateKeyPairProviderWithLocation } from "./opcua_secure_object"`
// is `import type` and erased; no runtime require is emitted.
export * from "./in_memory_certificate_key_pair_provider";

// Runtime — uses only `node-opcua-crypto/web` and `node-opcua-status-code`.
export * from "./in_memory_certificate_store";

// Pure string utility.
export * from "./make_subject";

// Plain type re-exports from `node-opcua-types`. These are interfaces /
// generated classes that do not pull Node-only modules.
export {
    BuildInfo,
    DataTypeDefinition,
    EnumValueType,
    ModelChangeStructureDataType,
    RedundantServerDataType,
    SamplingIntervalDiagnosticsDataType,
    SemanticChangeStructureDataType,
    ServerDiagnosticsSummaryDataType,
    ServerState,
    ServerStatusDataType,
    ServiceCounterDataType,
    SessionDiagnosticsDataType,
    SessionSecurityDiagnosticsDataType,
    SubscriptionDiagnosticsDataType,
    TimeZoneDataType
} from "node-opcua-types";
