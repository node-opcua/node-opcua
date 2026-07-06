import { MessageSecurityMode } from "node-opcua-secure-channel";
import { AnonymousIdentityToken, IssuedIdentityToken, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";
import should from "should";

import type { ServerSession } from "../source/server_session";
import {
    getTransferSessionIdentity,
    type ITransferSessionIdentity,
    sessionsCompatibleForTransfer
} from "../source/sessions_compatible_for_transfer";

// The destination argument is read for its user identity token, its clientDescription.applicationUri
// and its channel.securityMode, so a minimal stand-in providing those is enough.
function fakeSession(userIdentityToken?: any, applicationUri?: string, securityMode?: MessageSecurityMode): ServerSession {
    return {
        userIdentityToken,
        clientDescription: applicationUri !== undefined ? { applicationUri } : undefined,
        channel: securityMode !== undefined ? { securityMode } : undefined
    } as unknown as ServerSession;
}
// build a source identity snapshot the same way the server does (via getTransferSessionIdentity)
function identity(userIdentityToken?: any, applicationUri?: string, securityMode?: MessageSecurityMode): ITransferSessionIdentity {
    return getTransferSessionIdentity(fakeSession(userIdentityToken, applicationUri, securityMode));
}

// OPC UA Part 4 §5.14.7: a Subscription may only be transferred to a Session that operates on
// behalf of the same user as the Session that owns the Subscription.
describe("sessionsCompatibleForTransfer (OPC UA Part 4 §5.14.7)", () => {
    it("SCT-01 - refuses the transfer when the owning identity is unknown (fail closed)", () => {
        should(sessionsCompatibleForTransfer(undefined, fakeSession(new UserNameIdentityToken({ userName: "user1" })))).eql(
            false
        );
        should(sessionsCompatibleForTransfer(undefined, fakeSession(undefined))).eql(false);
    });

    it("SCT-02 - allows the transfer when neither session carries a user identity token", () => {
        should(sessionsCompatibleForTransfer(identity(undefined), fakeSession(undefined))).eql(true);
    });

    it("SCT-05 - allows username -> same username", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new UserNameIdentityToken({ userName: "user1" })),
                fakeSession(new UserNameIdentityToken({ userName: "user1" }))
            )
        ).eql(true);
    });

    it("SCT-06 - refuses username -> different username", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new UserNameIdentityToken({ userName: "user1" })),
                fakeSession(new UserNameIdentityToken({ userName: "user2" }))
            )
        ).eql(false);
    });

    it("SCT-07 - refuses username -> anonymous", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new UserNameIdentityToken({ userName: "user1" })),
                fakeSession(new AnonymousIdentityToken({}))
            )
        ).eql(false);
    });

    it("SCT-08 - allows x509 -> same certificate", () => {
        const certificateData = Buffer.from("aabbcc", "hex");
        should(
            sessionsCompatibleForTransfer(
                identity(new X509IdentityToken({ certificateData })),
                fakeSession(new X509IdentityToken({ certificateData: Buffer.from("aabbcc", "hex") }))
            )
        ).eql(true);
    });

    it("SCT-09 - refuses x509 -> different certificate", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new X509IdentityToken({ certificateData: Buffer.from("aabbcc", "hex") })),
                fakeSession(new X509IdentityToken({ certificateData: Buffer.from("ddeeff", "hex") }))
            )
        ).eql(false);
    });

    it("SCT-10 - refuses x509 -> username", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new X509IdentityToken({ certificateData: Buffer.from("aabbcc", "hex") })),
                fakeSession(new UserNameIdentityToken({ userName: "user1" }))
            )
        ).eql(false);
    });

    it("SCT-11 - getTransferSessionIdentity captures the session user identity token", () => {
        const userIdentityToken = new UserNameIdentityToken({ userName: "user1", password: Buffer.from("s3cret") });
        const snapshot = getTransferSessionIdentity(fakeSession(userIdentityToken));
        // the snapshot must keep the identity key but NOT the raw token / password
        snapshot.kind.should.eql("username");
        snapshot.userName!.should.eql("user1");
        should(JSON.stringify(snapshot)).not.match(/s3cret/, "snapshot must not retain the password");

        // the snapshot must remain valid for a transfer decision even after the session is gone
        should(sessionsCompatibleForTransfer(snapshot, fakeSession(new UserNameIdentityToken({ userName: "user1" })))).eql(
            true
        );
        should(sessionsCompatibleForTransfer(snapshot, fakeSession(new UserNameIdentityToken({ userName: "user2" })))).eql(
            false
        );
    });

    // ---- anonymous user rule (§5.14.7): same ApplicationUri AND Sign/SignAndEncrypt channel ----

    it("SCT-12 - refuses anonymous -> username", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app", MessageSecurityMode.SignAndEncrypt),
                fakeSession(new UserNameIdentityToken({ userName: "user1" }), "urn:app", MessageSecurityMode.SignAndEncrypt)
            )
        ).eql(false);
    });

    it("SCT-13 - allows anonymous -> anonymous with same ApplicationUri over a signed channel", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app:client", MessageSecurityMode.Sign),
                fakeSession(new AnonymousIdentityToken({}), "urn:app:client", MessageSecurityMode.Sign)
            )
        ).eql(true);
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app:client", MessageSecurityMode.SignAndEncrypt),
                fakeSession(new AnonymousIdentityToken({}), "urn:app:client", MessageSecurityMode.SignAndEncrypt)
            )
        ).eql(true);
    });

    it("SCT-14 - refuses anonymous -> anonymous with a different ApplicationUri (even over a signed channel)", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app:victim", MessageSecurityMode.SignAndEncrypt),
                fakeSession(new AnonymousIdentityToken({}), "urn:app:attacker", MessageSecurityMode.SignAndEncrypt)
            )
        ).eql(false);
    });

    it("SCT-15 - refuses anonymous -> anonymous when the ApplicationUri is missing", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), undefined, MessageSecurityMode.SignAndEncrypt),
                fakeSession(new AnonymousIdentityToken({}), undefined, MessageSecurityMode.SignAndEncrypt)
            )
        ).eql(false);
    });

    it("SCT-16 - refuses anonymous -> anonymous over an unsecured channel by default", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app", MessageSecurityMode.None),
                fakeSession(new AnonymousIdentityToken({}), "urn:app", MessageSecurityMode.None)
            )
        ).eql(false);
        // also refused if only one side is secured
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app", MessageSecurityMode.SignAndEncrypt),
                fakeSession(new AnonymousIdentityToken({}), "urn:app", MessageSecurityMode.None)
            )
        ).eql(false);
    });

    it("SCT-17 - allows anonymous over an unsecured channel only when explicitly relaxed", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({}), "urn:app", MessageSecurityMode.None),
                fakeSession(new AnonymousIdentityToken({}), "urn:other", MessageSecurityMode.None),
                { allowAnonymousTransferOnUnsecuredChannel: true }
            )
        ).eql(true);
    });

    // ---- fail closed, never throw (unsupported / asymmetric identity) ----

    it("SCT-18 - refuses (without throwing) when only one side carries a user identity token", () => {
        // authenticated owner, destination without a token
        should(() =>
            sessionsCompatibleForTransfer(identity(new UserNameIdentityToken({ userName: "user1" })), fakeSession(undefined))
        ).not.throw();
        should(
            sessionsCompatibleForTransfer(identity(new UserNameIdentityToken({ userName: "user1" })), fakeSession(undefined))
        ).eql(false);

        // owner without a token, authenticated destination
        should(() =>
            sessionsCompatibleForTransfer(identity(undefined), fakeSession(new UserNameIdentityToken({ userName: "user1" })))
        ).not.throw();
        should(
            sessionsCompatibleForTransfer(identity(undefined), fakeSession(new UserNameIdentityToken({ userName: "user1" })))
        ).eql(false);
    });

    it("SCT-19 - refuses (fail closed, without throwing) for an unsupported identity token type", () => {
        const issued = new IssuedIdentityToken({ tokenData: Buffer.from("opaque-token") });
        identity(issued).kind.should.eql("unsupported");
        should(() => sessionsCompatibleForTransfer(identity(issued), fakeSession(new IssuedIdentityToken({})))).not.throw();
        should(sessionsCompatibleForTransfer(identity(issued), fakeSession(new IssuedIdentityToken({})))).eql(false);
    });
});
