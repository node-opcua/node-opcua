/**
 * @module node-opcua-certificate-manager
 */

export { PrivateKeyPassphraseRequiredError } from "node-opcua-crypto";
export { CertificateManager, type PrivateKeyPassphrase, type PrivateKeyProvider } from "node-opcua-pki";
export * from "./certificate_manager";
export * from "./make_subject";
