import {
    type AddressSpace,
    makeRoles,
    SessionContext,
    type UAObject,
    type UAVariable,
    WellKnownRoles
} from "node-opcua-address-space";
import { AttributeIds, makeAccessLevelFlag } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source";

// const mini_nodeset_filename = get_mini_nodeset_filename();

describe("ServerDiagnostics.EnabledFlag Permissions", function (this: Mocha.Suite) {
    let engine: ServerEngine;

    before((done) => {
        engine = new ServerEngine({
            applicationUri: "application:uri"
        });
        engine.initialize({ nodeset_filename: nodesets.standard }, () => {
            done();
        });
    });

    after(async () => {
        await engine.shutdown();
    });

    function getEnabledFlagNode(): UAVariable {
        const addressSpace = engine.addressSpace as AddressSpace;
        const server = addressSpace.rootFolder.objects.server;
        const serverDiagnostics = server.getComponentByName("ServerDiagnostics") as UAObject;
        should.exist(serverDiagnostics, "ServerDiagnostics node should exist");
        const enabledFlag = serverDiagnostics.getPropertyByName("EnabledFlag") as UAVariable;
        should.exist(enabledFlag, "EnabledFlag node should exist");
        return enabledFlag;
    }

    it("EnabledFlag accessLevel should include CurrentRead and CurrentWrite", () => {
        const enabledFlag = getEnabledFlagNode();
        const expected = makeAccessLevelFlag("CurrentRead | CurrentWrite");
        (enabledFlag.accessLevel & expected).should.eql(expected);
    });

    it("EnabledFlag should have rolePermissions set", () => {
        const enabledFlag = getEnabledFlagNode();
        should.exist(enabledFlag.rolePermissions, "rolePermissions should be set");
        enabledFlag.rolePermissions?.length.should.eql(8, "should have 8 role permission entries");
    });

    it("Anonymous user should have Read+Browse but NOT Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Browse).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(false);
    });

    it("AuthenticatedUser should have Read+Browse but NOT Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Browse).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(false);
    });

    it("Observer should have Read+Browse but NOT Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Observer]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(false);
    });

    it("Operator should have Read+Browse but NOT Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Operator]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(false);
    });

    it("Engineer should have Read+Browse but NOT Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Engineer]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(false);
    });

    it("Supervisor should have Read+Browse but NOT Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Supervisor]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(false);
    });

    it("ConfigureAdmin should have Read+Browse+Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.ConfigureAdmin]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Browse).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(true);
    });

    it("SecurityAdmin should have Read+Browse+Write permission", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.SecurityAdmin]);

        context.checkPermission(enabledFlag, PermissionType.Read).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Browse).should.eql(true);
        context.checkPermission(enabledFlag, PermissionType.Write).should.eql(true);
    });

    it("ConfigureAdmin should be able to write EnabledFlag (isUserWritable)", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.ConfigureAdmin]);

        enabledFlag.isUserWritable(context).should.eql(true);
    });

    it("Engineer should NOT be able to write EnabledFlag (isUserWritable)", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Engineer]);

        enabledFlag.isUserWritable(context).should.eql(false);
    });

    it("Anonymous should NOT be able to write EnabledFlag (isUserWritable)", () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);

        enabledFlag.isUserWritable(context).should.eql(false);
    });

    it("ConfigureAdmin should be able to write a value to EnabledFlag", async () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.ConfigureAdmin]);

        const statusCode = await enabledFlag.writeAttribute(context, {
            attributeId: AttributeIds.Value,
            value: { value: { dataType: DataType.Boolean, value: true } }
        });
        statusCode.should.eql(StatusCodes.Good);
    });

    it("Observer should be denied writing a value to EnabledFlag", async () => {
        const enabledFlag = getEnabledFlagNode();
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Observer]);

        const statusCode = await enabledFlag.writeAttribute(context, {
            attributeId: AttributeIds.Value,
            value: { value: { dataType: DataType.Boolean, value: true } }
        });
        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });

    it("EnabledFlag should be readable by all roles", () => {
        const enabledFlag = getEnabledFlagNode();

        const allRoles = [
            WellKnownRoles.Anonymous,
            WellKnownRoles.AuthenticatedUser,
            WellKnownRoles.Observer,
            WellKnownRoles.Operator,
            WellKnownRoles.Engineer,
            WellKnownRoles.Supervisor,
            WellKnownRoles.ConfigureAdmin,
            WellKnownRoles.SecurityAdmin
        ];

        for (const role of allRoles) {
            const context = new SessionContext();
            context.getCurrentUserRoles = () => makeRoles([role]);

            enabledFlag.isUserReadable(context).should.eql(true, `Role ${role} should be able to read EnabledFlag`);
        }
    });
});
