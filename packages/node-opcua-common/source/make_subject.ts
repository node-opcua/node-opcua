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

    // 3. Validate the overall shape: one or more /KEY=VALUE segments.
    //    Keys are one or more word characters; values may be anything except a raw slash
    //    (nested values would need quoting, which is out of scope here).
    const subjectPattern = /^(?:\/[A-Za-z][A-Za-z0-9]*=[^/]+)+$/;
    if (!subjectPattern.test(normalised)) {
        throw new Error(
            `setDefaultCertificateSubject: "${value}" does not match the expected ` +
            '"/KEY=VALUE/KEY=VALUE/…" pattern (e.g. "/O=MyOrg/L=MyCity/C=US").'
        );
    }

    defaultCertificateSubject = normalised;
}

export function makeSubject(applicationName: string, hostname: string): string {
    const commonName = `${applicationName}@${hostname}`.substring(0, 63);
    const dc = `${hostname}`.substring(63);
    return `/CN=${commonName}` + `/DC=${dc}` + defaultCertificateSubject;
}
