import * as path from "path";

import { readCertificate } from "node-opcua-crypto";
import { X509IdentityToken } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { should } from "should";
import { AddressSpace, BaseNode, Namespace, SessionContext, UAObject } from "..";

// let's make sure should don't get removed by typescript optimizer
const keep_should = should;

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

describe("SessionContext", () => {

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before((done: (err?: Error) => void) => {

        get_mini_address_space((err: Error | null, _addressSpace: AddressSpace) => {
            if (err) {
                done(err!);
                return;
            }
            addressSpace = _addressSpace;
            namespace = addressSpace.getOwnNamespace();
            done();
        });
    });

    it("should provide a default session context - getCurrentUserRole", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRole().should.eql("default");
    });

    it("should provide a  default session context - checkPermission", () => {
        const context = SessionContext.defaultContext;

        const someNode = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode",
            dataType: DataType.Double,
            nodeId: "i=12",
            userAccessLevel: "CurrentRead"
        });
        context.checkPermission(someNode, "CurrentRead").should.eql(true);
        context.checkPermission(someNode, "CurrentWrite").should.eql(false);

    });
});
describe("SessionContext - with  dedicated SessionContext and certificate ", () => {

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let sessionContext: SessionContext;

    const mockUserManager = {

        isValidUser: (userName: string, password: string) => {

            if (userName === "NodeOPCUA") {
                return true;
            }

            if (userName === "user1" && password === "password1") {
                return true;
            }
            if (userName === "user2" && password === "password2") {
                return true;
            }
            return false;
        },

        // see OPCUA 1.04 part 3 4.8.2 Well know role
        // Anonymous          The Role has very limited access for use when a Session has anonymous credentials.
        // AuthenticatedUser  The Role has limited access for use when a Session has valid non-anonymous credentials
        //                    but has not been explicitly granted access to a Role.
        // Observer           The Role is allowed to browse, read live data, read historical data/events or subscribe to
        //                    data/events.
        // Operator           The Role is allowed to browse, read live data, read historical data/events or subscribe to
        //                    data/events.
        //                    In addition, the Session is allowed to write some live data and call some Methods.
        // Engineer           The Role is allowed to browse, read/write configuration data, read historical data/events,
        //                    call Methods or subscribe to data/events.
        // Supervisor         The Role is allowed to browse, read live data, read historical data/events, call Methods
        //                    or subscribe to data/events.
        // ConfigureAdmin     The Role is allowed to change the non-security related configuration settings.
        // SecurityAdmin      The Role is allowed to change security related settings.

        getUserRole(username: string) {
            if (username === "anonymous") {
                return "Anonymous";
            }
            if (username === "NodeOPCUA") {
                return "AuthenticatedUser;SecurityAdmin";
            }
        }
    };

    const mockServer = {
        userManager: mockUserManager
    };

    const certificateFilename = path.join(__dirname, "../../node-opcua-samples/certificates/client_cert_2048.pem");

    const certificate = readCertificate(certificateFilename);
    const mockSession = {
        userIdentityToken: new X509IdentityToken({
            certificateData: certificate
        })
    };

    before((done: (err?: Error) => void) => {

        sessionContext = new SessionContext({
            server: mockServer,
            session: mockSession,
        });
        get_mini_address_space((err: Error | null, _addressSpace: AddressSpace) => {
            if (err) {
                done(err!);
                return;
            }
            addressSpace = _addressSpace;
            namespace = addressSpace.getOwnNamespace();
            done();
        });
    });

    it("should provide a default session context - getCurrentUserRole", () => {
        const context = sessionContext;
        context.getCurrentUserRole().should.eql("AuthenticatedUser;SecurityAdmin");
    });

    it("should provide a  default session context - checkPermission", () => {
        const context = sessionContext;

        const someNode = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode",
            dataType: DataType.Double,
            nodeId: "i=12",
            userAccessLevel: "CurrentRead"
        });
        context.checkPermission(someNode, "CurrentRead").should.eql(true);
        context.checkPermission(someNode, "CurrentWrite").should.eql(false);

    });
});
