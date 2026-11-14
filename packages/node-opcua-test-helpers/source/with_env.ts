/// <reference types="mocha" />

/**
 * Set an environment variable and return a function that restores the original value
 * (or deletes the variable if it was unset). Pass `undefined` as `value` to unset the
 * variable.
 *
 * For code that already runs inside a hook, where `withEnv` cannot register hooks:
 * keep the returned function and call it in the matching teardown.
 */
export function setEnv(key: string, value: string | undefined): () => void {
    const oldValue = process.env[key];
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value; // check-proto-pollution: ok - process.env, key is a hardcoded test constant
    }
    return () => {
        if (oldValue === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = oldValue; // check-proto-pollution: ok - process.env, key is a hardcoded test constant
        }
    };
}

/**
 * Set an environment variable for the whole enclosing suite and restore the original
 * value afterwards. Pass `undefined` as `value` to unset the variable for the suite.
 *
 * Call it in the body of a `describe`, before any `before` hook that must observe the
 * variable, because hooks run in registration order:
 *
 * ```ts
 * describe("...", () => {
 *     withEnv("NODE_OPCUA_AUTO_ACCEPT_CERTS", "true");
 *     before(async () => { ... });
 * });
 * ```
 */
export function withEnv(key: string, value: string | undefined): void {
    let restore: (() => void) | undefined;
    before(() => {
        restore = setEnv(key, value);
    });
    after(() => {
        restore?.();
    });
}
