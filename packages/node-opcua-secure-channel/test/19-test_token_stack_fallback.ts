/**
 * Unit test for TokenStack token fallback behavior.
 *
 * Proves that when a request's original token (T1) has expired,
 * getLatestTokenDerivedKeys returns the newer token (T2), allowing
 * the server to sign the response with a different token than the
 * one the request was signed with.
 *
 * This simulates the publish-request pipeline scenario:
 *   1. Client sends PublishRequest signed with token T1
 *   2. Token T2 is created (Renew)
 *   3. T1 expires beyond 125% lifetime
 *   4. Server needs to send PublishResponse — T1's keys are gone
 *   5. Server falls back to T2's keys
 */

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";
import type { DerivedKeys1 } from "../source/security_policy";
import { TokenStack } from "../source/token_stack";

/**
 * Create a minimal mock DerivedKeys1 that can be told apart
 * by a label embedded in the derivedServerKeys object.
 */
function makeMockDerivedKeys(label: string): DerivedKeys1 {
    // We cast to DerivedKeys1 — the signing functions are not
    // called in this unit test, only identity checks are used.
    return {
        algorithm: "mock",
        derivedClientKeys: { label: `${label}-client` },
        derivedServerKeys: { label: `${label}-server` }
    } as unknown as DerivedKeys1;
}

describe("TokenStack – expired token fallback", function (this: Mocha.Suite) {
    this.timeout(10000);

    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers({ now: Date.now() });
    });
    afterEach(() => {
        clock.restore();
    });

    it("getTokenDerivedKeys should return keys for a valid token", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");

        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT1);

        const result = stack.getTokenDerivedKeys(1);
        should(result).equal(keysT1);
    });

    it("getTokenDerivedKeys should return null for a really-expired token (125%)", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");

        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT1);

        // Advance past 125% of lifetime → really expired
        clock.tick(60000 * 1.25 + 1);

        const result = stack.getTokenDerivedKeys(1);
        should(result).be.null();
    });

    it("getLatestTokenDerivedKeys should return the newest valid token", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");
        const keysT2 = makeMockDerivedKeys("T2");

        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT1);
        // Simulate renewal at 75% of lifetime
        clock.tick(45000);
        stack.pushNewToken({ tokenId: 2, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT2);

        const latest = stack.getLatestTokenDerivedKeys();
        should(latest).not.be.null();
        should(latest?.tokenId).equal(2);
        should(latest?.derivedKeys).equal(keysT2);
    });

    it("should fall back to T2 when T1 expires — the PublishRequest pipeline scenario", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");
        const keysT2 = makeMockDerivedKeys("T2");

        // Step 1: Token T1 created (lifetime = 60s)
        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT1);

        // At this point, T1 is valid
        should(stack.getTokenDerivedKeys(1)).equal(keysT1);

        // Step 2: Client renews at 75% → token T2 created
        clock.tick(45000); // t = 45s
        stack.pushNewToken({ tokenId: 2, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT2);

        // Both T1 and T2 are valid at this point
        should(stack.getTokenDerivedKeys(1)).equal(keysT1);
        should(stack.getTokenDerivedKeys(2)).equal(keysT2);

        // Step 3: T1 expires beyond 125% (at t = 75s)
        clock.tick(30001); // total t = 75.001s → T1 age = 75001ms > 60000 * 1.25

        // T1 is now really expired
        should(stack.getTokenDerivedKeys(1)).be.null();

        // T2 is still valid (age = 30001ms, lifetime = 60000ms)
        should(stack.getTokenDerivedKeys(2)).equal(keysT2);

        // Step 4: Server uses fallback to sign PublishResponse
        //   This is what #_get_security_options_for_MSG does:
        //   if getTokenDerivedKeys(requestTokenId) is null,
        //   fall back to getLatestTokenDerivedKeys()
        const requestTokenId = 1; // from the original PublishRequest
        let derivedKeys = stack.getTokenDerivedKeys(requestTokenId);

        if (!derivedKeys) {
            // Fallback — this is the new behavior
            const fallback = stack.getLatestTokenDerivedKeys();
            should(fallback).not.be.null();
            should(fallback?.tokenId).equal(2, "fallback should use T2 (the latest valid token)");
            should(fallback?.tokenId).not.equal(requestTokenId, "fallback token should be DIFFERENT from the request's token");
            derivedKeys = fallback?.derivedKeys ?? null;
        }

        // The response will be signed with T2's keys, not T1's
        should(derivedKeys).equal(keysT2);
        const mockKeys = derivedKeys as unknown as { derivedServerKeys: { label: string } };
        should(mockKeys.derivedServerKeys.label).equal("T2-server", "response should be signed with T2's server keys, not T1's");
    });

    it("getLatestTokenDerivedKeys should return null when all tokens have expired", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");

        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 1000, channelId: 1 }, keysT1);

        // Expire everything
        clock.tick(1000 * 1.25 + 1);

        const latest = stack.getLatestTokenDerivedKeys();
        should(latest).be.null();
    });

    it("removeOldTokens should purge expired tokens but keep valid ones", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");
        const keysT2 = makeMockDerivedKeys("T2");

        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 2000, channelId: 1 }, keysT1);

        clock.tick(1500); // T1 still valid (75%)

        stack.pushNewToken({ tokenId: 2, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT2);

        // Advance so T1 is really expired but T2 is still valid
        clock.tick(1100); // T1 age = 2600ms > 2000 * 1.25 = 2500ms

        stack.removeOldTokens();

        // T1 should be gone
        should(stack.getToken(1)).be.null();

        // T2 should still be there
        const t2 = stack.getToken(2);
        should(t2).not.be.null();
        should(t2?.tokenId).equal(2);
    });

    it("getLatestTokenDerivedKeys should return null on empty stack", () => {
        const stack = new TokenStack(1);

        const latest = stack.getLatestTokenDerivedKeys();
        should(latest).be.null();
    });

    it("getLatestTokenDerivedKeys should skip tokens with null derivedKeys", () => {
        const stack = new TokenStack(1);
        const keysT1 = makeMockDerivedKeys("T1");

        // T1 has real keys
        stack.pushNewToken({ tokenId: 1, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, keysT1);

        // T2 pushed with null derivedKeys (SecurityMode.None)
        clock.tick(10000);
        stack.pushNewToken({ tokenId: 2, createdAt: new Date(), revisedLifetime: 60000, channelId: 1 }, null);

        // getLatestTokenDerivedKeys should skip T2 (null keys) and return T1
        const latest = stack.getLatestTokenDerivedKeys();
        should(latest).not.be.null();
        should(latest?.tokenId).equal(1, "should skip T2 (null keys) and fall back to T1");
        should(latest?.derivedKeys).equal(keysT1);
    });
});
