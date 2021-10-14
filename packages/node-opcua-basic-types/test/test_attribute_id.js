const { AttributeIds, isValidAttributeId } = require("..");

describe("AttributeIds", () => {
    it("isValidAttributeId 1", () => {

        isValidAttributeId(-1).should.eql(false);
        isValidAttributeId(AttributeIds.AccessLevelEx).should.eql(true);
        isValidAttributeId(AttributeIds.LAST).should.eql(true);
        isValidAttributeId(AttributeIds.LAST+1).should.eql(false);
        isValidAttributeId(AttributeIds.AccessRestrictions).should.eql(true);

    })
})
