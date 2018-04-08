const getFunctionParameterNames = require("..").getFunctionParameterNames;

describe("testing getFunctionParameterNames", function() {
    it("#getFunctionParameterNames", function() {
        getFunctionParameterNames(getFunctionParameterNames).should.eql(["func"]);
        getFunctionParameterNames(function(a, b, c, d) {}).should.eql(["a", "b", "c", "d"]);
        getFunctionParameterNames(function(a, /*b,c,*/ d) {}).should.eql(["a", "d"]);
        getFunctionParameterNames(function() {}).should.eql([]);
    });
});
