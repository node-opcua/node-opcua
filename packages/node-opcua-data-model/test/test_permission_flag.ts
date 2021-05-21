import {
    PermissionFlag,
    makePermissionFlag,
    permissionFlagToString,
    allPermissions
} from "../source/permission_flag";
import "should";

const { BinaryStream } = require("node-opcua-binary-stream");


describe("Testing PermissionFlag", function () {

    it("should create a permission level flags from a string", () => {

        makePermissionFlag("DeleteNode | RemoveReference")
            .should.eql(PermissionFlag.RemoveReference + PermissionFlag.DeleteNode);

        makePermissionFlag("All")
            .should.eql(allPermissions);
    });

    it("permissionFlagToString", () => {
        permissionFlagToString(PermissionFlag.RemoveReference).should.eql("RemoveReference");
    });
    it("permissionFlagToString", () => {
        permissionFlagToString(PermissionFlag.None).should.eql("None");
    });
    it("permissionFlagToString", () => {
        permissionFlagToString(allPermissions).should.eql("Browse | ReadRolePermissions | WriteAttribute | WriteRolePermissions | WriteHistorizing | Read | Write | ReadHistory | InsertHistory | ModifyHistory | DeleteHistory | ReceiveEvents | Call | AddReference | RemoveReference | DeleteNode | AddNode");
    });
});
