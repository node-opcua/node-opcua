// Stub used in place of Node-only modules (fs, net, os) statically pulled into
// the browser bundle by code paths the browser never executes (e.g. the
// `ClientTCP_transport` import chain reachable via the `node-opcua-transport`
// CJS barrel even though the WS transport never instantiates it, and
// `node-opcua-utils/check_file_exists` via the utils barrel).
//
// Some of those top-level statements DO execute at module-load time — e.g.
// `client_tcp_transport.js` evaluates `const gHostname = os.hostname()`. So
// the stub can't be `{}` — it has to be a Proxy that returns benign no-ops
// for any property access. The values these calls produce are never read by
// the WS code path; the goal is only "don't throw at module evaluation time".

const noop = () => undefined;
const stubProxy = new Proxy(function stub() {}, {
    get(_t, prop) {
        if (prop === "default") return stubProxy;
        if (prop === "__esModule") return true;
        if (prop === Symbol.toPrimitive) return () => "";
        // Any callable access yields a no-op function that itself proxies further
        // property access — covers `os.hostname()`, `util.types.isNativeError(e)`,
        // `net.Socket.prototype...`, etc.
        return stubProxy;
    },
    apply() {
        return "";
    },
    construct() {
        return stubProxy;
    }
});

module.exports = stubProxy;
