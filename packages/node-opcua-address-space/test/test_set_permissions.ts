import * as path from "path";

import { readCertificate } from "node-opcua-crypto";
import { X509IdentityToken } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import * as should  from "should";
import { AddressSpace, BaseNode, Namespace, SessionContext, UAObject } from "..";

// let's make sure should don't get removed by typescript optimizer
const keep_should = should;

import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Variable#setPermissions & checkPermission", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("checkPermission-1 should obey default flags when variable has no specific permission", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRole = () => {
            return "AuthenticatedUser;Engineer";
        };

        const someNode = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        context.checkPermission(someNode, "CurrentRead").should.eql(true);
        context.checkPermission(someNode, "CurrentWrite").should.eql(false);
    });
    it("checkPermission-2 should obey default flags when variable has no specific permission", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRole = () => {
            return "AuthenticatedUser;Engineer";
        };

        const someNode1 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode1",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someNode1.setPermissions({
            CurrentRead: ["!*", "Engineer"],
            CurrentWrite: ["!*", "Engineer"]
        });

        context.checkPermission(someNode1, "CurrentRead").should.eql(true);
        context.checkPermission(someNode1, "CurrentWrite").should.eql(true);

        const someNode2 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode2",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someNode1.setPermissions({
            CurrentRead: ["!*", "Admin"],
            CurrentWrite: ["!*", "Admin"]
        });

        context.checkPermission(someNode1, "CurrentRead").should.eql(false);
        context.checkPermission(someNode1, "CurrentWrite").should.eql(false);

        const someNode3 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode3",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someNode1.setPermissions({
            CurrentRead: ["*", "!Engineer"],
            CurrentWrite: ["!*", "!Engineer"]
        });

        context.checkPermission(someNode1, "CurrentRead").should.eql(false);
        context.checkPermission(someNode1, "CurrentWrite").should.eql(false);
    });
});
