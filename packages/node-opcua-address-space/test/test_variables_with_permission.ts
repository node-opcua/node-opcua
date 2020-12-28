// tslint:disable:no-bitwise

import { AttributeIds, makeAccessLevelFlag } from "node-opcua-data-model";
import { AccessLevelFlag } from "node-opcua-data-model";
import { BrowseDescription } from "node-opcua-service-browse";

import { AddressSpace, Namespace, SessionContext, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";
import { NodeId } from "node-opcua-nodeid";

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
                accessLevel: 0x3f,
                browseName: "SomeVar",
                dataType: "Double",
                userAccessLevel: 0x3f
            });
            done(err);
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should adjust userAccessLevel based on session Context permission", () => {
        variable.userAccessLevel.should.eql(0x3f);
        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(0x3f);
    });

    it("should adjust userAccessLevel based on session Context permission", () => {
        variable.userAccessLevel = 0;
        variable.userAccessLevel.should.eql(0);

        variable.setPermissions({
            CurrentRead: ["*"], // at the end we want CurrentReadAccess to All user
            CurrentWrite: ["!*"] // and no write access at all
        });

        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);
        //dataValue1.value.value.should.eql(makeAccessLevelFlag("CurrentRead"));
    });
    it("should adjust userAccessLevel based on session Context permission", () => {
        const context = new SessionContext({
            session: {
                getSessionId() {
                    return NodeId.nullNodeId;
                }
            }
        });
        context.getCurrentUserRole = () => "Operator";

        variable.userAccessLevel = 0;
        variable.userAccessLevel.should.eql(0);

        variable.setPermissions({
            CurrentRead: ["*"],
            CurrentWrite: ["!*", "Administrator"]
        });
        const dataValue1 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(AccessLevelFlag.CurrentRead);

        context.getCurrentUserRole = () => "Administrator";
        const dataValue2 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue2.value.value.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });
});
