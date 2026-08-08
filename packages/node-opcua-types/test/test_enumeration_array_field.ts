import { BinaryStream } from "node-opcua-binary-stream";
import { MessageSecurityMode, SecuritySettingsDataType } from "..";
import should from "should";

/**
 * `SecuritySettingsDataType.SecurityModes` is the first field in the standard
 * `.bsd` that is an *array of an enumeration*. The code generator used to assert
 * `!field.isArray` on the enumeration path and abort, so the whole type set
 * failed to generate. These tests pin the generated behaviour.
 */
describe("generated types: array-of-enumeration fields", () => {
    it("should accept numeric enumeration values", () => {
        const value = new SecuritySettingsDataType({
            securityModes: [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]
        });
        value.securityModes!.should.eql([MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]);
    });

    it("should coerce enumeration values given by name", () => {
        // the Options type only admits MessageSecurityMode; the generated setter is
        // the typed entry point that also accepts the enumeration item's name
        const value = new SecuritySettingsDataType({});
        value.setSecurityModes(["Sign", "SignAndEncrypt"]);
        value.securityModes!.should.eql([MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]);
    });

    it("should throw on a value that cannot be coerced", () => {
        const value = new SecuritySettingsDataType({});
        should(() => value.setSecurityModes(["NotAMode"])).throw(/cannot be coerced to MessageSecurityMode/);
    });

    it("should round trip through the binary encoding", () => {
        const value = new SecuritySettingsDataType({
            name: "default",
            securityModes: [MessageSecurityMode.None, MessageSecurityMode.SignAndEncrypt],
            securityPolicyUris: ["http://opcfoundation.org/UA/SecurityPolicy#None"],
            certificateGroupName: "DefaultApplicationGroup"
        });

        const stream = new BinaryStream(value.binaryStoreSize());
        value.encode(stream);
        stream.rewind();
        const reloaded = new SecuritySettingsDataType();
        reloaded.decode(stream);

        reloaded.securityModes!.should.eql([MessageSecurityMode.None, MessageSecurityMode.SignAndEncrypt]);
        reloaded.securityPolicyUris!.should.eql(["http://opcfoundation.org/UA/SecurityPolicy#None"]);
        reloaded.certificateGroupName!.should.eql("DefaultApplicationGroup");
    });

    it("should treat a null array the same way the sibling non-enumeration array is treated", () => {
        // the enumeration path must not diverge from the array handling every
        // other field category already gets from initialize_field_array
        const value = new SecuritySettingsDataType({ securityModes: null, securityPolicyUris: null });
        JSON.stringify(value.securityModes).should.eql(JSON.stringify(value.securityPolicyUris));
    });

    it("should default to an empty array when the field is omitted", () => {
        const value = new SecuritySettingsDataType({});
        value.securityModes!.should.eql([]);
    });

    it("should fast-init to an empty array when constructed with null options", () => {
        const value = new SecuritySettingsDataType(null);
        value.securityModes!.should.eql([]);
    });
});
