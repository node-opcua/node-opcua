const { AttributeIds, isValidAttributeId } = require("..");

describe("AttributeIds", () => {
    it("isValidAttributeId 1", () => {

        isValidAttributeId(-1).should.eql(false);
        isValidAttributeId(AttributeIds.LAST).should.eql(true);
        isValidAttributeId(AttributeIds.AccessRestrictions).should.eql(true);

    })
})
