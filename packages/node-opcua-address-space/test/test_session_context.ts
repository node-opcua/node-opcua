import * as path from "path";
import * as fs from "fs";

import { readCertificate } from "node-opcua-crypto";
import { PermissionType, X509IdentityToken } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import * as should from "should";
import { AddressSpace, BaseNode, Namespace, SessionContext, UAObject , makeRoles} from "..";

// let's make sure should don't get removed by typescript optimizer
const keep_should = should;

import { getMiniAddressSpace } from "../testHelpers";
import { NodeId } from "node-opcua-nodeid";
import { AttributeIds, makeAccessLevelFlag } from "node-opcua-data-model";

const certificateFolder = path.join(__dirname, "../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("SessionContext", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should provide a default session context - getCurrentUserRole", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRoles().should.eql([]);
    });

    it("should provide a  default session context - checkPermission", () => {
        const context = SessionContext.defaultContext;

        const someVariableNode = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode",
            dataType: DataType.Double,
            nodeId: "i=12",
            userAccessLevel: "CurrentRead"
        });
        context.checkPermission(someVariableNode, PermissionType.Read).should.eql(true);
        context.checkPermission(someVariableNode, PermissionType.Write).should.eql(true);
        const dataValue = someVariableNode.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue.value.value.should.eql(makeAccessLevelFlag("CurrentRead"));
        someVariableNode.isUserWritable(context).should.eql(false);
        someVariableNode.isUserReadable(context).should.eql(true);

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

        getUserRoles(username: string): NodeId[] {
            if (username === "anonymous") {
                return makeRoles("Anonymous");
            }
            if (username === "NodeOPCUA") {
                return makeRoles("AuthenticatedUser;SecurityAdmin");
            }
            return makeRoles([]);
        }
    };

    const mockServer = {
        userManager: mockUserManager
    };


    const certificateFilename = path.join(certificateFolder, "client_cert_2048.pem");

    const certificate = readCertificate(certificateFilename);
    const mockSession = {
        userIdentityToken: new X509IdentityToken({
            certificateData: certificate
        }),
        getSessionId() {
            return NodeId.nullNodeId;
        }
    };

    before(async () => {
        sessionContext = new SessionContext({
            server: mockServer,
            session: mockSession
        });
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should provide a default session context - getCurrentUserRole", () => {
        const context = sessionContext;
        context.getCurrentUserRoles()
            .map((s)=>s.toString()).join(";")
            .should.eql("ns=0;i=15656;ns=0;i=15704");
    });

    ///
    it("should check execute permission on a method", () => {

        const context = sessionContext;

        const someObject = addressSpace.getOwnNamespace().addObject({
            browseName: "SomeName",
            nodeId: "i=13"
        });

        const someMethod = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeNode",
            nodeId: "i=14",
            executable: true,
            userExecutable: true,
        });
        context.checkPermission(someMethod, PermissionType.Call);

    })
});
