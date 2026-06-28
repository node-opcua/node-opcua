import "should";
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
});
