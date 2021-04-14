// tslint:disable:no-bitwise

import { accessLevelFlagToString, AttributeIds, makeAccessLevelFlag, makePermissionFlag } from "node-opcua-data-model";
import { AccessLevelFlag } from "node-opcua-data-model";
import { BrowseDescription } from "node-opcua-service-browse";

import { AddressSpace, Namespace, SessionContext, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";
import { NodeId } from "node-opcua-nodeid";
import { WellKnownRoles} from "..";

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
                accessLevel:     makeAccessLevelFlag("CurrentRead | CurrentWrite | StatusWrite | HistoryRead | HistoryWrite | SemanticChange"),
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
            { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Read") as number},
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Read") as number}
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
        context.getCurrentUserRole = () => [ WellKnownRoles.AuthenticatedUser,  WellKnownRoles.Operator].join(";");


        variable.userAccessLevel = makeAccessLevelFlag("CurrentRead | CurrentWrite");
        variable.userAccessLevel.should.eql(0x03);

        variable.setRolePermissions([
            { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Read") as number},
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Read") as number},
            { roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Read | Write") as number}
        ]);
        // variable.setPermissions({
        //     [Permission.Read]: ["*"],
        //     [Permission.Write]: ["!*", WellKnownRoles.ConfigureAdmin]
        // });
        context.getCurrentUserRole().should.eql("AuthenticatedUser;Operator");

        const dataValue1 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(AccessLevelFlag.CurrentRead);

        context.getCurrentUserRole = () =>  [ WellKnownRoles.AuthenticatedUser,  WellKnownRoles.ConfigureAdmin].join(";");
        context.getCurrentUserRole().should.eql("AuthenticatedUser;ConfigureAdmin");
        const dataValue2 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue2.value.value.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });
});
