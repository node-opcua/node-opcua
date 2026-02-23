import { resolveNodeId } from "node-opcua-nodeid";

// OPC UA Part 12 Certificate Types - defined once to avoid duplication
export const rsaCertificateTypes = {
    ApplicationInstanceCertificate_RSA_Min_Deprecated: resolveNodeId("ns=0;i=12537"),
    ApplicationInstanceCertificate_RSA_Sha256: resolveNodeId("ns=0;i=12538"),
    ApplicationInstanceCertificate_RSA_Sha256_2048: resolveNodeId("ns=0;i=12541"),
    ApplicationInstanceCertificate_RSA_Sha256_4096: resolveNodeId("ns=0;i=12542")
} as const;
export const rsaCertificateTypesArray = Object.values(rsaCertificateTypes);

export const eccCertificateTypes = {
    ApplicationInstanceCertificate_ECC_Deprecated: resolveNodeId("ns=0;i=12556"), // deprecated
    ApplicationInstanceCertificate_ECC_nistP256: resolveNodeId("ns=0;i=12557"),
    ApplicationInstanceCertificate_ECC_nistP384: resolveNodeId("ns=0;i=12558"),
    ApplicationInstanceCertificate_ECC_brainpoolP256r1: resolveNodeId("ns=0;i=12559"),
    ApplicationInstanceCertificate_ECC_brainpoolP384r1: resolveNodeId("ns=0;i=12560"),
    ApplicationInstanceCertificate_ECC_curve25519: resolveNodeId("ns=0;i=12561"),
    ApplicationInstanceCertificate_ECC_curve448: resolveNodeId("ns=0;i=12562")
} as const;
export const eccCertificateTypesArray = Object.values(eccCertificateTypes);
