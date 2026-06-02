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
 * Set the default organisation / location portion appended to every
 * auto-generated certificate subject.
 *
 * Use this function instead of directly assigning to `defaultCertificateSubject`
 * when consuming the library as an ESM module, because ESM namespace bindings
 * are read-only from the outside and can only be mutated from within the module
 * that declared them.
 *
 * @param value - e.g. "/O=MyOrg/L=MyCity/C=US"
 *
 * @example
 * ```ts
 * import { setDefaultCertificateSubject } from "node-opcua-common";
 * setDefaultCertificateSubject("/O=MyOrg/L=MyCity/C=US");
 * ```
 */
export function setDefaultCertificateSubject(value: string): void {
    defaultCertificateSubject = value;
}

export function makeSubject(applicationName: string, hostname: string): string {
    const commonName = `${applicationName}@${hostname}`.substring(0, 63);
    const dc = `${hostname}`.substring(63);
    return `/CN=${commonName}` + `/DC=${dc}` + defaultCertificateSubject;
}
