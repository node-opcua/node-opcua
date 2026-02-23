import type { DirectoryName } from "node-opcua-crypto/web";
import type { SubjectOptions } from "node-opcua-pki";

export function subjectToString(subject: SubjectOptions & DirectoryName): string {
    let s = "";
    if (subject.commonName) s += `/CN=${subject.commonName}`;

    if (subject.country) s += `/C=${subject.country}`;
    if (subject.countryName) s += `/C=${subject.countryName}`;

    if (subject.domainComponent) s += `/DC=${subject.domainComponent}`;

    if (subject.locality) s += `/L=${subject.locality}`;
    if (subject.localityName) s += `/L=${subject.localityName}`;

    if (subject.organization) s += `/O=${subject.organization}`;
    if (subject.organizationName) s += `/O=${subject.organizationName}`;

    if (subject.organizationUnitName) s += `/OU=${subject.organizationUnitName}`;

    if (subject.state) s += `/ST=${subject.state}`;
    if (subject.stateOrProvinceName) s += `/ST=${subject.stateOrProvinceName}`;

    return s;
}
