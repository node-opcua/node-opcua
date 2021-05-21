/**
 * @module node-opcua-server-configuration
 */
import { resolveNodeId } from "node-opcua-nodeid";

export const CertificateType =  {
    Application: resolveNodeId("ApplicationCertificateType"),
    Https: resolveNodeId("HttpsCertificateType"),
    RsaMinApplication: resolveNodeId("RsaMinApplicationCertificateType"),
    RsaSha256Application: resolveNodeId("RsaSha256ApplicationCertificateType"),
};
         