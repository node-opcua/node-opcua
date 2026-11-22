/**
 * @module node-opcua-server
 */
import { type Certificate, exploreCertificate, verifyCertificateSignature } from "node-opcua-crypto/web";

/**
 * true when the certificate is signed by its own key.
 *
 * The decision comes from the signature, never from the names: a CA may
 * issue a certificate whose subject repeats its own CommonName and
 * Organization. When the signature cannot be checked (unsupported
 * algorithm, for example), the certificate counts as self-signed only if
 * its SubjectKeyIdentifier equals its AuthorityKeyIdentifier.
 */
export function isSelfSignedCertificate(certificate: Certificate): boolean {
    try {
        return verifyCertificateSignature(certificate, certificate);
    } catch {
        try {
            const extensions = exploreCertificate(certificate).tbsCertificate.extensions;
            const ski = extensions?.subjectKeyIdentifier;
            const aki = extensions?.authorityKeyIdentifier?.keyIdentifier;
            return !!ski && ski === aki;
        } catch {
            return false;
        }
    }
}
