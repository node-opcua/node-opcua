import { SessionContext } from "node-opcua-address-space";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import "should";
import { ServerEngine } from "../source/index.js";

const mini_nodeset_filename = get_mini_nodeset_filename();

// OPC 10000-4 v1.05.07 §5.7.3 ActivateSession, localeIds: "This parameter only needs to be
// specified during the first call to ActivateSession during a single application Session. If
// it is null or empty the Server shall keep using the current localeIds for the Session."
describe("ServerSession - localeIds (OPC 10000-4 v1.05.07 §5.7.3)", () => {
    let engine: ServerEngine;

    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => {
            if (!engine.addressSpace) {
                throw new Error("addressSpace is null");
            }
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    it("has no locales before ActivateSession", () => {
        const session = engine.createSession({});
        should(session.localeIds).eql([]);
        should(session.sessionContext.getPreferredLocales()).eql([]);
        session.close(true, "CloseSession");
    });

    it("records the localeIds of a successful ActivateSession, most preferred first", () => {
        const session = engine.createSession({});
        session.setLocaleIds(["fr-FR", "en"]);
        should(session.localeIds).eql(["fr-FR", "en"]);
        should(session.sessionContext.getPreferredLocales()).eql(["fr-FR", "en"]);
        session.close(true, "CloseSession");
    });

    it("keeps the current locales when a later ActivateSession sends null or empty", () => {
        const session = engine.createSession({});
        session.setLocaleIds(["de"]);
        session.setLocaleIds([]);
        should(session.localeIds).eql(["de"], "empty list must not overwrite the current localeIds");
        session.setLocaleIds(null);
        should(session.localeIds).eql(["de"], "null must not overwrite the current localeIds either");
        should(session.sessionContext.getPreferredLocales()).eql(["de"]);
        session.close(true, "CloseSession");
    });

    it("ignores blank/null entries mixed into a non-empty localeIds", () => {
        const session = engine.createSession({});
        session.setLocaleIds(["en", "", null, "fr-FR"]);
        should(session.localeIds).eql(["en", "fr-FR"]);
        session.close(true, "CloseSession");
    });

    it("getPreferredLocales() returns a copy, not a live reference to the session's array", () => {
        const session = engine.createSession({});
        session.setLocaleIds(["en"]);
        const locales = session.sessionContext.getPreferredLocales();
        locales.push("fr-FR");
        should(session.localeIds).eql(["en"], "mutating the returned array must not affect the session");
        session.close(true, "CloseSession");
    });

    it("a SessionContext with no Session at all has no preferred locales", () => {
        should(new SessionContext({}).getPreferredLocales()).eql([]);
        should(SessionContext.defaultContext.getPreferredLocales()).eql([]);
    });
});
