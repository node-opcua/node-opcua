import "should";
import { convertPEMtoDER, exploreCertificate } from "node-opcua-crypto";
import {
    canonicalizeX509Subject,
    certificateSubjectPairs,
    matchX509Subject,
    parseX509SubjectCriteria,
    type X509SubjectName
} from "../source/x509_subject.js";

describe("x509_subject — OPC 10000-18 §4.4.3 subject criteria (Table 10)", () => {
    describe("parseX509SubjectCriteria", () => {
        it("should parse a single CN pair", () => {
            parseX509SubjectCriteria('CN="Jane Doe"').should.eql([["CN", "Jane Doe"]]);
        });

        it("should parse multiple pairs and preserve order", () => {
            parseX509SubjectCriteria('CN="Jane Doe"/O="ACME"/C="FR"').should.eql([
                ["CN", "Jane Doe"],
                ["O", "ACME"],
                ["C", "FR"]
            ]);
        });

        it("should tolerate whitespace around '='", () => {
            parseX509SubjectCriteria('CN = "Jane"').should.eql([["CN", "Jane"]]);
        });

        it("should return empty for a plain (non-DN) string", () => {
            parseX509SubjectCriteria("Jane Doe").should.have.length(0);
        });
    });

    describe("canonicalizeX509Subject", () => {
        it("should reorder pairs into Table 10 order", () => {
            canonicalizeX509Subject([
                ["C", "FR"],
                ["O", "ACME"],
                ["CN", "Jane"]
            ]).should.equal('CN="Jane"/O="ACME"/C="FR"');
        });

        it("should drop attributes not listed in Table 10", () => {
            canonicalizeX509Subject([
                ["CN", "Jane"],
                ["E", "jane@acme.test"]
            ]).should.equal('CN="Jane"');
        });
    });

    describe("certificateSubjectPairs", () => {
        it("should map crypto subject fields to Table 10 names in order", () => {
            const subject: X509SubjectName = {
                commonName: "Jane Doe",
                organizationName: "ACME",
                organizationUnitName: "R&D",
                localityName: "Paris",
                stateOrProvinceName: "IDF",
                countryName: "FR"
            };
            certificateSubjectPairs(subject).should.eql([
                ["CN", "Jane Doe"],
                ["O", "ACME"],
                ["OU", "R&D"],
                ["L", "Paris"],
                ["S", "IDF"],
                ["C", "FR"]
            ]);
        });

        it("should omit absent fields", () => {
            certificateSubjectPairs({ commonName: "Jane" }).should.eql([["CN", "Jane"]]);
        });
    });

    describe("matchX509Subject — full DN format", () => {
        const subject: X509SubjectName = { commonName: "Jane Doe", organizationName: "ACME" };

        it("should match when all present attributes match (any order)", () => {
            matchX509Subject('O="ACME"/CN="Jane Doe"', subject).should.be.true();
        });

        it("should NOT match when an attribute value differs", () => {
            matchX509Subject('CN="Jane Doe"/O="Other"', subject).should.be.false();
        });

        it("should NOT match when criteria omits an attribute present in the cert", () => {
            // cert has O=ACME, criteria only specifies CN → mismatch
            matchX509Subject('CN="Jane Doe"', subject).should.be.false();
        });

        it("should NOT match when criteria adds an attribute absent from the cert", () => {
            matchX509Subject('CN="Jane Doe"/O="ACME"/C="FR"', subject).should.be.false();
        });
    });

    describe("matchX509Subject — legacy CN-only format", () => {
        it("should match a plain Common Name", () => {
            matchX509Subject("Jane Doe", { commonName: "Jane Doe" }).should.be.true();
        });

        it("should NOT match a different Common Name", () => {
            matchX509Subject("Someone Else", { commonName: "Jane Doe" }).should.be.false();
        });
    });
    describe("certificateSubjectPairs — driven by a REAL certificate", () => {
        /**
         * The suite above builds X509SubjectName objects by hand, which is why a
         * long-standing bug survived it: a parsed certificate reports its OU as
         * `organizationalUnitName`, while this module read `organizationUnitName`
         * (no "al"). That property is never present on a parsed certificate, so
         * the OU was silently dropped from the pairs.
         *
         * The consequence was not looser matching — Part 18 has no wildcards, so
         * a correctly written criteria containing OU could never match, and the
         * rule authorised nobody.
         *
         * These cases therefore go through `exploreCertificate` rather than an
         * object literal, so the shape under test is the one production sees.
         */
        // A fixed self-signed certificate whose subject is
        // /CN=operator-1/O=Sterfive/OU=Plant/C=FR. Inlined rather than generated
        // so the test is deterministic and needs no key generation.
        const PEM = [
            "-----BEGIN CERTIFICATE-----",
            "MIIDRDCCAiygAwIBAgIUF9AndaE4GKwYRokHZ7MhwzfCNAUwDQYJKoZIhvcNAQEL",
            "BQAwRTETMBEGA1UEAwwKb3BlcmF0b3ItMTERMA8GA1UECgwIU3RlcmZpdmUxDjAM",
            "BgNVBAsMBVBsYW50MQswCQYDVQQGEwJGUjAeFw0yNjA4MTUyMDAxMDhaFw0yNjA4",
            "MTYyMDAxMDhaMEUxEzARBgNVBAMMCm9wZXJhdG9yLTExETAPBgNVBAoMCFN0ZXJm",
            "aXZlMQ4wDAYDVQQLDAVQbGFudDELMAkGA1UEBhMCRlIwggEiMA0GCSqGSIb3DQEB",
            "AQUAA4IBDwAwggEKAoIBAQCQy5eybpCDHdKryiQdHaWp9M6BgzTMcvfX1HY8eX44",
            "l520fcp8OXAAQu55bmefVHWyW3TW89bl14VCK1AJ/Gt1joqMXNi9C13y9pMM7GXt",
            "4KjZSymq+eC/yPQrvf82Ll8kJIrf5+pXDlZcf2MucusteezeqQ9L9Di3vDMTfjs5",
            "xDaBFzblr07nD7+XPgrVqEZHBFts7kkILbeUutEc8G02Ir/5s18PAOsl71Makj57",
            "JlC+QL5csRiG9ye9wuXPP61OxaDL9/wo8fA5GZ4/VV6t3ADr2gppOjzTikN1KUfe",
            "y3oOQhAUbv1dQL9/Q01qvVD6oMkmYSNSbcLIl4dikvuZAgMBAAGjLDAqMAkGA1Ud",
            "EwQCMAAwHQYDVR0OBBYEFByiReafT/c7uavYII2AQ69Z3PzzMA0GCSqGSIb3DQEB",
            "CwUAA4IBAQAf5Geh8mOX1oJzgfb7D9w0nx3g77z7HS5zGJTwKZDNhT8tABDslGr5",
            "wrQTWq2FvNvpDOhqqY9a3QrF4QMVZuAy5HCjCRLAi9pX1FAD7nnwhhrTM22lcYQK",
            "W+KV+3z45CiUVI9VXsUvDP6E1ESNf1ys1DXr+lFUdoZ07jtyjzeF9vS4iQwbWSQ8",
            "QNzIrwS5tLsbvUrlSSw+upuDcXf97aXhQwL8u1Ocqf0l4Ht0z9cwz9cCal73UPNq",
            "PSGB3y/HAzjBOmNY2yIp5uB7OXkFfqUdzJpvH8ADqXkw0odeRMaLGq8qiACyzyGq",
            "TrDJWM0YHECjk8OhC3UVUZBxq8TslTFy",
            "-----END CERTIFICATE-----"
        ].join(String.fromCharCode(10));

        const subject = exploreCertificate(convertPEMtoDER(PEM)).tbsCertificate.subject as X509SubjectName;

        it("should include the OU of a real certificate", () => {
            certificateSubjectPairs(subject).should.eql([
                ["CN", "operator-1"],
                ["O", "Sterfive"],
                ["OU", "Plant"],
                ["C", "FR"]
            ]);
        });

        it("should match a criteria that names the OU", () => {
            matchX509Subject('CN="operator-1"/O="Sterfive"/OU="Plant"/C="FR"', subject).should.be.true();
        });

        it("should NOT match a criteria that omits the OU", () => {
            // Before the fix this passed for the wrong reason: neither side had OU.
            matchX509Subject('CN="operator-1"/O="Sterfive"/C="FR"', subject).should.be.false();
        });
    });

    describe("certificateSubjectPairs — attributes Table 10 lists", () => {
        it("should place DC, dnQualifier and serialNumber in Table 10 order", () => {
            certificateSubjectPairs({
                commonName: "a",
                domainComponent: "example",
                countryName: "FR",
                dnQualifier: "q",
                serialNumber: "7"
            }).should.eql([
                ["CN", "a"],
                ["DC", "example"],
                ["C", "FR"],
                ["dnQualifier", "q"],
                ["serialNumber", "7"]
            ]);
        });

        it("should still accept the deprecated organizationUnitName spelling", () => {
            certificateSubjectPairs({ organizationUnitName: "R&D" }).should.eql([["OU", "R&D"]]);
        });

        it("should prefer the spelling a parsed certificate uses", () => {
            certificateSubjectPairs({
                organizationalUnitName: "FromCertificate",
                organizationUnitName: "HandWritten"
            }).should.eql([["OU", "FromCertificate"]]);
        });
    });
});
