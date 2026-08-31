// Regression test for reconnection deadlock after sleep/wake
//
// When a laptop sleeps and wakes, the TCP connection dies and the client starts
// reconnecting. If the connection breaks a second time during the session repair
// phase, _throwIfShouldNotContinue throws inside an async callback within a
// Promise constructor. That throw:
//
//   1. escapes the Promise (only sync throws are caught by the constructor)
//   2. is swallowed by the secure channel's modified_callback try/catch
//      ("callback has thrown en error")
//   3. leaves the Promise dangling — never resolved or rejected
//   4. the reconnection state machine stays in "reconnecting" forever
//   5. subsequent _repairConnection calls are blocked by the re-entrancy guard
//   6. the client is permanently deadlocked and can never reconnect
//
// The fix replaces `_throwIfShouldNotContinue(session)` inside async callbacks
// with `const err = _shouldNotContinue(session); if (err) return reject(err);`

import "mocha";
import should from "should";

import type { ClientSessionImpl } from "../source/private/client_session_impl.js";
import { _shouldNotContinue } from "../source/private/reconnection/reconnection.js";

/**
 * Simulates what the secure channel's `modified_callback` / `process_request_callback`
 * does: wraps the user callback in a try/catch. If it throws, the error is logged
 * ("callback has thrown en error") and silently discarded.
 */
function invokeCallbackLikeSecureChannel(callback: (err: Error | null) => void, err: Error | null): Error | null {
    try {
        callback(err);
        return null;
    } catch (caught) {
        return caught as Error;
    }
}

/**
 * Builds a minimal session double whose `_shouldNotContinue` answer
 * can be flipped at runtime.
 */
function makeSessionDouble(usable = true) {
    const session = {
        _client: {
            _secureChannel: usable ? {} : null,
            isUnusable: () => !usable
        },
        hasBeenClosed: () => false,

        // control knob
        setUsable(v: boolean) {
            if (v) {
                session._client._secureChannel = {};
                session._client.isUnusable = () => false;
            } else {
                session._client._secureChannel = null;
                session._client.isUnusable = () => true;
            }
        }
    };
    return session as unknown as ClientSessionImpl & { setUsable(v: boolean): void };
}

describe("reconnection: _throwIfShouldNotContinue inside async callback (deadlock bug)", function (this: Mocha.Suite) {
    this.timeout(5_000);

    // ── Helpers that reproduce the exact pattern from reconnection.ts ────

    /**
     * Reproduces the BUGGY pattern from `create_session_and_repeat_if_failed`
     * (reconnection.ts line 182–201):
     *
     *     new Promise((resolve, reject) => {
     *         _throwIfShouldNotContinue(session);           // sync — OK
     *         client.doSomethingAsync(session, (err) => {
     *             _throwIfShouldNotContinue(session);       // ASYNC — BUG!
     *             ...
     *         });
     *     });
     */
    function buggyCreateSession(session: ClientSessionImpl, doAsync: (cb: (err: Error | null) => void) => void): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const err1 = _shouldNotContinue(session);
            if (err1) throw err1; // sync — caught by Promise

            doAsync((err: Error | null) => {
                // BUG: throw inside async callback escapes Promise
                const err2 = _shouldNotContinue(session);
                if (err2) throw err2;

                if (err) reject(err);
                else resolve("ok");
            });
        });
    }

    /**
     * The FIXED version: uses reject() instead of throw inside the callback.
     */
    function fixedCreateSession(session: ClientSessionImpl, doAsync: (cb: (err: Error | null) => void) => void): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const err1 = _shouldNotContinue(session);
            if (err1) throw err1; // sync — caught by Promise

            doAsync((err: Error | null) => {
                const err2 = _shouldNotContinue(session);
                if (err2) return reject(err2); // FIX: reject instead of throw

                if (err) reject(err);
                else resolve("ok");
            });
        });
    }

    // ── Tests ────────────────────────────────────────────────────────────

    it("BUG: throw inside async callback causes Promise to deadlock (never settles)", async () => {
        const session = makeSessionDouble(/* usable */ true);
        let swallowedError: Error | null = null;

        // Simulate __createSession_step2: the transport invokes the callback
        // via try/catch (like modified_callback in the secure channel).
        // By the time the callback fires, the session has become unusable
        // (second disconnect during sleep/wake).
        const simulateAsync = (cb: (err: Error | null) => void) => {
            session.setUsable(false); // simulate second disconnect
            swallowedError = invokeCallbackLikeSecureChannel(cb, null);
        };

        const promise = buggyCreateSession(session, simulateAsync);

        // The throw was swallowed by the secure channel wrapper
        should(swallowedError).be.an.Error();
        // assigned in a callback, so TypeScript narrows it to null here
        should((swallowedError as Error | null)?.message).match(/Failure during reconnection/);

        // The Promise is DANGLING — it never resolves or rejects.
        // This is the deadlock: the reconnection state machine is stuck forever.
        const result = await Promise.race([
            promise.then(() => "resolved").catch(() => "rejected"),
            new Promise<string>((r) => setTimeout(() => r("DEADLOCKED"), 1000))
        ]);

        result.should.eql("DEADLOCKED");
    });

    it("FIX: reject() instead of throw properly settles the Promise", async () => {
        const session = makeSessionDouble(/* usable */ true);
        let swallowedError: Error | null = null;

        const simulateAsync = (cb: (err: Error | null) => void) => {
            session.setUsable(false);
            swallowedError = invokeCallbackLikeSecureChannel(cb, null);
        };

        const promise = fixedCreateSession(session, simulateAsync);

        // No error was swallowed — reject() was called cleanly
        (swallowedError === null).should.be.true("reject() should not throw");

        // The Promise properly rejects, so the reconnection state machine
        // can catch the error and retry.
        const result = await Promise.race([
            promise.then(() => "resolved").catch(() => "rejected"),
            new Promise<string>((r) => setTimeout(() => r("DEADLOCKED"), 1000))
        ]);

        result.should.eql("rejected");
    });

    it("BASELINE: sync throw in Promise executor is properly caught (not the bug)", async () => {
        const session = makeSessionDouble(/* usable */ false); // already unusable

        const simulateAsync = (_cb: (err: Error | null) => void) => {
            // callback never fires — sync throw happens first
        };

        const promise = buggyCreateSession(session, simulateAsync);

        // Synchronous throw IS caught by the Promise constructor — this works.
        const result = await Promise.race([
            promise.then(() => "resolved").catch(() => "rejected"),
            new Promise<string>((r) => setTimeout(() => r("DEADLOCKED"), 1000))
        ]);

        result.should.eql("rejected"); // correctly rejected
    });
});
