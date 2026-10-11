import path from "node:path";
import {
    CertificatePurpose,
    convertPEMtoDER,
    createSelfSignedCertificate,
    exploreCertificate,
    generateKeyPair,
    makeSHA1Thumbprint,
    readCertificate
} from "node-opcua-crypto";
import { makeNodeId, sameNodeId } from "node-opcua-nodeid";
import { samplesCertificateFolder } from "node-opcua-test-helpers";
import {
    AnonymousIdentityToken,
    IdentityCriteriaType,
    IdentityMappingRuleType,
    MessageSecurityMode,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-types";
import should from "should";
import { InMemoryIdentityMappingStore } from "../source/in_memory_store.js";
import { WellKnownRoleIds } from "../source/well_known_role_ids.js";
import { canonicalizeX509Subject, certificateSubjectPairs, type X509SubjectName } from "../source/x509_subject.js";

describe("InMemoryIdentityMappingStore", () => {
    let store: InMemoryIdentityMappingStore;

    beforeEach(() => {
        store = new InMemoryIdentityMappingStore();
    });

    describe("empty store", () => {
        it("should return empty array from resolveRoles", () => {
            const token = new AnonymousIdentityToken();
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });

        it("should return empty array from getIdentitiesForRole", () => {
            const rules = store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin);
            rules.should.have.length(0);
        });

        it("should return empty array from getRoleIds", () => {
            store.getRoleIds().should.have.length(0);
        });
    });

    describe("Anonymous criteria", () => {
        beforeEach(() => {
            store.addIdentity(
                WellKnownRoleIds.Observer,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );
        });

        it("should resolve Anonymous token to Observer", () => {
            const token = new AnonymousIdentityToken();
            const roles = store.resolveRoles(token);
            roles.should.have.length(1);
            sameNodeId(roles[0], WellKnownRoleIds.Observer).should.be.true();
        });

        it("should NOT resolve UserName token to Observer via Anonymous rule", () => {
            const token = new UserNameIdentityToken({ userName: "admin" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });
    });

    describe("AuthenticatedUser criteria", () => {
        beforeEach(() => {
            store.addIdentity(
                WellKnownRoleIds.AuthenticatedUser,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.AuthenticatedUser,
                    criteria: "*"
                })
            );
        });

        it("should resolve UserName token to AuthenticatedUser", () => {
            const token = new UserNameIdentityToken({ userName: "admin" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(1);
            sameNodeId(roles[0], WellKnownRoleIds.AuthenticatedUser).should.be.true();
        });

        it("should NOT resolve Anonymous token to AuthenticatedUser", () => {
            const token = new AnonymousIdentityToken();
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });
    });

    describe("UserName criteria", () => {
        beforeEach(() => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );
        });

        it("should resolve matching username to SecurityAdmin", () => {
            const token = new UserNameIdentityToken({ userName: "admin" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(1);
            sameNodeId(roles[0], WellKnownRoleIds.SecurityAdmin).should.be.true();
        });

        it("should NOT resolve non-matching username", () => {
            const token = new UserNameIdentityToken({ userName: "user1" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });

        it("should NOT resolve Anonymous token via UserName rule", () => {
            const token = new AnonymousIdentityToken();
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });
    });

    describe("Thumbprint criteria", () => {
        let certBuffer: Buffer;
        let thumbprintHex: string;

        before(async () => {
            // Use a real test certificate from the monorepo
            const certPath = path.join(samplesCertificateFolder, "client_cert_2048.pem");
            try {
                certBuffer = await readCertificate(certPath);
                thumbprintHex = makeSHA1Thumbprint(certBuffer).toString("hex").toUpperCase();
            } catch {
                // If test cert not found, use a synthetic one
                // We'll skip tests that need a real cert
                certBuffer = Buffer.alloc(0);
                thumbprintHex = "";
            }
        });

        it("should resolve matching thumbprint", function () {
            if (!certBuffer.length) {
                this.skip();
            }
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Thumbprint,
                    criteria: thumbprintHex
                })
            );
            const token = new X509IdentityToken({ certificateData: certBuffer });
            const roles = store.resolveRoles(token);
            roles.should.have.length(1);
            sameNodeId(roles[0], WellKnownRoleIds.SecurityAdmin).should.be.true();
        });

        it("should handle case-insensitive thumbprint with colons", function () {
            if (!certBuffer.length) {
                this.skip();
            }
            // Add with lowercase and colons
            const formatted = thumbprintHex.toLowerCase().match(/.{2}/g)?.join(":");
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Thumbprint,
                    criteria: formatted
                })
            );
            const token = new X509IdentityToken({ certificateData: certBuffer });
            const roles = store.resolveRoles(token);
            roles.should.have.length(1);
        });

        it("should NOT resolve non-matching thumbprint", function () {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Thumbprint,
                    criteria: "0000000000000000000000000000000000000000"
                })
            );
            if (!certBuffer.length) {
                this.skip();
            }
            const token = new X509IdentityToken({ certificateData: certBuffer });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });

        it("should NOT resolve thumbprint for non-X509 token", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Thumbprint,
                    criteria: "ABCD"
                })
            );
            const token = new UserNameIdentityToken({ userName: "admin" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });

        it("should NOT resolve thumbprint for X509 with null certData", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Thumbprint,
                    criteria: "ABCD"
                })
            );
            const token = new X509IdentityToken({ certificateData: undefined });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });
    });

    describe("X509Subject criteria", () => {
        let certBuffer: Buffer;
        let subjectDN: string;

        before(async () => {
            const certPath = path.join(samplesCertificateFolder, "client_cert_2048.pem");
            try {
                certBuffer = await readCertificate(certPath);
                const info = exploreCertificate(certBuffer);
                subjectDN = canonicalizeX509Subject(
                    certificateSubjectPairs(info.tbsCertificate.subject as unknown as X509SubjectName)
                );
            } catch {
                certBuffer = Buffer.alloc(0);
                subjectDN = "";
            }
        });

        it("should resolve matching X509Subject", function () {
            if (!certBuffer.length || !subjectDN) {
                this.skip();
            }
            store.addIdentity(
                WellKnownRoleIds.ConfigureAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.X509Subject,
                    criteria: subjectDN
                })
            );
            const token = new X509IdentityToken({ certificateData: certBuffer });
            const roles = store.resolveRoles(token);
            roles.should.have.length(1);
            sameNodeId(roles[0], WellKnownRoleIds.ConfigureAdmin).should.be.true();
        });

        it("should NOT resolve non-matching X509Subject", function () {
            if (!certBuffer.length) {
                this.skip();
            }
            store.addIdentity(
                WellKnownRoleIds.ConfigureAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.X509Subject,
                    criteria: "CN=Nonexistent"
                })
            );
            const token = new X509IdentityToken({ certificateData: certBuffer });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });

        it("should NOT resolve a CN-only X509Subject rule unless the store opts in", async () => {
            // Its own certificate, not the sample one: this case must always run.
            const { privateKey } = await generateKeyPair(2048);
            const { cert } = await createSelfSignedCertificate({
                privateKey,
                subject: "CN=Jane Doe/O=Elsewhere",
                purpose: CertificatePurpose.ForUserAuthentication,
                validity: 30
            });
            const token = new X509IdentityToken({ certificateData: convertPEMtoDER(cert) });
            const rule = new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.X509Subject, criteria: "Jane Doe" });

            store.addIdentity(WellKnownRoleIds.ConfigureAdmin, rule);
            should(store.resolveRoles(token)).have.length(0);

            const lenient = new InMemoryIdentityMappingStore({ acceptCommonNameOnlyX509Subject: true });
            lenient.addIdentity(WellKnownRoleIds.ConfigureAdmin, rule);
            should(lenient.resolveRoles(token)).have.length(1);

            // The full DN, as §4.4.3 writes it, matches with the default store.
            const strict = new InMemoryIdentityMappingStore();
            strict.addIdentity(
                WellKnownRoleIds.ConfigureAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.X509Subject,
                    criteria: 'CN="Jane Doe"/O="Elsewhere"'
                })
            );
            should(strict.resolveRoles(token)).have.length(1);
        });

        it("should NOT resolve X509Subject for non-X509 token", () => {
            store.addIdentity(
                WellKnownRoleIds.ConfigureAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.X509Subject,
                    criteria: "CN=Test"
                })
            );
            const token = new AnonymousIdentityToken();
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });
    });

    describe("addIdentity / removeIdentity", () => {
        it("should be idempotent on duplicate add", () => {
            const rule = new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            });
            store.addIdentity(WellKnownRoleIds.SecurityAdmin, rule);
            store.addIdentity(WellKnownRoleIds.SecurityAdmin, rule);

            store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin).should.have.length(1);
        });

        it("should remove existing identity and return true", () => {
            const rule = new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            });
            store.addIdentity(WellKnownRoleIds.SecurityAdmin, rule);
            store.removeIdentity(WellKnownRoleIds.SecurityAdmin, rule).should.be.true();
            store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin).should.have.length(0);
        });

        it("should return false when removing non-existent identity", () => {
            const rule = new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            });
            store.removeIdentity(WellKnownRoleIds.SecurityAdmin, rule).should.be.false();
        });

        it("should return false when removing from unknown roleId", () => {
            const rule = new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            });
            store.removeIdentity(makeNodeId(99999), rule).should.be.false();
        });
    });

    describe("multiple roles", () => {
        it("should match same token against multiple roles", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );
            store.addIdentity(
                WellKnownRoleIds.ConfigureAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );

            const token = new UserNameIdentityToken({ userName: "admin" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(2);
        });

        it("should return getRoleIds correctly", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );
            store.addIdentity(
                WellKnownRoleIds.Observer,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );

            store.getRoleIds().should.have.length(2);
        });
    });

    describe("unknown criteria type", () => {
        it("should not match for unknown criteria type", () => {
            // Use a criteria type that isn't handled (e.g., Role=3)
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Role,
                    criteria: "SomeRole"
                })
            );
            const token = new UserNameIdentityToken({ userName: "admin" });
            const roles = store.resolveRoles(token);
            roles.should.have.length(0);
        });
    });

    describe("getIdentitiesForRole returns copies", () => {
        it("should return a copy, not internal array", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );
            const rules1 = store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin);
            const rules2 = store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin);
            rules1.should.not.equal(rules2); // different array instances
            rules1.should.have.length(1);
        });
    });
    describe("Application and TrustedApplication criteria (OPC 10000-18 §4.4.3)", () => {
        const APP = "urn:example:console";
        const anonymous = new AnonymousIdentityToken();
        const signed = { applicationUri: APP, securityMode: MessageSecurityMode.SignAndEncrypt };

        it("Application grants the Session whose client certificate carries the ApplicationUri, on a signed channel", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: APP })
            );
            should(store.resolveRoles(anonymous, signed).map((r) => r.toString())).eql([WellKnownRoleIds.SecurityAdmin.toString()]);
            should(store.resolveRoles(anonymous, { ...signed, securityMode: MessageSecurityMode.Sign })).have.length(1);
        });

        it("Application does NOT grant another ApplicationUri, an unsigned channel, or a call without context", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: APP })
            );
            should(store.resolveRoles(anonymous, { ...signed, applicationUri: "urn:example:other" })).have.length(0);
            should(store.resolveRoles(anonymous, { ...signed, securityMode: MessageSecurityMode.None })).have.length(0);
            should(store.resolveRoles(anonymous, { securityMode: MessageSecurityMode.SignAndEncrypt })).have.length(0);
            should(store.resolveRoles(anonymous)).have.length(0);
        });

        it("Application with an empty criteria matches nothing", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: "" })
            );
            should(store.resolveRoles(anonymous, { ...signed, applicationUri: "" })).have.length(0);
        });

        it("neither criteria matches a client certificate admitted only by a relaxation (NoConfiguration)", () => {
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: APP })
            );
            store.addIdentity(
                WellKnownRoleIds.Operator,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.TrustedApplication, criteria: "" })
            );
            should(store.resolveRoles(anonymous, { ...signed, clientCertificateTrustRelaxed: true })).have.length(0);
            should(store.resolveRoles(anonymous, { ...signed, clientCertificateTrustRelaxed: false })).have.length(2);
        });

        it("a TrustedApplication rule on SecurityAdmin or ConfigureAdmin never matches, however it got into the store", () => {
            for (const role of [WellKnownRoleIds.SecurityAdmin, WellKnownRoleIds.ConfigureAdmin]) {
                store.addIdentity(
                    role,
                    new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.TrustedApplication, criteria: "" })
                );
            }
            should(store.resolveRoles(anonymous, signed)).have.length(0);
        });

        it("TrustedApplication grants any client with a certificate on a signed channel, and nothing else", () => {
            store.addIdentity(
                WellKnownRoleIds.Operator,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.TrustedApplication, criteria: "" })
            );
            should(store.resolveRoles(anonymous, signed)).have.length(1);
            should(store.resolveRoles(anonymous, { ...signed, applicationUri: "urn:example:other" })).have.length(1);
            should(store.resolveRoles(anonymous, { ...signed, securityMode: MessageSecurityMode.None })).have.length(0);
            should(store.resolveRoles(anonymous, { securityMode: MessageSecurityMode.SignAndEncrypt })).have.length(0);
            should(store.resolveRoles(anonymous)).have.length(0);
        });
    });
});
