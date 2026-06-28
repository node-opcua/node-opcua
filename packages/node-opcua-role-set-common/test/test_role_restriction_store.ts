import "should";
import { makeNodeId } from "node-opcua-nodeid";
import { MessageSecurityMode } from "node-opcua-types";
import {
    applicationComplies,
    endpointComplies,
    InMemoryRoleRestrictionStore,
    type ResolutionContext
} from "../source/role_restriction_store.js";

const Operator = makeNodeId(15680);

const signed = (applicationUri?: string): ResolutionContext => ({
    applicationUri,
    securityMode: MessageSecurityMode.SignAndEncrypt
});

describe("applicationComplies (OPC 10000-18 §4.4.1)", () => {
    it("grants when the Applications list is empty (no restriction)", () => {
        applicationComplies([], true, { securityMode: MessageSecurityMode.None }).should.be.true();
    });

    it("include list: grants only listed applications, over a signed channel", () => {
        const apps = ["urn:acme:hmi"];
        applicationComplies(apps, false, signed("urn:acme:hmi")).should.be.true();
        applicationComplies(apps, false, signed("urn:other:app")).should.be.false();
    });

    it("exclude list: blocks listed applications, grants others", () => {
        const apps = ["urn:evil:app"];
        applicationComplies(apps, true, signed("urn:evil:app")).should.be.false();
        applicationComplies(apps, true, signed("urn:good:app")).should.be.true();
    });

    it("denies when Applications is non-empty but the channel is not signed", () => {
        applicationComplies(["urn:acme:hmi"], false, {
            applicationUri: "urn:acme:hmi",
            securityMode: MessageSecurityMode.None
        }).should.be.false();
    });
});

describe("endpointComplies (OPC 10000-18 §4.4.1 / §4.4.2)", () => {
    const ctx: ResolutionContext = {
        endpointUrl: "opc.tcp://host:4840",
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicyUri: "policy-A"
    };

    it("grants when the Endpoints list is empty", () => {
        endpointComplies([], true, ctx).should.be.true();
    });

    it("include list: matches by endpointUrl", () => {
        endpointComplies([{ endpointUrl: "opc.tcp://host:4840" }], false, ctx).should.be.true();
        endpointComplies([{ endpointUrl: "opc.tcp://other:4840" }], false, ctx).should.be.false();
    });

    it("ignores default-valued fields during comparison (securityMode=Invalid)", () => {
        // only endpointUrl set → securityMode/policy ignored
        endpointComplies(
            [{ endpointUrl: "opc.tcp://host:4840", securityMode: MessageSecurityMode.Invalid }],
            false,
            ctx
        ).should.be.true();
    });

    it("matches on multiple fields when set", () => {
        endpointComplies(
            [{ endpointUrl: "opc.tcp://host:4840", securityMode: MessageSecurityMode.SignAndEncrypt }],
            false,
            ctx
        ).should.be.true();
        endpointComplies(
            [{ endpointUrl: "opc.tcp://host:4840", securityMode: MessageSecurityMode.Sign }],
            false,
            ctx
        ).should.be.false();
    });

    it("exclude list: blocks matching endpoints", () => {
        endpointComplies([{ endpointUrl: "opc.tcp://host:4840" }], true, ctx).should.be.false();
        endpointComplies([{ endpointUrl: "opc.tcp://other:4840" }], true, ctx).should.be.true();
    });
});

describe("InMemoryRoleRestrictionStore", () => {
    it("add/remove application is idempotent and reports duplicates", () => {
        const store = new InMemoryRoleRestrictionStore();
        store.addApplication(Operator, "urn:a").should.be.true();
        store.addApplication(Operator, "urn:a").should.be.false();
        store.getApplications(Operator).should.eql(["urn:a"]);
        store.removeApplication(Operator, "urn:a").should.be.true();
        store.removeApplication(Operator, "urn:a").should.be.false();
    });

    it("ApplicationsExclude defaults to TRUE when empty, FALSE once entries exist", () => {
        const store = new InMemoryRoleRestrictionStore();
        store.getApplicationsExclude(Operator).should.be.true(); // empty
        store.addApplication(Operator, "urn:a");
        store.getApplicationsExclude(Operator).should.be.false(); // include list
        store.setApplicationsExclude(Operator, true);
        store.getApplicationsExclude(Operator).should.be.true(); // explicit
    });

    it("complies() combines application and endpoint restrictions", () => {
        const store = new InMemoryRoleRestrictionStore();
        // no restrictions → complies
        store.complies(Operator, signed("urn:acme")).should.be.true();

        // restrict to urn:acme + endpoint A
        store.addApplication(Operator, "urn:acme");
        store.addEndpoint(Operator, { endpointUrl: "opc.tcp://A" });

        store
            .complies(Operator, { applicationUri: "urn:acme", securityMode: MessageSecurityMode.Sign, endpointUrl: "opc.tcp://A" })
            .should.be.true();
        // wrong application
        store
            .complies(Operator, { applicationUri: "urn:evil", securityMode: MessageSecurityMode.Sign, endpointUrl: "opc.tcp://A" })
            .should.be.false();
        // wrong endpoint
        store
            .complies(Operator, { applicationUri: "urn:acme", securityMode: MessageSecurityMode.Sign, endpointUrl: "opc.tcp://B" })
            .should.be.false();
    });

    it("add/remove endpoint reports duplicates and ignores field order", () => {
        const store = new InMemoryRoleRestrictionStore();
        store.addEndpoint(Operator, { endpointUrl: "opc.tcp://A", securityMode: MessageSecurityMode.Sign }).should.be.true();
        store.addEndpoint(Operator, { securityMode: MessageSecurityMode.Sign, endpointUrl: "opc.tcp://A" }).should.be.false();
        store.getEndpoints(Operator).should.have.length(1);
        store.removeEndpoint(Operator, { endpointUrl: "opc.tcp://A", securityMode: MessageSecurityMode.Sign }).should.be.true();
        store.getEndpoints(Operator).should.have.length(0);
    });
});
