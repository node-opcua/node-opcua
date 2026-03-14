import { resolveNodeId } from "node-opcua-nodeid";

// OPC UA Part 12 Certificate Types — resolved by BrowseName so they
// always match the loaded nodeset (no hardcoded numeric NodeIds).

export const rsaCertificateTypes = {
    RsaMinApplicationCertificateType: resolveNodeId("RsaMinApplicationCertificateType"),
    RsaSha256ApplicationCertificateType: resolveNodeId("RsaSha256ApplicationCertificateType")
} as const;
export const rsaCertificateTypesArray = Object.values(rsaCertificateTypes);

export const eccCertificateTypes = {
    EccApplicationCertificateType: resolveNodeId("EccApplicationCertificateType"),
    EccNistP256ApplicationCertificateType: resolveNodeId("EccNistP256ApplicationCertificateType"),
    EccNistP384ApplicationCertificateType: resolveNodeId("EccNistP384ApplicationCertificateType"),
    EccBrainpoolP256r1ApplicationCertificateType: resolveNodeId("EccBrainpoolP256r1ApplicationCertificateType"),
    EccBrainpoolP384r1ApplicationCertificateType: resolveNodeId("EccBrainpoolP384r1ApplicationCertificateType"),
    EccCurve25519ApplicationCertificateType: resolveNodeId("EccCurve25519ApplicationCertificateType"),
    EccCurve448ApplicationCertificateType: resolveNodeId("EccCurve448ApplicationCertificateType")
} as const;
export const eccCertificateTypesArray = Object.values(eccCertificateTypes);
