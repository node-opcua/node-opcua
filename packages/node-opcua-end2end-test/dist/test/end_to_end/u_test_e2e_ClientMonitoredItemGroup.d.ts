import "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
/**
 * ClientMonitoredItem & ClientMonitoredItemGroup tests (converted from callback JS to async/await TS)
 *
 * Original test IDs preserved (AA11..AA16) + issue reference #534 for invalid nodes in a group.
 * Behavior summary:
 *  - AA11: single monitored item produces value changes then terminates after 10 notifications.
 *  - AA12: group of 2 items initializes; length asserted; terminate.
 *  - AA13: group of 2 items; terminate after 10 aggregated change notifications.
 *  - AA14: same as AA12 but demonstrates toString.
 *  - AA15: explicit toString call path.
 *  - AA16 (#534): group with invalid nodes still initializes; group length asserted (all attempted items retained) then terminates.
 */
export declare function t(test: UmbrellaTestContext): void;
//# sourceMappingURL=u_test_e2e_ClientMonitoredItemGroup.d.ts.map