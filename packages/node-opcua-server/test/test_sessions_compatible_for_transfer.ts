import { AnonymousIdentityToken, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";
import should from "should";

import type { ServerSession } from "../source/server_session";
import {
    getTransferSessionIdentity,
    type ITransferSessionIdentity,
    sessionsCompatibleForTransfer
} from "../source/sessions_compatible_for_transfer";

// The destination argument is only read for its `userIdentityToken`, so a minimal stand-in is enough.
function fakeSession(userIdentityToken?: any): ServerSession {
    return { userIdentityToken } as unknown as ServerSession;
}
function identity(userIdentityToken?: any): ITransferSessionIdentity {
    return { userIdentityToken };
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

    it("SCT-03 - allows anonymous -> anonymous", () => {
        should(
            sessionsCompatibleForTransfer(identity(new AnonymousIdentityToken({})), fakeSession(new AnonymousIdentityToken({})))
        ).eql(true);
    });

    it("SCT-04 - refuses anonymous -> username", () => {
        should(
            sessionsCompatibleForTransfer(
                identity(new AnonymousIdentityToken({})),
                fakeSession(new UserNameIdentityToken({ userName: "user1" }))
            )
        ).eql(false);
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
        const userIdentityToken = new UserNameIdentityToken({ userName: "user1" });
        const snapshot = getTransferSessionIdentity(fakeSession(userIdentityToken));
        should(snapshot.userIdentityToken).equal(userIdentityToken);

        // the snapshot must remain valid for a transfer decision even after the session is gone
        should(
            sessionsCompatibleForTransfer(snapshot, fakeSession(new UserNameIdentityToken({ userName: "user1" })))
        ).eql(true);
        should(
            sessionsCompatibleForTransfer(snapshot, fakeSession(new UserNameIdentityToken({ userName: "user2" })))
        ).eql(false);
    });
});
