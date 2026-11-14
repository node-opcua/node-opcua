import "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
/**
 * Bug #455 - OPCUASession#readVariableValue
 *
 * Intent (restored from original test comments):
 * 1. When the client API `readVariableValue` is invoked with a string that CANNOT be coerced to a valid NodeId,
 *    the client shall throw synchronously (i.e. before any request is sent over the wire). This validates the
 *    client-side nodeId parsing logic and prevents useless round-trips.
 * 2. When a WELL-FORMED NodeId (string form) is provided but it does NOT exist on the server, the service call
 *    proceeds and the server returns a DataValue whose StatusCode is BadNodeIdUnknown (no Value). The same
 *    behavior must be observed both via `readVariableValue` convenience method and the generic `read` service.
 *
 */
export declare function t(test: UmbrellaTestContext): void;
//# sourceMappingURL=u_test_e2e_issue_455.d.ts.map