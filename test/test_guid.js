var should = require("should");
var is_guid = require("../lib/guid").is_guid;

describe("GUID",function(){

    it("should detect strings that looks like GUID",function(){

        is_guid("72962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(true);
        is_guid("zz962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);
        is_guid("72962B-91FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);

    });
});
