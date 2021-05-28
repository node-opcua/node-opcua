// tslint:disable:no-bitwise

import {
    accessLevelFlagToString,
    AttributeIds,
    makeAccessLevelFlag,
    makePermissionFlag,
    AccessLevelFlag,
    makeAccessRestrictionsFlag,
    PermissionFlag,
    allPermissions,
    AccessRestrictionsFlag
} from "node-opcua-data-model";
import {
    ObjectIds
} from "node-opcua-constants";

import { AddressSpace, Namespace, PseudoSession, SessionContext, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { WellKnownRoles, makeRoles } from "..";
import "should";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace : Variable.setPermissions", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let variable: UAVariable;

    before((done) => {
        getMiniAddressSpace((err: Error | null, __addressSpace__?: AddressSpace) => {
            addressSpace = __addressSpace__!;

            namespace = addressSpace.getOwnNamespace();

            variable = namespace.addVariable({
                accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
                userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),

                browseName: "SomeVar",
                dataType: "Double"
            });
            done(err);
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should adjust userAccessLevel based on session Context permission", () => {
        variable.userAccessLevel.should.eql(0x3f);
        accessLevelFlagToString(variable.userAccessLevel).should.eql("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange");
        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(0x3f);
        accessLevelFlagToString(dataValue1.value.value).should.eql("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange");
    });

    it("should adjust userAccessLevel based on session Context permission", () => {
        variable.userAccessLevel = makeAccessLevelFlag("CurrentRead | CurrentWrite");
        variable.userAccessLevel.should.eql(0x03);

        variable.setRolePermissions([
            { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Read") as number },
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Read") as number }
        ]);
        // variable.setPermissions({
        //     [Permission.Read]: ["*"], // at the end we want CurrentReadAccess to All user
        //     [Permission.Write]: ["!*"] // and no write access at all
        // });

        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);

        accessLevelFlagToString(dataValue1.value.value).should.eql("CurrentRead | CurrentWrite");

    });
    it("should adjust userAccessLevel based on session Context permission", () => {
        const context = new SessionContext({
            session: {
                getSessionId() {
                    return NodeId.nullNodeId;
                }
            }
        });
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]);


        variable.userAccessLevel = makeAccessLevelFlag("CurrentRead | CurrentWrite");
        variable.userAccessLevel.should.eql(0x03);

        variable.setRolePermissions([
            { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Read") as number },
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Read") as number },
            { roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Read | Write") as number }
        ]);
        // variable.setPermissions({
        //     [Permission.Read]: ["*"],
        //     [Permission.Write]: ["!*", WellKnownRoles.ConfigureAdmin]
        // });
        context.getCurrentUserRoles().map(r => r.toString()).join(";").should.eql("ns=0;i=15656;ns=0;i=15680");

        const dataValue1 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(AccessLevelFlag.CurrentRead);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]);
        context.getCurrentUserRoles().map(r => r.value).should.eql([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]);
        const dataValue2 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue2.value.value.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });
});

import { generateAddressSpace } from "../distNodeJS";
import { nodesets } from "node-opcua-nodesets";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { AnonymousIdentityToken, MessageSecurityMode, PermissionType, RolePermissionType, UserNameIdentityToken } from "node-opcua-types";
import { StatusCodes } from "node-opcua-status-code";

describe("SPP1 AddressSpace: RoleAndPermissions resolving to Namespace Metadata", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let variable: UAVariable;
    let dataItem: UAVariable;
    let restrictedVariableSign: UAVariable;
    let restrictedVariableSignAndEncrypt: UAVariable;



    const server = {
        userManager: {
            getUserRoles(username) {
                switch (username) {
                    case "user":
                    case "user1":
                        {
                            return makeRoles(WellKnownRoles.AuthenticatedUser);
                        }
                    case "admin": {
                        return makeRoles(WellKnownRoles.SecurityAdmin);
                    }
                    default:
                        return makeRoles(WellKnownRoles.Anonymous);
                }
            }
        }
    };

    const contextAnonymous = new SessionContext({
        server,
        session: {
            getSessionId() {
                return NodeId.nullNodeId;
            },
            userIdentityToken: new AnonymousIdentityToken()
        },
    });

    const contextAuthenticated = new SessionContext({
        server,
        session: {
            getSessionId() {
                return NodeId.nullNodeId;
            },
            userIdentityToken: new UserNameIdentityToken({
                userName: "user1"
            })
        }
    });

    const contextAdmin = new SessionContext({
        server,
        session: {
            getSessionId() {
                return NodeId.nullNodeId;
            },
            userIdentityToken: new UserNameIdentityToken({
                userName: "admin"
            })
        }
    });

    const contextSecurityNone = new SessionContext({
        server,
        session: {
            getSessionId() {
                return NodeId.nullNodeId;
            },
            userIdentityToken: new UserNameIdentityToken({
                userName: "admin"
            }),
            channel: {
                securityMode: MessageSecurityMode.None,
                securityPolicy: "",
                clientCertificate: null,
            }
        }
    });
    const contextSecuritySign = new SessionContext({
        server,
        session: {
            getSessionId() {
                return NodeId.nullNodeId;
            },
            userIdentityToken: new UserNameIdentityToken({
                userName: "admin"
            }),
            channel: {
                securityMode: MessageSecurityMode.Sign,
                securityPolicy: "",
                clientCertificate: null,
            }
        }
    });
    const contextSecuritySignAndEncrypt = new SessionContext({
        server,
        session: {
            getSessionId() {
                return NodeId.nullNodeId;
            },
            userIdentityToken: new UserNameIdentityToken({
                userName: "admin"
            }),
            channel: {
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: "",
                clientCertificate: null,
            }
        }
    });
    before(async () => {

        addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.adi
        ]);

        namespace = addressSpace.getOwnNamespace();

        const namespaceMetadataType = addressSpace.findObjectType("NamespaceMetadataType");
        const uaNamespace = namespaceMetadataType.instantiate({
            browseName: namespace.namespaceUri,
            componentOf: addressSpace.rootFolder.objects.server.namespaces,
            optionals: [
                "DefaultAccessRestrictions",
                "DefaultRolePermissions",
                "DefaultUserRolePermissions"
            ]
        });

        const defaultAccessRestrictions = uaNamespace.getChildByName("DefaultAccessRestrictions") as UAVariable;
        defaultAccessRestrictions.setValueFromSource({
            dataType: DataType.UInt16,
            value: makeAccessRestrictionsFlag("SigningRequired | SessionRequired")
        });

        const defaultRolePermissions = uaNamespace.getChildByName("DefaultRolePermissions") as UAVariable;
        defaultRolePermissions.setValueFromSource({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: [
                new RolePermissionType({
                    roleId: resolveNodeId(ObjectIds.WellKnownRole_Anonymous),
                    permissions: PermissionType.Read
                }),
                new RolePermissionType({
                    roleId: resolveNodeId(ObjectIds.WellKnownRole_AuthenticatedUser),
                    permissions: PermissionType.Read | PermissionFlag.Write | PermissionFlag.Browse
                }),
                new RolePermissionType({
                    roleId: resolveNodeId(ObjectIds.WellKnownRole_SecurityAdmin),
                    permissions: allPermissions
                }),
            ]
        });

        const defaultUserRolePermissions = uaNamespace.getChildByName("DefaultUserRolePermissions") as UAVariable;


        variable = namespace.addVariable({
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
            userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
            browseName: "SomeVar",
            dataType: "Double",
        });
        variable.setValueFromSource({ dataType: DataType.Double, value: 0 });

        variable.nodeId.namespace.should.eql(namespace.index);

        const adiNamespace = addressSpace.rootFolder.objects.server.namespaces.getChildByName(nodesets.adi);

        restrictedVariableSign = namespace.addVariable({
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
            userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
            browseName: "SomeVarS",
            dataType: "Double",
            accessRestrictions: AccessRestrictionsFlag.SigningRequired
        });
        restrictedVariableSign.setValueFromSource({ dataType: DataType.Double, value: 0 });

        restrictedVariableSignAndEncrypt = namespace.addVariable({
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
            userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
            browseName: "SomeVarS&E",
            dataType: "Double",
            accessRestrictions: AccessRestrictionsFlag.EncryptionRequired
        });
        restrictedVariableSignAndEncrypt.setValueFromSource({ dataType: DataType.Double, value: 0 });

        dataItem = namespace.addAnalogDataItem({
            browseName: "A",
            dataType: DataType.Double,
            definition: "A",
            engineeringUnitsRange: { low: 10, high: 20 }
        });
    });
    after(() => {
        addressSpace.dispose();
    });
    it("should fall back to the namespace defaultUserRolePermission", () => {

        contextAnonymous.checkPermission(variable, PermissionType.Write).should.eql(false);
        contextAuthenticated.checkPermission(variable, PermissionType.Write).should.eql(true);
        contextAdmin.checkPermission(variable, PermissionType.Write).should.eql(true);

    });
    it("getAccessRestrictions: should not restrict read access to a variable if no encryption ", () => {

        contextSecurityNone.isAccessRestricted(restrictedVariableSign).should.eql(true);
        contextSecuritySign.isAccessRestricted(restrictedVariableSign).should.eql(false);
        contextSecuritySignAndEncrypt.isAccessRestricted(restrictedVariableSign).should.eql(false);


        restrictedVariableSign.readValue(contextSecurityNone).statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        restrictedVariableSign.readValue(contextSecuritySign).statusCode.should.eql(StatusCodes.Good);
        restrictedVariableSign.readValue(contextSecuritySignAndEncrypt).statusCode.should.eql(StatusCodes.Good);
    })
    it("getAccessRestrictions: should not restrict read access to a variable if no encryption ", () => {

        contextSecurityNone.isAccessRestricted(restrictedVariableSignAndEncrypt).should.eql(true);
        contextSecuritySign.isAccessRestricted(restrictedVariableSignAndEncrypt).should.eql(true);
        contextSecuritySignAndEncrypt.isAccessRestricted(restrictedVariableSignAndEncrypt).should.eql(false);

        restrictedVariableSignAndEncrypt.readValue(contextSecurityNone).statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        restrictedVariableSignAndEncrypt.readValue(contextSecuritySign).statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        restrictedVariableSignAndEncrypt.readValue(contextSecuritySignAndEncrypt).statusCode.should.eql(StatusCodes.Good);

    });

    it("isBrowseAccessRestricted ", () => {
        contextAdmin.isBrowseAccessRestricted(variable).should.eql(false);
        contextAuthenticated.isBrowseAccessRestricted(variable).should.eql(false);
        contextAnonymous.isBrowseAccessRestricted(variable).should.eql(true);
    });

    it("isBrowseAccessRestricted: session should browse node with BrowsePermission", async () => {

        const session1 = new PseudoSession(addressSpace, contextAdmin);
        const browseResult1 = await session1.browse({
            nodeId: dataItem.nodeId
        });
        console.log(browseResult1.statusCode.toString(), browseResult1.references.length);
        browseResult1.references.length.should.eql(3);
    });
    it("isBrowseAccessRestricted: session should not browse node without BrowsePermission ", async () => {

        const session2 = new PseudoSession(addressSpace, contextAnonymous);
        const browseResult2 = await session2.browse({
            nodeId: dataItem.nodeId
        });
        console.log(browseResult2.statusCode.toString(), browseResult2.references.length);
        browseResult2.references.length.should.eql(0);

    });
});
