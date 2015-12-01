"use strict";
/*jslint bitwise: true */
// ---------------------------------------------------------------------------------------------------------------------
// crypto_read_certificate
// ---------------------------------------------------------------------------------------------------------------------
// Copyright (c) 2014-2015 - Etienne Rossignon
// ---------------------------------------------------------------------------------------------------------------------
//
// This  project is licensed under the terms of the MIT license.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so,  subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
//
// ---------------------------------------------------------------------------------------------------------------------
// ASN.1 JavaScript decoder Copyright (c) 2008-2014 Lapo Luchini lapo@lapo.it
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
// granted, provided that the above copyright notice and this permission notice appear in all copies.
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
// AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
// PERFORMANCE OF THIS SOFTWARE.
// ---------------------------------------------------------------------------------------------------------------------

// references:
//  - http://tools.ietf.org/html/rfc5280
//  - http://www-lor.int-evry.fr/~michel/Supports/presentation.pdf
//  - ftp://ftp.rsa.com/pub/pkcs/ascii/layman.asc
//  - pubs.opengroup.org/onlinepubs/009609799/7a_nch02.htm#tagcjh_49_03
//  - https://github.com/lapo-luchini/asn1js/blob/master/asn1.js
//  - http://lapo.it/asn1js
//  - https://www.cs.auckland.ac.nz/~pgut001/dumpasn1.cfg
//  - http://pubs.opengroup.org/onlinepubs/009609799/7a_nch02.htm
//  - http://stackoverflow.com/questions/5929050/how-does-asn-1-encode-an-object-identifier
//  - http://luca.ntop.org/Teaching/Appunti/asn1.html

// note:
//  - http://commandlinefanatic.com/cgi-bin/showarticle.cgi?article=art030
//  openssl can be also used to discover the content of a DER file
//  $ openssl asn1parse -in cert.pem

var assert = require("better-assert");
var hexDump = require("./utils").hexDump;
var _ = require("underscore");

// Converted from: https://www.cs.auckland.ac.nz/~pgut001/dumpasn1.cfg
// which is made by Peter Gutmann and whose license states:
// You can use this code in whatever way you want,
// as long as you don't try to claim you wrote it.

// https://github.com/lapo-luchini/asn1js/blob/master/asn1.js
var tagTypes = {
    BOOLEAN: 0x01,
    INTEGER: 0x02,
    BIT_STRING: 0x03,
    OCTET_STRING: 0x04,
    NULL: 0x05,
    OBJECT_IDENTIFIER: 0x06,
    UTF8String: 0x0C,
    NumericString: 0x12,
    PrintableString: 0x13,
    TeletexString: 0x14,
    IA5String: 0x16,
    UTCTime: 0x17,
    GeneralizedTime: 0x18

};

// https://github.com/lapo-luchini/asn1js/blob/master/oids.js
var oid_map = {

    "1.2.840.113549.1.1": {"d": "pkcs-1", "c": "", "w": false},
    "1.2.840.113549.1.1.1": {"d": "rsaEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.2": {"d": "md2WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.3": {"d": "md4WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.4": {"d": "md5WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.5": {"d": "sha1WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.7": {"d": "rsaOAEP", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.8": {"d": "pkcs1-MGF", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.9": {"d": "rsaOAEP-pSpecified", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.10": {"d": "rsaPSS", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.11": {"d": "sha256WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.12": {"d": "sha384WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.13": {"d": "sha512WithRSAEncryption", "c": "PKCS #1", "w": false},
    "1.2.840.113549.1.1.14": {"d": "sha224WithRSAEncryption", "c": "PKCS #1", "w": false},

    "1.2.840.113549.1.9.1": {
        "d": "emailAddress",
        "c": "PKCS #9. Deprecated, use an altName extension instead",
        "w": false
    },
    "1.2.840.113549.1.9.2": {"d": "unstructuredName", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.3": {"d": "contentType", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.4": {"d": "messageDigest", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.5": {"d": "signingTime", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.6": {"d": "countersignature", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.7": {"d": "challengePassword", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.8": {"d": "unstructuredAddress", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.9": {"d": "extendedCertificateAttributes", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.10": {"d": "issuerAndSerialNumber", "c": "PKCS #9 experimental", "w": true},
    "1.2.840.113549.1.9.11": {"d": "passwordCheck", "c": "PKCS #9 experimental", "w": true},
    "1.2.840.113549.1.9.12": {"d": "publicKey", "c": "PKCS #9 experimental", "w": true},
    "1.2.840.113549.1.9.13": {"d": "signingDescription", "c": "PKCS #9", "w": false},
    "1.2.840.113549.1.9.14": {"d": "extensionRequest", "c": "PKCS #9 via CRMF", "w": false},

    "2.5.4.0": {"d": "objectClass", "c": "X.520 DN component", "w": false},
    "2.5.4.1": {"d": "aliasedEntryName", "c": "X.520 DN component", "w": false},
    "2.5.4.2": {"d": "knowledgeInformation", "c": "X.520 DN component", "w": false},
    "2.5.4.3": {"d": "commonName", "c": "X.520 DN component", "w": false},
    "2.5.4.4": {"d": "surname", "c": "X.520 DN component", "w": false},
    "2.5.4.5": {"d": "serialNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.6": {"d": "countryName", "c": "X.520 DN component", "w": false},
    "2.5.4.7": {"d": "localityName", "c": "X.520 DN component", "w": false},
    "2.5.4.7.1": {"d": "collectiveLocalityName", "c": "X.520 DN component", "w": false},
    "2.5.4.8": {"d": "stateOrProvinceName", "c": "X.520 DN component", "w": false},
    "2.5.4.8.1": {"d": "collectiveStateOrProvinceName", "c": "X.520 DN component", "w": false},
    "2.5.4.9": {"d": "streetAddress", "c": "X.520 DN component", "w": false},
    "2.5.4.9.1": {"d": "collectiveStreetAddress", "c": "X.520 DN component", "w": false},
    "2.5.4.10": {"d": "organizationName", "c": "X.520 DN component", "w": false},
    "2.5.4.10.1": {"d": "collectiveOrganizationName", "c": "X.520 DN component", "w": false},
    "2.5.4.11": {"d": "organizationalUnitName", "c": "X.520 DN component", "w": false},
    "2.5.4.11.1": {"d": "collectiveOrganizationalUnitName", "c": "X.520 DN component", "w": false},
    "2.5.4.12": {"d": "title", "c": "X.520 DN component", "w": false},
    "2.5.4.13": {"d": "description", "c": "X.520 DN component", "w": false},
    "2.5.4.14": {"d": "searchGuide", "c": "X.520 DN component", "w": false},
    "2.5.4.15": {"d": "businessCategory", "c": "X.520 DN component", "w": false},
    "2.5.4.16": {"d": "postalAddress", "c": "X.520 DN component", "w": false},
    "2.5.4.16.1": {"d": "collectivePostalAddress", "c": "X.520 DN component", "w": false},
    "2.5.4.17": {"d": "postalCode", "c": "X.520 DN component", "w": false},
    "2.5.4.17.1": {"d": "collectivePostalCode", "c": "X.520 DN component", "w": false},
    "2.5.4.18": {"d": "postOfficeBox", "c": "X.520 DN component", "w": false},
    "2.5.4.18.1": {"d": "collectivePostOfficeBox", "c": "X.520 DN component", "w": false},
    "2.5.4.19": {"d": "physicalDeliveryOfficeName", "c": "X.520 DN component", "w": false},
    "2.5.4.19.1": {"d": "collectivePhysicalDeliveryOfficeName", "c": "X.520 DN component", "w": false},
    "2.5.4.20": {"d": "telephoneNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.20.1": {"d": "collectiveTelephoneNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.21": {"d": "telexNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.21.1": {"d": "collectiveTelexNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.22": {"d": "teletexTerminalIdentifier", "c": "X.520 DN component", "w": false},
    "2.5.4.22.1": {"d": "collectiveTeletexTerminalIdentifier", "c": "X.520 DN component", "w": false},
    "2.5.4.23": {"d": "facsimileTelephoneNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.23.1": {"d": "collectiveFacsimileTelephoneNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.24": {"d": "x121Address", "c": "X.520 DN component", "w": false},
    "2.5.4.25": {"d": "internationalISDNNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.25.1": {"d": "collectiveInternationalISDNNumber", "c": "X.520 DN component", "w": false},
    "2.5.4.26": {"d": "registeredAddress", "c": "X.520 DN component", "w": false},
    "2.5.4.27": {"d": "destinationIndicator", "c": "X.520 DN component", "w": false},
    "2.5.4.28": {"d": "preferredDeliveryMehtod", "c": "X.520 DN component", "w": false},
    "2.5.4.29": {"d": "presentationAddress", "c": "X.520 DN component", "w": false},
    "2.5.4.30": {"d": "supportedApplicationContext", "c": "X.520 DN component", "w": false},
    "2.5.4.31": {"d": "member", "c": "X.520 DN component", "w": false},
    "2.5.4.32": {"d": "owner", "c": "X.520 DN component", "w": false},
    "2.5.4.33": {"d": "roleOccupant", "c": "X.520 DN component", "w": false},
    "2.5.4.34": {"d": "seeAlso", "c": "X.520 DN component", "w": false},
    "2.5.4.35": {"d": "userPassword", "c": "X.520 DN component", "w": false},
    "2.5.4.36": {"d": "userCertificate", "c": "X.520 DN component", "w": false},
    "2.5.4.37": {"d": "caCertificate", "c": "X.520 DN component", "w": false},
    "2.5.4.38": {"d": "authorityRevocationList", "c": "X.520 DN component", "w": false},
    "2.5.4.39": {"d": "certificateRevocationList", "c": "X.520 DN component", "w": false},
    "2.5.4.40": {"d": "crossCertificatePair", "c": "X.520 DN component", "w": false},
    "2.5.4.41": {"d": "name", "c": "X.520 DN component", "w": false},
    "2.5.4.42": {"d": "givenName", "c": "X.520 DN component", "w": false},
    "2.5.4.43": {"d": "initials", "c": "X.520 DN component", "w": false},
    "2.5.4.44": {"d": "generationQualifier", "c": "X.520 DN component", "w": false},
    "2.5.4.45": {"d": "uniqueIdentifier", "c": "X.520 DN component", "w": false},
    "2.5.4.46": {"d": "dnQualifier", "c": "X.520 DN component", "w": false},
    "2.5.4.47": {"d": "enhancedSearchGuide", "c": "X.520 DN component", "w": false},
    "2.5.4.48": {"d": "protocolInformation", "c": "X.520 DN component", "w": false},
    "2.5.4.49": {"d": "distinguishedName", "c": "X.520 DN component", "w": false},
    "2.5.4.50": {"d": "uniqueMember", "c": "X.520 DN component", "w": false},
    "2.5.4.51": {"d": "houseIdentifier", "c": "X.520 DN component", "w": false},
    "2.5.4.52": {"d": "supportedAlgorithms", "c": "X.520 DN component", "w": false},
    "2.5.4.53": {"d": "deltaRevocationList", "c": "X.520 DN component", "w": false},
    "2.5.4.54": {"d": "dmdName", "c": "X.520 DN component", "w": false},
    "2.5.4.55": {"d": "clearance", "c": "X.520 DN component", "w": false},
    "2.5.4.56": {"d": "defaultDirQop", "c": "X.520 DN component", "w": false},
    "2.5.4.57": {"d": "attributeIntegrityInfo", "c": "X.520 DN component", "w": false},
    "2.5.4.58": {"d": "attributeCertificate", "c": "X.520 DN component", "w": false},
    "2.5.4.59": {"d": "attributeCertificateRevocationList", "c": "X.520 DN component", "w": false},
    "2.5.4.60": {"d": "confKeyInfo", "c": "X.520 DN component", "w": false},
    "2.5.4.61": {"d": "aACertificate", "c": "X.520 DN component", "w": false},
    "2.5.4.62": {"d": "attributeDescriptorCertificate", "c": "X.520 DN component", "w": false},
    "2.5.4.63": {"d": "attributeAuthorityRevocationList", "c": "X.520 DN component", "w": false},
    "2.5.4.64": {"d": "familyInformation", "c": "X.520 DN component", "w": false},
    "2.5.4.65": {"d": "pseudonym", "c": "X.520 DN component", "w": false},
    "2.5.4.66": {"d": "communicationsService", "c": "X.520 DN component", "w": false},
    "2.5.4.67": {"d": "communicationsNetwork", "c": "X.520 DN component", "w": false},
    "2.5.4.68": {"d": "certificationPracticeStmt", "c": "X.520 DN component", "w": false},
    "2.5.4.69": {"d": "certificatePolicy", "c": "X.520 DN component", "w": false},
    "2.5.4.70": {"d": "pkiPath", "c": "X.520 DN component", "w": false},
    "2.5.4.71": {"d": "privPolicy", "c": "X.520 DN component", "w": false},
    "2.5.4.72": {"d": "role", "c": "X.520 DN component", "w": false},
    "2.5.4.73": {"d": "delegationPath", "c": "X.520 DN component", "w": false},
    "2.5.4.74": {"d": "protPrivPolicy", "c": "X.520 DN component", "w": false},
    "2.5.4.75": {"d": "xMLPrivilegeInfo", "c": "X.520 DN component", "w": false},
    "2.5.4.76": {"d": "xmlPrivPolicy", "c": "X.520 DN component", "w": false},
    "2.5.4.82": {"d": "permission", "c": "X.520 DN component", "w": false},
    "2.5.6.0": {"d": "top", "c": "X.520 objectClass", "w": false},
    "2.5.6.1": {"d": "alias", "c": "X.520 objectClass", "w": false},
    "2.5.6.2": {"d": "country", "c": "X.520 objectClass", "w": false},
    "2.5.6.3": {"d": "locality", "c": "X.520 objectClass", "w": false},
    "2.5.6.4": {"d": "organization", "c": "X.520 objectClass", "w": false},
    "2.5.6.5": {"d": "organizationalUnit", "c": "X.520 objectClass", "w": false},
    "2.5.6.6": {"d": "person", "c": "X.520 objectClass", "w": false},
    "2.5.6.7": {"d": "organizationalPerson", "c": "X.520 objectClass", "w": false},
    "2.5.6.8": {"d": "organizationalRole", "c": "X.520 objectClass", "w": false},
    "2.5.6.9": {"d": "groupOfNames", "c": "X.520 objectClass", "w": false},
    "2.5.6.10": {"d": "residentialPerson", "c": "X.520 objectClass", "w": false},
    "2.5.6.11": {"d": "applicationProcess", "c": "X.520 objectClass", "w": false},
    "2.5.6.12": {"d": "applicationEntity", "c": "X.520 objectClass", "w": false},
    "2.5.6.13": {"d": "dSA", "c": "X.520 objectClass", "w": false},
    "2.5.6.14": {"d": "device", "c": "X.520 objectClass", "w": false},
    "2.5.6.15": {"d": "strongAuthenticationUser", "c": "X.520 objectClass", "w": false},
    "2.5.6.16": {"d": "certificateAuthority", "c": "X.520 objectClass", "w": false},
    "2.5.6.17": {"d": "groupOfUniqueNames", "c": "X.520 objectClass", "w": false},
    "2.5.6.21": {"d": "pkiUser", "c": "X.520 objectClass", "w": false},
    "2.5.6.22": {"d": "pkiCA", "c": "X.520 objectClass", "w": false},

    "2.5.29.1": {"d": "authorityKeyIdentifier", "c": "X.509 extension. Deprecated, use 2 5 29 35 instead", "w": true},
    "2.5.29.2": {"d": "keyAttributes", "c": "X.509 extension. Obsolete, use keyUsage/extKeyUsage instead", "w": true},
    "2.5.29.3": {"d": "certificatePolicies", "c": "X.509 extension. Deprecated, use 2 5 29 32 instead", "w": true},
    "2.5.29.4": {
        "d": "keyUsageRestriction",
        "c": "X.509 extension. Obsolete, use keyUsage/extKeyUsage instead",
        "w": true
    },
    "2.5.29.5": {"d": "policyMapping", "c": "X.509 extension. Deprecated, use 2 5 29 33 instead", "w": true},
    "2.5.29.6": {"d": "subtreesConstraint", "c": "X.509 extension. Obsolete, use nameConstraints instead", "w": true},
    "2.5.29.7": {"d": "subjectAltName", "c": "X.509 extension. Deprecated, use 2 5 29 17 instead", "w": true},
    "2.5.29.8": {"d": "issuerAltName", "c": "X.509 extension. Deprecated, use 2 5 29 18 instead", "w": true},
    "2.5.29.9": {"d": "subjectDirectoryAttributes", "c": "X.509 extension", "w": false},
    "2.5.29.10": {"d": "basicConstraints", "c": "X.509 extension. Deprecated, use 2 5 29 19 instead", "w": true},
    "2.5.29.11": {"d": "nameConstraints", "c": "X.509 extension. Deprecated, use 2 5 29 30 instead", "w": true},
    "2.5.29.12": {"d": "policyConstraints", "c": "X.509 extension. Deprecated, use 2 5 29 36 instead", "w": true},
    "2.5.29.13": {"d": "basicConstraints", "c": "X.509 extension. Deprecated, use 2 5 29 19 instead", "w": true},
    "2.5.29.14": {"d": "subjectKeyIdentifier", "c": "X.509 extension", "w": false},
    "2.5.29.15": {"d": "keyUsage", "c": "X.509 extension", "w": false},
    "2.5.29.16": {"d": "privateKeyUsagePeriod", "c": "X.509 extension", "w": false},
    "2.5.29.17": {"d": "subjectAltName", "c": "X.509 extension", "w": false},
    "2.5.29.18": {"d": "issuerAltName", "c": "X.509 extension", "w": false},
    "2.5.29.19": {"d": "basicConstraints", "c": "X.509 extension", "w": false},
    "2.5.29.20": {"d": "cRLNumber", "c": "X.509 extension", "w": false},
    "2.5.29.21": {"d": "cRLReason", "c": "X.509 extension", "w": false},
    "2.5.29.22": {"d": "expirationDate", "c": "X.509 extension. Deprecated, alternative OID uncertain", "w": true},
    "2.5.29.23": {"d": "instructionCode", "c": "X.509 extension", "w": false},
    "2.5.29.24": {"d": "invalidityDate", "c": "X.509 extension", "w": false},
    "2.5.29.25": {"d": "cRLDistributionPoints", "c": "X.509 extension. Deprecated, use 2 5 29 31 instead", "w": true},
    "2.5.29.26": {
        "d": "issuingDistributionPoint",
        "c": "X.509 extension. Deprecated, use 2 5 29 28 instead",
        "w": true
    },
    "2.5.29.27": {"d": "deltaCRLIndicator", "c": "X.509 extension", "w": false},
    "2.5.29.28": {"d": "issuingDistributionPoint", "c": "X.509 extension", "w": false},
    "2.5.29.29": {"d": "certificateIssuer", "c": "X.509 extension", "w": false},
    "2.5.29.30": {"d": "nameConstraints", "c": "X.509 extension", "w": false},
    "2.5.29.31": {"d": "cRLDistributionPoints", "c": "X.509 extension", "w": false},
    "2.5.29.32": {"d": "certificatePolicies", "c": "X.509 extension", "w": false},
    "2.5.29.32.0": {"d": "anyPolicy", "c": "X.509 certificate policy", "w": false},
    "2.5.29.33": {"d": "policyMappings", "c": "X.509 extension", "w": false},
    "2.5.29.34": {"d": "policyConstraints", "c": "X.509 extension. Deprecated, use 2 5 29 36 instead", "w": true},
    "2.5.29.35": {"d": "authorityKeyIdentifier", "c": "X.509 extension", "w": false},
    "2.5.29.36": {"d": "policyConstraints", "c": "X.509 extension", "w": false},
    "2.5.29.37": {"d": "extKeyUsage", "c": "X.509 extension", "w": false},
    "2.5.29.37.0": {"d": "anyExtendedKeyUsage", "c": "X.509 extended key usage", "w": false},
    "2.5.29.38": {"d": "authorityAttributeIdentifier", "c": "X.509 extension", "w": false},
    "2.5.29.39": {"d": "roleSpecCertIdentifier", "c": "X.509 extension", "w": false},
    "2.5.29.40": {"d": "cRLStreamIdentifier", "c": "X.509 extension", "w": false},
    "2.5.29.41": {"d": "basicAttConstraints", "c": "X.509 extension", "w": false},
    "2.5.29.42": {"d": "delegatedNameConstraints", "c": "X.509 extension", "w": false},
    "2.5.29.43": {"d": "timeSpecification", "c": "X.509 extension", "w": false},
    "2.5.29.44": {"d": "cRLScope", "c": "X.509 extension", "w": false},
    "2.5.29.45": {"d": "statusReferrals", "c": "X.509 extension", "w": false},
    "2.5.29.46": {"d": "freshestCRL", "c": "X.509 extension", "w": false},
    "2.5.29.47": {"d": "orderedList", "c": "X.509 extension", "w": false},
    "2.5.29.48": {"d": "attributeDescriptor", "c": "X.509 extension", "w": false},
    "2.5.29.49": {"d": "userNotice", "c": "X.509 extension", "w": false},
    "2.5.29.50": {"d": "sOAIdentifier", "c": "X.509 extension", "w": false},
    "2.5.29.51": {"d": "baseUpdateTime", "c": "X.509 extension", "w": false},
    "2.5.29.52": {"d": "acceptableCertPolicies", "c": "X.509 extension", "w": false},
    "2.5.29.53": {"d": "deltaInfo", "c": "X.509 extension", "w": false},
    "2.5.29.54": {"d": "inhibitAnyPolicy", "c": "X.509 extension", "w": false},
    "2.5.29.55": {"d": "targetInformation", "c": "X.509 extension", "w": false},
    "2.5.29.56": {"d": "noRevAvail", "c": "X.509 extension", "w": false},
    "2.5.29.57": {"d": "acceptablePrivilegePolicies", "c": "X.509 extension", "w": false},
    "2.5.29.58": {"d": "toBeRevoked", "c": "X.509 extension", "w": false},
    "2.5.29.59": {"d": "revokedGroups", "c": "X.509 extension", "w": false},
    "2.5.29.60": {"d": "expiredCertsOnCRL", "c": "X.509 extension", "w": false},
    "2.5.29.61": {"d": "indirectIssuer", "c": "X.509 extension", "w": false},
    "2.5.29.62": {"d": "noAssertion", "c": "X.509 extension", "w": false},
    "2.5.29.63": {"d": "aAissuingDistributionPoint", "c": "X.509 extension", "w": false},
    "2.5.29.64": {"d": "issuedOnBehalfOf", "c": "X.509 extension", "w": false},
    "2.5.29.65": {"d": "singleUse", "c": "X.509 extension", "w": false},
    "2.5.29.66": {"d": "groupAC", "c": "X.509 extension", "w": false},
    "2.5.29.67": {"d": "allowedAttAss", "c": "X.509 extension", "w": false},
    "2.5.29.68": {"d": "attributeMappings", "c": "X.509 extension", "w": false},
    "2.5.29.69": {"d": "holderNameConstraints", "c": "X.509 extension", "w": false},
    "done": {}
};

function readTag(buf, pos) {

    assert(buf instanceof Buffer);
    assert(_.isNumber(pos));
    var tag = buf.readUInt8(pos);
    pos += 1;

    var length = buf.readUInt8(pos);
    pos += 1;

    if (length > 127) {
        var nbBytes = (length & 0x7F);
        length = 0;
        for (var i = 0; i < nbBytes; i++) {
            length = length * 256 + buf.readUInt8(pos);
            pos += 1;
        }
    }
    return {tag: tag, position: pos, length: length};
}


function readStruct(buf, block_info) {

    var length = block_info.length;
    var cursor = block_info.position;
    var end = block_info.position + length;
    var blocks = [];
    while (cursor < end) {
        var inner = readTag(buf, cursor);
        cursor = inner.position + inner.length;
        blocks.push(inner);
    }
    return blocks;
}

function get_block(buffer, block) {
    var start = block.position;
    var end = block.position + block.length;
    return buffer.slice(start, end);
}


function parseBitString(buffer, start, end, maxLength) {

    var unusedBit = buffer.readUInt8(start),
        lenBit = ((end - start - 1) << 3) - unusedBit,
        intro = "(" + lenBit + " bit)\n",
        s = "",
        skip = unusedBit;

    for (var i = end - 1; i > start; --i) {

        var b = buffer.readUInt8(i);

        for (var j = skip; j < 8; ++j) {
            s += ((b >> j) & 1) ? "1" : "0";
        }

        skip = 0;
        assert(s.length <= maxLength);

    }

    return intro + s;
}

function read_BitString(buffer, block) {

    assert(block.tag === tagTypes.BIT_STRING);

    var data = get_block(buffer, block);

    // number of skipped bits
    var ignore_bits = data.readUInt8(0);

    return {
        lengthInBits: data.length * 8 - ignore_bits,
        lengthInBytes: data.length - 1,
        data: data.slice(1),
        debug: parseBitString(buffer, block.position, block.length + block.position, 5000)
    };
}

function read_OctetString(buffer,block) {

    assert(block.tag === tagTypes.OCTET_STRING);
    var tag = readTag(buffer,block.position);
    assert(tag.tag === tagTypes.OCTET_STRING);

    var nbBytes = tag.length;
    var pos = tag.position;

    var value = [];
    for (var i = 0; i < nbBytes; i++) {
        value.push(('00' + buffer.readUInt8(pos).toString(16)).substr(-2, 2));
        pos += 1;
    }
    return value.join(":");
}

function read_SignatureValue(buffer, block) {
    return get_block(buffer, block).toString("hex");
}

function read_LongIntegerValue(buffer, block) {
    assert(block.tag === tagTypes.INTEGER, "expecting a INTEGER tag");
    var pos = block.position;
    var nbBytes = block.length;
    var value = [];
    for (var i = 0; i < nbBytes; i++) {
        value.push(('00' + buffer.readUInt8(pos).toString(16)).substr(-2, 2));
        pos += 1;
    }
    return value.join(":");
}

function read_IntegerValue(buffer, block) {
    assert(block.tag === tagTypes.INTEGER, "expecting a INTEGER tag");
    var pos = block.position;
    var nbBytes = block.length;
    assert(nbBytes < 4);
    var value = 0;
    for (var i = 0; i < nbBytes; i++) {
        value = value * 256 + buffer.readUInt8(pos);
        pos += 1;
    }
    return value;

}
function read_VersionValue(buffer, block) {
    block = readTag(buffer, block.position);
    return read_IntegerValue(buffer, block);
}


/*
 http://tools.ietf.org/html/rfc5280

 4.1.2.5. Validity
 [...]
 As conforming to this profile MUST always encode certificate
 validity dates through the year 2049 as UTCTime; certificate validity
 dates in 2050 or later MUST be encoded as GeneralizedTime.
 Conforming applications MUST be able to process validity dates that
 are encoded in either UTCTime or GeneralizedTime.
 [...]

 4.1.2.5.1  UTCTime

 The universal time type, UTCTime, is a standard ASN.1 type intended
 for representation of dates and time.  UTCTime specifies the year
 through the two low order digits and time is specified to the
 precision of one minute or one second.  UTCTime includes either Z
 (for Zulu, or Greenwich Mean Time) or a time differential.

 For the purposes of this profile, UTCTime values MUST be expressed
 Greenwich Mean Time (Zulu) and MUST include seconds (i.e., times are
 YYMMDDHHMMSSZ), even where the number of seconds is zero.  Conforming
 systems MUST interpret the year field (YY) as follows:

 Where YY is greater than or equal to 50, the year SHALL be
 interpreted as 19YY; and

 Where YY is less than 50, the year SHALL be interpreted as 20YY.
 */
function convertUTCTime(str) {

    var year, month, day, hours, mins, secs;
    year = parseInt(str.substr(0, 2), 10);
    month = parseInt(str.substr(2, 2), 10) - 1;
    day = parseInt(str.substr(4, 2), 10);
    hours = parseInt(str.substr(6, 2), 10);
    mins = parseInt(str.substr(8, 2), 10);
    secs = parseInt(str.substr(10, 2), 10);

    year += year >= 50 ? 1900 : 2000;

    return new Date(Date.UTC(year, month, day, hours, mins, secs));

}

/*
 4.1.2.5.2  GeneralizedTime

 The generalized time type, GeneralizedTime, is a standard ASN.1 type
 for variable precision representation of time.  Optionally, the
 GeneralizedTime field can include a representation of the time
 differential between local and Greenwich Mean Time.

 For the purposes of this profile, GeneralizedTime values MUST be
 expressed Greenwich Mean Time (Zulu) and MUST include seconds (i.e.,
 times are YYYYMMDDHHMMSSZ), even where the number of seconds is zero.
 GeneralizedTime values MUST NOT include fractional seconds.

 */
function convertGeneralizedTime(str) {

    var year, month, day, hours, mins, secs;

    year = parseInt(str.substr(0, 4), 10);
    month = parseInt(str.substr(4, 2), 10) - 1;
    day = parseInt(str.substr(6, 2), 10);
    hours = parseInt(str.substr(8, 2), 10);
    mins = parseInt(str.substr(10, 2), 10);
    secs = parseInt(str.substr(12, 2), 10);

    return new Date(Date.UTC(year, month, day, hours, mins, secs));

}

function read_Value(buffer, block) {
    switch (block.tag) {
        case tagTypes.PrintableString:
        case tagTypes.TeletexString:
        case tagTypes.UTF8String:
        case tagTypes.NumericString:
        case tagTypes.IA5String:
            return get_block(buffer, block).toString("ascii");
        case tagTypes.UTCTime:
            return convertUTCTime(get_block(buffer, block).toString("ascii"));
        case tagTypes.GeneralizedTime:
            return convertGeneralizedTime(get_block(buffer, block).toString("ascii"));
        default:
            console.log("Invalid tag 0x", block.tag.toString(16), "");
            return " ??? <" + block.tag + ">";
    }
}

function read_AttributeTypeAndValue(buffer, block) {

    var inner_blocks = readStruct(buffer, block);
    inner_blocks = readStruct(buffer, inner_blocks[0]);

    var data = {
        identifier: read_ObjectIdentifier(buffer, inner_blocks[0]),
        value: read_Value(buffer, inner_blocks[1])
    };

    var result = {};
    _.forEach(data, function (value, key) {
        result[key] = value;
    });
    return result;
}

function read_RelativeDistinguishedName(buffer, block) {
    var inner_blocks = readStruct(buffer, block);
    var data = inner_blocks.map(function (block) {
        return read_AttributeTypeAndValue(buffer, block);
    });
    var result = {};
    _.forEach(data, function (e) {
        result[e.identifier] = e.value;
    });
    return result;
}

function read_Name(buffer, block) {
    return read_RelativeDistinguishedName(buffer, block);
}

function read_time(buffer, block) {
    return read_Value(buffer, block);
}
function read_Validity(buffer, block) {
    var inner_blocks = readStruct(buffer, block);
    return {
        notBefore: read_time(buffer, inner_blocks[0]),
        notAfter: read_time(buffer, inner_blocks[1])
    };
}

function read_authorityKeyIdentifier(buffer) {
    // see: https://www.ietf.org/rfc/rfc3280.txt page 25
    // AuthorityKeyIdentifier ::= SEQUENCE {
    //      keyIdentifier             [0] KeyIdentifier           OPTIONAL,
    //      authorityCertIssuer       [1] GeneralNames            OPTIONAL,
    //      authorityCertSerialNumber [2] CertificateSerialNumber OPTIONAL  }
    // KeyIdentifier ::= OCTET STRING

    var block = readTag(buffer, 0);
    var inner_blocks = readStruct(buffer, block);

    var keyIdentifier_block              = find_block_at_index(inner_blocks, 0);
    var authorityCertIssuer_block        = find_block_at_index(inner_blocks, 1);
    var authorityCertSerialNumber_block  = find_block_at_index(inner_blocks, 2);

    function readNames(buffer,block) {
        // AttributeTypeAndValue ::= SEQUENCE {
        //    type   ATTRIBUTE.&id({SupportedAttributes}),
        //    value  ATTRIBUTE.&Type({SupportedAttributes}{@type}),
        var inner_blocks = readStruct(buffer,block);
        var names = {};
        inner_blocks.forEach(function(sequence_block) {

            assert(sequence_block.tag === 0x30);

            var set_blocks = readStruct(buffer,sequence_block);

            set_blocks.forEach(function(set_block){
                assert(set_block.tag === 0x31);

                var blocks = readStruct(buffer,set_block);
                assert(blocks.length === 1);
                assert(blocks[0].tag === 0x30);

                var _blocks = readStruct(buffer,blocks[0]);
                assert(_blocks.length === 2);

                var type  =  read_ObjectIdentifier(buffer, _blocks[0]);

                var value =  read_Value(buffer, _blocks[1]);
                names[type] = value;

            });
        });
        return names;
    }
    function read_authorithyCertIssuer(block) {
        var inner_blocks = readStruct(buffer,block);

        var directoryName_block = find_block_at_index(inner_blocks, 4);
        if (directoryName_block) {
            return {
                directoryName: readNames(buffer,directoryName_block)
            };
        }
        return read_GeneralNames(buffer,directoryName_block);
    }
    return {
        authorityCertIssuer: authorityCertIssuer_block ? read_authorithyCertIssuer(authorityCertIssuer_block) : null
    };
}
/*
 Extension  ::=  SEQUENCE  {
 extnID      OBJECT IDENTIFIER,
 critical    BOOLEAN DEFAULT FALSE,
 extnValue   OCTET STRING
 -- contains the DER encoding of an ASN.1 value
 -- corresponding to the extension type identified
 -- by extnID
 }
 */
function read_Extension(buffer, block) {


    var inner_blocks = readStruct(buffer, block);

    if (inner_blocks.length === 3) {
        assert(inner_blocks[1].tag === tagTypes.BOOLEAN);
        inner_blocks[1] = inner_blocks[2];
    }

    var identifier = read_ObjectIdentifier(buffer, inner_blocks[0]);
    var buf = get_block(buffer, inner_blocks[1]);

    var value = null;
    switch (identifier) {
        case "subjectKeyIdentifier":
            value = read_OctetString(buffer,inner_blocks[1]);
            break;
        case "subjectAltName":
            value = read_subjectAltNames(buf);
            break;
        case "authorityKeyIdentifier":
            value = read_authorityKeyIdentifier(buf);
            break;
        case "basicConstraints":
            break;
        default:
            value = "Unknown " + hexDump(buf);
    }
    return {
        identifier: identifier,
        value: value
    };
}


// Extensions  ::=  SEQUENCE SIZE (1..MAX) OF Extension
function read_Extensions(buffer, block) {

    assert(block.tag === 0xa3);

    var inner_blocks = readStruct(buffer, block);
    inner_blocks = readStruct(buffer, inner_blocks[0]);

    var exts = inner_blocks.map(function (block) {
        return read_Extension(buffer, block);
    });

    var result = {};
    _.forEach(exts, function (e) {
        result[e.identifier] = e.value;
    });
    return result;
}

function parseOID(buffer, start, end) {
    // ASN.1 JavaScript decoder
    // Copyright (c) 2008-2014 Lapo Luchini <lapo@lapo.it>
    var s = '',
        n = 0,
        bits = 0;
    for (var i = start; i < end; ++i) {

        var v = buffer.readUInt8(i);

        n = n * 128 + (v & 0x7F);
        bits += 7;

        if (!(v & 0x80)) { // finished
            if (s === '') {
                var m = n < 80 ? n < 40 ? 0 : 1 : 2;
                s = m + "." + (n - m * 40);
            } else {
                s += "." + n.toString();
            }
            n = 0;
            bits = 0;
        }
    }
    assert(bits === 0); // if (bits > 0) { s += ".incomplete"; }
    return s;
}


function read_ObjectIdentifier(buffer, block) {
    assert(block.tag === tagTypes.OBJECT_IDENTIFIER);
    var b = buffer.slice(block.position, block.position + block.length);
    var oid = parseOID(b, 0, block.length);
    return oid_map[oid] ? oid_map[oid].d : oid;
}

function read_UniqueIdentifier(buffer, block) {
    // TODO
    return null;
}

function find_block_at_index(blocks, index) {
    var tmp = blocks.filter(function (b) {
        return b.tag === 0xa0 + index;
    });
    if (tmp.length === 0) {
        return null;
    }
    return tmp[0];
}

// function read_GeneralNames
// GeneralNames ::= SEQUENCE SIZE (1..MAX) OF GeneralName
// GeneralName ::= CHOICE {
//        otherName                 [0]  AnotherName,
//        rfc822Name                [1]  IA5String,
//        dNSName                   [2]  IA5String,
//        x400Address               [3]  ORAddress,
//        directoryName             [4]  Name,
//        ediPartyName              [5]  EDIPartyName,
//        uniformResourceIdentifier [6]  IA5String,
//        iPAddress                 [7]  OCTET STRING,
//        registeredID              [8]  OBJECT IDENTIFIER }
function read_GeneralNames(buffer, block) {

    var _data = {
        1: {name: "rfc822Name",    type: "IA5String"},
        2: {name: "dNSName",       type: "IA5String"},
        3: {name: "x400Address",   type: "ORAddress"},
        4: {name: "directoryName", type: "Name"},
        5: {name: "ediPartyName",  type: "EDIPartyName"},
        6: {name: "uniformResourceIdentifier", type: "IA5String"},
        7: {name: "iPAddress",     type: "OCTET_STRING"},
        8: {name: "registeredID",  type: "OBJECT_IDENTIFIER"},
    };
    var blocks = readStruct(buffer, block);

    function read_from_type(buffer, block, type) {
        switch (type) {
            case "IA5String":
                return buffer.slice(block.position, block.position + block.length).toString("ascii");
            default:
                return buffer.slice(block.position, block.position + block.length).toString("hex");
        }
    }

    var n = {};
    for (var i = 0; i < blocks.length; i++) {
        block = blocks[i];
        assert((block.tag & 0x80) === 0x80);
        var t = (block.tag & 0x7F);
        var type = _data[t];

        // istanbul ignore next
        if (!type) {
            console.log(" INVALID TYPE =>",t,"0x"+ t.toString(16));
        }
        n[type.name] = n[type.name] || [];
        n[type.name].push(read_from_type(buffer, block, type.type));
    }
    return n;
}

function read_subjectAltNames(buffer) {
    var block_info = readTag(buffer, 0);
    return read_GeneralNames(buffer, block_info);
}

/*
 SEQUENCE {
 204   13:       SEQUENCE {
 206    9:         OBJECT IDENTIFIER
 :           rsaEncryption (1 2 840 113549 1 1 1)
 217    0:         NULL
 :         }
 219  141:       BIT STRING, encapsulates {
 223  137:         SEQUENCE {
 226  129:           INTEGER
 :             00 C2 D7 97 6D 28 70 AA 5B CF 23 2E 80 70 39 EE
 :             DB 6F D5 2D D5 6A 4F 7A 34 2D F9 22 72 47 70 1D
 :             EF 80 E9 CA 30 8C 00 C4 9A 6E 5B 45 B4 6E A5 E6
 :             6C 94 0D FA 91 E9 40 FC 25 9D C7 B7 68 19 56 8F
 :             11 70 6A D7 F1 C9 11 4F 3A 7E 3F 99 8D 6E 76 A5
 :             74 5F 5E A4 55 53 E5 C7 68 36 53 C7 1D 3B 12 A6
 :             85 FE BD 6E A1 CA DF 35 50 AC 08 D7 B9 B4 7E 5C
 :             FE E2 A3 2C D1 23 84 AA 98 C0 9B 66 18 9A 68 47
 :             E9
 358    3:           INTEGER 65537
 :           }
 :         }
 :       }
 */
function read_IntegerAsByteString(buffer, block) {
    return get_block(buffer, block);
}
function read_ListOfInteger(buffer) {
    var block = readTag(buffer, 0);
    var inner_blocks = readStruct(buffer, block);

    return inner_blocks.map(function (block) {
        return read_IntegerAsByteString(buffer, block);
    });
}
function read_SubjectPublicKeyInfo(buffer, block) {
    var inner_blocks = readStruct(buffer, block);

    // algorithm identifier
    var algorithm = read_AlgorithmIdentifier(buffer, inner_blocks[0]);
    //var parameters         = read_BitString(buffer,inner_blocks[1]);
    var subjectPublicKey = read_BitString(buffer, inner_blocks[1]);

    // read the 2 big integers of the key
    var data = subjectPublicKey.data;
    var values = read_ListOfInteger(data);
    // xx var value = read_ListOfInteger(data);
    return {
        algorithm: algorithm.identifier,
        subjectPublicKey: subjectPublicKey,
        keyLength: values[0].length - 1
        //xx values: values,
        //xx values_length : values.map(function (a){ return a.length; })
    };
}
function read_tbsCertificate(buffer, block) {

    var blocks = readStruct(buffer, block);

    var version, serialNumber, signature, issuer, validity, subject, subjectPublicKeyInfo, extensions;

    if (blocks.length === 6 ) {
        // X509 Version 1:
        version = 1;

        serialNumber  = read_LongIntegerValue(buffer, blocks[0]);
        signature     = read_AlgorithmIdentifier(buffer, blocks[1]);
        issuer        = read_Name(buffer, blocks[2]);
        validity      = read_Validity(buffer, blocks[3]);
        subject       = read_Name(buffer, blocks[4]);
        subjectPublicKeyInfo = read_SubjectPublicKeyInfo(buffer, blocks[5]);

        extensions    = null;
    } else {
        // X509 Version 3:

        var version_block = find_block_at_index(blocks, 0);

        version       = read_VersionValue(buffer,version_block)  + 1 ;
        serialNumber  = read_LongIntegerValue(buffer, blocks[1]);
        signature     = read_AlgorithmIdentifier(buffer, blocks[2]);
        issuer        = read_Name(buffer, blocks[3]);
        validity      = read_Validity(buffer, blocks[4]);
        subject       = read_Name(buffer, blocks[5]);
        subjectPublicKeyInfo = read_SubjectPublicKeyInfo(buffer, blocks[6]);

        var extensionBlock  = find_block_at_index(blocks, 3);
        extensions    = read_Extensions(buffer,extensionBlock);

    }

    return {
        version:      version,

        serialNumber: serialNumber,
        signature:    signature,
        issuer:       issuer,
        validity:     validity,
        subject:      subject,
        subjectPublicKeyInfo:  subjectPublicKeyInfo,

        extensions:      extensions
    };

}
function read_AlgorithmIdentifier(buffer, block) {

    var inner_blocks = readStruct(buffer, block);
    return {
        identifier: read_ObjectIdentifier(buffer, inner_blocks[0])
    };
}
function exploreCertificate(buffer) {

    assert(buffer instanceof Buffer);
    if (!buffer._exploreCertificate_cache) {
        var block_info = readTag(buffer, 0);
        var blocks = readStruct(buffer, block_info);
        buffer._exploreCertificate_cache = {
            tbsCertificate: read_tbsCertificate(buffer, blocks[0]),
            signatureAlgorithm: read_AlgorithmIdentifier(buffer, blocks[1]),
            signatureValue: read_SignatureValue(buffer, blocks[2])
        };
    }
    return buffer._exploreCertificate_cache;

}

exports.exploreCertificate = exploreCertificate;


/**
 * @method combine_der
 * combine an array of certificates into a single blob
 * @param certificates {Buffer[]}
 * @return {Buffer}
  */
exports.combine_der = function (certificates) {

    assert(_.isArray(certificates));

    // perform some sanity check
    certificates.forEach(function(cert) {
        var block_info = readTag(cert, 0);
        //xx console.log("xxxx" ,cert.length,block_info);
        //xx console.log(cert.toString("base64"));
        assert(block_info.position + block_info.length == cert.length);

    });
    return Buffer.concat(certificates);
};

/**
 * @method split_der
 * split a multi chain certificates
 * @param buffer {Buffer}
 * @return {Buffer[]}
 */
exports.split_der = function (buffer) {

    var certificate_chain = [];

    do {
        var block_info = readTag(buffer, 0);

        var length = block_info.position + block_info.length;

        var der_certificate = buffer.slice(0,length);

        certificate_chain.push(der_certificate);

        buffer = buffer.slice(length);

    } while (buffer.length>0);

    return certificate_chain;
};
