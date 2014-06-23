var should = require("should");
var isValidGuid = require("../../lib/datamodel/guid").isValidGuid;
var emptyGuid = require("../../lib/datamodel/guid").emptyGuid;
describe("GUID",function(){

    it("should detect strings that looks like GUID",function(){

        isValidGuid("72962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(true);
        isValidGuid("zz962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);
        isValidGuid("72962B-91FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);

        isValidGuid(emptyGuid).should.equal(true);


    });
});
