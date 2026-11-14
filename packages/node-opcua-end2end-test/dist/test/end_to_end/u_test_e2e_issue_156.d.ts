import "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
/**
 * Bug #156 - Monitoring a variable with sampling rate faster than
 * the variable's own refresh cycle.
 * Ensures no errors occur and subscription handles oversampling
 * gracefully (queue/discard behavior).
 */
export declare function t(test: UmbrellaTestContext): void;
//# sourceMappingURL=u_test_e2e_issue_156.d.ts.map