import "should";
interface TestHarness {
    endpointUrl: string;
    [k: string]: any;
}
/**
 * Issue #804 - Ensure monitoring with TimestampsToReturn.Source produces DataValues with only sourceTimestamp.
 */
export declare function t(test: TestHarness): void;
export {};
