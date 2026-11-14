import "should";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";
/**
 * Issue #198
 * Server should happily accept a CreateSession request even if the client's provided sessionName is null/undefined.
 * Original test hijacked the internal _nextSessionName() to force it to return null.
 */
export declare function t(test: UmbrellaTestContext): void;
//# sourceMappingURL=u_test_e2e_issue_198.d.ts.map