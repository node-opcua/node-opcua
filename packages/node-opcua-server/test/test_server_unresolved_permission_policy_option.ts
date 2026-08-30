import "should";
import { OPCUAServer } from "../source/index.js";

/**
 * unresolvedPermissionPolicy is settable as a first-class OPCUAServer option and lands on the
 * server instance, which is the IServerBase a remote Session's SessionContext reads its policy
 * from (see test_session_context_server_wiring). It stays "allow" by default, preserving the
 * historical permissive behaviour. The deny/allow semantics themselves are covered by the
 * address-space SCUP tests (test_session_context_unresolved_permissions).
 */
describe("OPCUAServer - unresolvedPermissionPolicy option", () => {
    // These only read a constructor option off the instance; the server is never started, so no
    // endpoint is opened and no port is needed.
    it('UPP-1 defaults to "allow"', () => {
        const server = new OPCUAServer({});
        server.unresolvedPermissionPolicy.should.eql("allow");
    });

    it('UPP-2 carries a configured "deny" through to the server instance', () => {
        const server = new OPCUAServer({ unresolvedPermissionPolicy: "deny" });
        server.unresolvedPermissionPolicy.should.eql("deny");
    });
});
