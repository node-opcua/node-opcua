/**
 * @module node-opcua-certificate-manager
 */

export { PrivateKeyPassphraseRequiredError } from "node-opcua-crypto";
export {
    CertificateManager,
    type IKeyOperations,
    type PrivateKeyPassphrase,
    type PrivateKeyProvider,
    PrivateKeyUnavailableError
} from "node-opcua-pki";
export * from "./certificate_manager";
export * from "./make_subject";
