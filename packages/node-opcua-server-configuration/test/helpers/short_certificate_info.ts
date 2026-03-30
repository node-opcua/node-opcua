import {
    type Certificate,
    exploreCertificate,
    split_der
} from "node-opcua-crypto";



export function short_certificate_info(certificateChain: Certificate | Certificate[] | null | undefined) {
    if (!certificateChain) {
        return null;
    }

    certificateChain = Array.isArray(certificateChain) ? certificateChain : split_der(certificateChain);
    const info = exploreCertificate(certificateChain[0]);
    return {
        commonName: info.tbsCertificate.subject.commonName,
        issuer: info.tbsCertificate.issuer.commonName,
        serialNumber: info.tbsCertificate.serialNumber,
        subjectKeyIdentifier: info.tbsCertificate.extensions?.subjectKeyIdentifier,
        authorityKeyIdentifierIssuer: info.tbsCertificate.extensions?.authorityKeyIdentifier?.authorityCertIssuer?.commonName,
        authorityKeyIdentifierKey: info.tbsCertificate.extensions?.authorityKeyIdentifier?.keyIdentifier
    };
}
export function short_certificate_info_toString(certificateChain: Certificate | Certificate[] | null | undefined) {
    const info = short_certificate_info(certificateChain);
    return JSON.stringify(info, null, 2);
}