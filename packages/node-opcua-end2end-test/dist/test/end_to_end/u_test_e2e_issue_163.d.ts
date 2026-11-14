import "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
/**
 * Bug #163 - Variable alternating between Good values and Bad status should not cause internal errors.
 * The server variable returns StatusCodes.Bad when exceeding threshold then resets to lower value.
 * Test ensures monitored item continues receiving notifications without server internal error.
 */
export declare function t(test: UmbrellaTestContext): void;
//# sourceMappingURL=u_test_e2e_issue_163.d.ts.map