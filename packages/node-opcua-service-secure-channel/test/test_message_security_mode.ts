import "should";
import { coerceMessageSecurityMode, MessageSecurityMode } from "../dist/index.js";

describe("MessageSecurityMode", () => {
    it("should coerce a string into MessageSecurityMode", () => {
        coerceMessageSecurityMode("None").should.eql(MessageSecurityMode.None);
        coerceMessageSecurityMode("NONE").should.eql(MessageSecurityMode.Invalid);
        coerceMessageSecurityMode("Sign").should.eql(MessageSecurityMode.Sign);

        coerceMessageSecurityMode(2).should.eql(MessageSecurityMode.Sign);
        coerceMessageSecurityMode(3).should.eql(MessageSecurityMode.SignAndEncrypt);
    });
});
