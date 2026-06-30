/**
 * @module node-opcua-role-set-common
 *
 * Helpers for matching an `X509Subject` identity mapping rule against a
 * certificate subject, following the ordered Distinguished Name format
 * defined in OPC 10000-18 §4.4.3 (Table 10).
 */

/**
 * Subject attributes of a certificate, as exposed by
 * `exploreCertificate(...).tbsCertificate.subject` (node-opcua-crypto).
 */
export interface X509SubjectName {
    commonName?: string;
    organizationName?: string;
    organizationUnitName?: string;
    localityName?: string;
    stateOrProvinceName?: string;
    countryName?: string;
}

/**
 * Order of the X509 subject name attributes (OPC 10000-18 §4.4.3, Table 10).
 *
 * Only the attributes that {@link X509SubjectName} exposes are mappable here
 * (CN, O, OU, L, S, C). DC, dnQualifier and serialNumber are listed for
 * completeness/ordering but are not extracted from certificates.
 */
export const X509_SUBJECT_ORDER = ["CN", "O", "OU", "DC", "L", "S", "C", "dnQualifier", "serialNumber"];

/** Build the canonical `Name="Value"/...` string from ordered name/value pairs. */
export function canonicalizeX509Subject(pairs: Array<[string, string]>): string {
    return pairs
        .map((pair, index) => ({ pair, index }))
        .filter(({ pair }) => X509_SUBJECT_ORDER.includes(pair[0]))
        .sort((a, b) => {
            const d = X509_SUBJECT_ORDER.indexOf(a.pair[0]) - X509_SUBJECT_ORDER.indexOf(b.pair[0]);
            return d !== 0 ? d : a.index - b.index;
        })
        .map(({ pair }) => `${pair[0]}="${pair[1]}"`)
        .join("/");
}

/** Parse a `CN="..."/O="..."` criteria String into ordered name/value pairs. */
export function parseX509SubjectCriteria(criteria: string): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    const re = /([A-Za-z]+)\s*=\s*"((?:[^"])*)"/g;
    for (const m of criteria.matchAll(re)) {
        pairs.push([m[1], m[2]]);
    }
    return pairs;
}

/** Build ordered name/value pairs from a certificate subject. */
export function certificateSubjectPairs(subject: X509SubjectName): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    if (subject.commonName) pairs.push(["CN", subject.commonName]);
    if (subject.organizationName) pairs.push(["O", subject.organizationName]);
    if (subject.organizationUnitName) pairs.push(["OU", subject.organizationUnitName]);
    if (subject.localityName) pairs.push(["L", subject.localityName]);
    if (subject.stateOrProvinceName) pairs.push(["S", subject.stateOrProvinceName]);
    if (subject.countryName) pairs.push(["C", subject.countryName]);
    return pairs;
}

/**
 * Test whether an `X509Subject` criteria matches a certificate subject.
 *
 * Two criteria formats are accepted:
 * - the full ordered DN format (e.g. `CN="Jane Doe"/O="ACME"`), in which case
 *   **every** mappable subject attribute present in the certificate must be
 *   present in the criteria and vice-versa;
 * - a plain Common Name string (legacy/simplified), compared against the
 *   certificate's `commonName` only.
 */
export function matchX509Subject(criteria: string, subject: X509SubjectName): boolean {
    const trimmed = (criteria ?? "").trim();
    if (/[A-Za-z]+\s*=\s*"/.test(trimmed)) {
        return (
            canonicalizeX509Subject(certificateSubjectPairs(subject)) === canonicalizeX509Subject(parseX509SubjectCriteria(trimmed))
        );
    }
    return (subject.commonName ?? "") === trimmed;
}
