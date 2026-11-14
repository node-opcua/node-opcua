import "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
/**
 * Monitoring scalability tests
 * - Legacy test #69: ensure client can create and receive data changes for a modest list of nodes.
 * - Stress test: create ~5000 monitored items via a single CreateMonitoredItems service call and verify
 *   a raw notification arrives containing monitored item results (subject to maxNotificationsPerPublish rules).
 * - Issue #1008 regression: invoke GetMonitoredItems method against the Server object.
 *
 * Converted from callback-based JavaScript to async/await TypeScript while keeping original intent/comments.
 */
export declare function t(test: UmbrellaTestContext): void;
//# sourceMappingURL=u_test_e2e_monitoring_large_number_of_nodes.d.ts.map