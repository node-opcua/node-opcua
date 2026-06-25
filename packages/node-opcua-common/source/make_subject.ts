/**
 * Build an X.509 subject string from an application name and hostname.
 *
 * Pure string utility — no filesystem or PKI dependency.
 *
 * @param applicationName  - e.g. "NodeOPCUA-Server"
 * @param hostname         - e.g. "myhost.example.com"
 * @returns a subject string like "/CN=NodeOPCUA-Server@myhost/DC=.example.com/O=Sterfive/L=Orleans/C=FR"
 *
 * @module node-opcua-common
 */
import { Subject } from "node-opcua-crypto";

/**
 * The default organisation / location portion appended to every
 * auto-generated certificate subject.
 *
 * Override this value at startup if your organisation differs.
 */
export let defaultCertificateSubject = "/O=Sterfive/L=Orleans/C=FR";

/**
 * Set the default DN suffix (Distinguished Name components such as O, L, C, …)
 * appended to every auto-generated certificate subject.
 *
 * Use this function instead of directly assigning to `defaultCertificateSubject`
 * when consuming the library as an ESM module, because ESM namespace bindings
 * are read-only from the outside and can only be mutated from within the module
 * that declared them.
 *
 * @param value - e.g. "/O=MyOrg/L=MyCity/C=US"
 *
 * @throws {Error} if the value is empty or does not match the expected `/KEY=VALUE/…` pattern.
 *
 * @example
 * ```ts
 * import { setDefaultCertificateSubject } from "node-opcua-common";
 * setDefaultCertificateSubject("/O=MyOrg/L=MyCity/C=US");
 * ```
 */
export function setDefaultCertificateSubject(value: string): void {
    // 0. Guard against non-string values from plain-JS callers.
    if (typeof value !== "string") {
        throw new TypeError(
            'Example: "/O=MyOrg/L=MyCity/C=US".'
        );
    }

    // 1. Remove surrounding whitespace that would silently corrupt the subject string.
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        throw new Error(
            'setDefaultCertificateSubject: value must not be empty. ' +
            'Expected a string like "/O=MyOrg/L=MyCity/C=US".'
        );
    }

    // 2. Ensure there is a leading slash.
    const normalised = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

    // 3. Delegate validation to existing Subject.parse() method
    try {
        Subject.parse(normalised);
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
            `setDefaultCertificateSubject: "${value}" is not a valid subject string. ${reason}`,
            { cause: err }
        );
    }

    defaultCertificateSubject = normalised;
}

export function makeSubject(applicationName: string, hostname: string): string {
    const commonName = `${applicationName}@${hostname}`.substring(0, 63);
    const dc = `${hostname}`.substring(63);
    return `/CN=${commonName}` + `/DC=${dc}` + defaultCertificateSubject;
}
