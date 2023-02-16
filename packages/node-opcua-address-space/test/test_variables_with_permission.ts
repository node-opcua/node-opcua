import "should";

import {
    accessLevelFlagToString,
    AttributeIds,
    makeAccessLevelFlag,
    makePermissionFlag,
    AccessLevelFlag,
    makeAccessRestrictionsFlag,
    PermissionFlag,
    allPermissions,
    AccessRestrictionsFlag,
    BrowseDirection
} from "node-opcua-data-model";
import { ObjectIds } from "node-opcua-constants";
import { StatusCodes } from "node-opcua-status-code";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataType, VariantArrayType } from "node-opcua-variant";
import {
    AnonymousIdentityToken,
    MessageSecurityMode,
    PermissionType,
    RolePermissionType,
    UserNameIdentityToken
} from "node-opcua-types";

import { UAObject, Namespace, PseudoSession, SessionContext, setNamespaceMetaData, UAVariable, AddressSpace } from "..";
import { generateAddressSpace } from "../distNodeJS";
import { getMiniAddressSpace, MockContinuationPointManager, mockSession } from "../testHelpers";
import { WellKnownRoles, makeRoles } from "..";

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
                accessLevel: makeAccessLevelFlag(
                    "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
                ),
                userAccessLevel: makeAccessLevelFlag(
                    "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
                ),

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
        variable.userAccessLevel!.should.eql(0x3f);
        accessLevelFlagToString(variable.userAccessLevel!).should.eql(
            "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
        );
        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(0x3f);
        accessLevelFlagToString(dataValue1.value.value).should.eql(
            "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
        );
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
            session: mockSession
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
        context
            .getCurrentUserRoles()
            .map((r) => r.toString())
            .join(";")
            .should.eql("ns=0;i=15656;ns=0;i=15680");

        const dataValue1 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(AccessLevelFlag.CurrentRead);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]);
        context
            .getCurrentUserRoles()
            .map((r) => r.value)
            .should.eql([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]);
        const dataValue2 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue2.value.value.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });
});

describe("SPP1 AddressSpace: RoleAndPermissions resolving to Namespace Metadata", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let uaVariable: UAVariable;
    let uaVariable2: UAVariable;
    let uaDefaultVariable: UAVariable;
    let parentNode: UAObject;
    let restrictedVariableSign: UAVariable;
    let restrictedVariableSignAndEncrypt: UAVariable;

    const server = {
        userManager: {
            getUserRoles(username) {
                switch (username) {
                    case "user":
                    case "user1": {
                        return makeRoles(WellKnownRoles.AuthenticatedUser);
                    }
                    case "admin": {
                        return makeRoles([
                            WellKnownRoles.AuthenticatedUser,
                            WellKnownRoles.SecurityAdmin,
                            WellKnownRoles.ConfigureAdmin
                        ]);
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
                return new NodeId();
            },
            continuationPointManager: new MockContinuationPointManager(),
            userIdentityToken: new AnonymousIdentityToken()
        }
    });

    const contextAuthenticated = new SessionContext({
        server,
        session: {
            getSessionId() {
                return new NodeId();
            },
            continuationPointManager: new MockContinuationPointManager(),
            userIdentityToken: new UserNameIdentityToken({
                userName: "user1"
            })
        }
    });

    const contextAdmin = new SessionContext({
        server,
        session: {
            getSessionId() {
                return new NodeId();
            },
            continuationPointManager: new MockContinuationPointManager(),
            userIdentityToken: new UserNameIdentityToken({
                userName: "admin"
            })
        }
    });

    const contextSecurityNone = new SessionContext({
        server,
        session: {
            getSessionId() {
                return new NodeId();
            },
            userIdentityToken: new UserNameIdentityToken({
                userName: "admin"
            }),
            continuationPointManager: new MockContinuationPointManager(),
            channel: {
                securityMode: MessageSecurityMode.None,
                securityPolicy: "",
                clientCertificate: null
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
            continuationPointManager: new MockContinuationPointManager(),
            channel: {
                securityMode: MessageSecurityMode.Sign,
                securityPolicy: "",
                clientCertificate: null
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
            continuationPointManager: new MockContinuationPointManager(),
            channel: {
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: "",
                clientCertificate: null
            }
        }
    });
    before(async () => {
        addressSpace = AddressSpace.create();

        addressSpace.registerNamespace("http://MyNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.adi]);

        namespace = addressSpace.getOwnNamespace();
        namespace.namespaceUri.should.eql("http://MyNamespace");

        const myRestriction = makeAccessRestrictionsFlag("SigningRequired | SessionRequired");
        const myRolePermissions = [
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
            })
        ];
        namespace.setDefaultAccessRestrictions(myRestriction);
        namespace.setDefaultRolePermissions(myRolePermissions);

        // install the nodeUA Elements
        setNamespaceMetaData(namespace);

        parentNode = namespace.addObject({ browseName: "Object", organizedBy: addressSpace.rootFolder.objects });


        uaDefaultVariable = namespace.addAnalogDataItem({
            browseName: "DefaultVariable",
            nodeId: "s=DefaultVariable",
            dataType: "Double",
            engineeringUnitsRange: { low: -100, high: 100 },    
            componentOf: parentNode
        });
        uaDefaultVariable.setValueFromSource({dataType: "Double", value: 42});


        uaVariable = namespace.addVariable({
            accessLevel: makeAccessLevelFlag(
                "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
            ),
            userAccessLevel: makeAccessLevelFlag(
                "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
            ),
            browseName: "SomeVar",
            dataType: "Double",
            componentOf: parentNode
        });
        uaVariable.setValueFromSource({ dataType: DataType.Double, value: 0 });

        uaVariable.nodeId.namespace.should.eql(namespace.index);

        const adiNamespace = addressSpace.rootFolder.objects.server.getComponentByName("Namespaces", 0)!.getChildByName(nodesets.adi);

        restrictedVariableSign = namespace.addVariable({
            accessLevel: makeAccessLevelFlag(
                "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
            ),
            userAccessLevel: makeAccessLevelFlag(
                "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
            ),
            browseName: "SomeVarS",
            dataType: "Double",
            accessRestrictions: AccessRestrictionsFlag.SigningRequired,
            componentOf: parentNode
        });
        restrictedVariableSign.setValueFromSource({ dataType: DataType.Double, value: 0 });

        restrictedVariableSignAndEncrypt = namespace.addVariable({
            accessLevel: makeAccessLevelFlag(
                "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
            ),
            userAccessLevel: makeAccessLevelFlag(
                "CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"
            ),
            browseName: "SomeVarS&E",
            dataType: "Double",
            accessRestrictions: AccessRestrictionsFlag.EncryptionRequired,
            componentOf: parentNode
        });
        restrictedVariableSignAndEncrypt.setValueFromSource({ dataType: DataType.Double, value: 0 });

        // will not inherit from name space
        uaVariable2 = namespace.addAnalogDataItem({
            browseName: "A",
            dataType: DataType.Double,
            definition: "A",
            engineeringUnitsRange: { low: 10, high: 20 },
            componentOf: parentNode,
            accessRestrictions: AccessRestrictionsFlag.None,
            rolePermissions: [
                { roleId: WellKnownRoles.Anonymous, permissions: allPermissions },
                { roleId: WellKnownRoles.SecurityAdmin, permissions: allPermissions },
                { roleId: WellKnownRoles.ConfigureAdmin, permissions: allPermissions }
            ]
            // no restriction on self (despite the fact that namespace default has role restriction)
        });
    });
    after(() => {
        addressSpace.dispose();
    });


    describe("KK-1 Testing variable that inherits from namespace defaults", () => {
        it("it should inherit from namespace defaults", async () => {
            const nodeId = uaDefaultVariable.nodeId;
       
            const sessionAnonymous= new PseudoSession(addressSpace, contextAnonymous);
            const dataValue = await sessionAnonymous.read({nodeId, attributeId: AttributeIds.Value});
            dataValue.statusCode.should.eql(StatusCodes.Good);

        });
    });

    it("should fall back to the namespace defaultUserRolePermission", () => {
        contextAnonymous.checkPermission(uaVariable, PermissionType.Write).should.eql(false);
        contextAuthenticated.checkPermission(uaVariable, PermissionType.Write).should.eql(true);
        contextAdmin.checkPermission(uaVariable, PermissionType.Write).should.eql(true);
    });
    it("getAccessRestrictions: should not restrict read access to a variable if no encryption ", () => {
        contextSecurityNone.isAccessRestricted(restrictedVariableSign).should.eql(true);
        contextSecuritySign.isAccessRestricted(restrictedVariableSign).should.eql(false);
        contextSecuritySignAndEncrypt.isAccessRestricted(restrictedVariableSign).should.eql(false);

        restrictedVariableSign.readValue(contextSecurityNone).statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        restrictedVariableSign.readValue(contextSecuritySign).statusCode.should.eql(StatusCodes.Good);
        restrictedVariableSign.readValue(contextSecuritySignAndEncrypt).statusCode.should.eql(StatusCodes.Good);
    });
    it("getAccessRestrictions: should not restrict read access to a variable if no encryption ", () => {
        contextSecurityNone.isAccessRestricted(restrictedVariableSignAndEncrypt).should.eql(true);
        contextSecuritySign.isAccessRestricted(restrictedVariableSignAndEncrypt).should.eql(true);
        contextSecuritySignAndEncrypt.isAccessRestricted(restrictedVariableSignAndEncrypt).should.eql(false);

        restrictedVariableSignAndEncrypt
            .readValue(contextSecurityNone)
            .statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        restrictedVariableSignAndEncrypt
            .readValue(contextSecuritySign)
            .statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        restrictedVariableSignAndEncrypt.readValue(contextSecuritySignAndEncrypt).statusCode.should.eql(StatusCodes.Good);
    });

    it("isBrowseAccessRestricted ", () => {
        contextAdmin.isBrowseAccessRestricted(uaVariable).should.eql(false);
        contextAuthenticated.isBrowseAccessRestricted(uaVariable).should.eql(false);
        contextAnonymous.isBrowseAccessRestricted(uaVariable).should.eql(true);
    });

    it("isBrowseAccessRestricted: session should browse node with BrowsePermission", async () => {
        const session1 = new PseudoSession(addressSpace, contextAdmin);
        const browseResult1 = await session1.browse({
            nodeId: uaVariable2.nodeId,
            browseDirection: BrowseDirection.Forward,
            resultMask: 0xff
        });
        browseResult1.references = browseResult1.references || [];
        console.log(browseResult1.statusCode.toString(), browseResult1.references.length);
        browseResult1.references.length.should.eql(3);
        const names = browseResult1.references.map((x) => x.browseName.toString()).sort();
        console.log("names", names);
        names.should.eql(["AnalogItemType", "Definition", "EURange"]);
    });
    it("isBrowseAccessRestricted: session should not browse node without BrowsePermission ", async () => {
        const session2 = new PseudoSession(addressSpace, contextAnonymous);
        const browseResult2 = await session2.browse({
            nodeId: uaVariable2.nodeId,
            browseDirection: BrowseDirection.Forward
        });
        browseResult2.references = browseResult2.references || [];
        console.log(browseResult2.statusCode.toString(), browseResult2.references.length);
        browseResult2.references.length.should.eql(1);
    });

    it("BrowsingNode With browse restriction on children [Anonymous]: session should not expose child node without BrowsePermission when browsing Parent ", async () => {
        const session2 = new PseudoSession(addressSpace, contextAnonymous);
        const browseResult2 = await session2.browse({
            nodeId: parentNode.nodeId,
            browseDirection: BrowseDirection.Forward,
            resultMask: 0xff
        });
        browseResult2.references = browseResult2.references || [];

        console.log(browseResult2.statusCode.toString(), browseResult2.references.length);
        const names = browseResult2.references.map((x) => x.browseName.toString()).sort();
        console.log("names", names);
        browseResult2.references.length.should.eql(2);
        names.should.eql(["1:A", "BaseObjectType"]);
    });
    it("BrowsingNode With browse restriction on children [contextSecuritySignAndEncrypt]: session should not expose child node without BrowsePermission when browsing Parent ", async () => {
        const session2 = new PseudoSession(addressSpace, contextSecuritySignAndEncrypt);
        const browseResult2 = await session2.browse({
            nodeId: parentNode.nodeId,
            browseDirection: BrowseDirection.Forward,
            resultMask: 0xff
        });
        browseResult2.references = browseResult2.references || [];
        console.log(browseResult2.statusCode.toString(), browseResult2.references.length);

        const names = browseResult2.references.map((x) => x.browseName.toString()).sort();
        console.log("names", names);
        browseResult2.references.length.should.eql(6);
        names.should.eql(["1:A", "1:DefaultVariable", "1:SomeVar", "1:SomeVarS", "1:SomeVarS&E", "BaseObjectType"]);
    });
});
