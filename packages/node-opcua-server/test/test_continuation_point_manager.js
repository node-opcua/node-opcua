var should = require("should");

var StatusCodes = require("node-opcua-status-code").StatusCodes;


var ContinuationPointManager = require("../src/continuation_point_manager").ContinuationPointManager;

describe("ContinuationPointManager", function () {

    it("should create a ContinuationPointManager", function () {

        var cpm = new ContinuationPointManager();

    });
    it("should return the full a array and no continuation point if array length is less than maxElements", function () {

        var cpm = new ContinuationPointManager();

        var fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        var maxElements = 1000;
        var results = cpm.register(maxElements, fullarray);
        should(results.continuationPoint).eql(null);
        results.references.should.eql([1, 2, 3, 4, 5, 6, 7, 8]);

    });

    it("should return the full a array if maxElements===0", function () {

        var cpm = new ContinuationPointManager();

        var fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        var maxElements = 0;
        var results = cpm.register(maxElements, fullarray);
        should(results.continuationPoint).eql(null);
        results.references.should.eql([1, 2, 3, 4, 5, 6, 7, 8]);

    });

    it("should return up  maxElements if array.length is greater than maxElements", function () {

        var cpm = new ContinuationPointManager();

        var fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        var maxElements = 2;
        var results = cpm.register(maxElements, fullarray);
        should.exist(results.continuationPoint);
        results.references.should.eql([1, 2]);

        results = cpm.getNext(results.continuationPoint);
        results.statusCode.should.eql(StatusCodes.Good);
        should.exist(results.continuationPoint);
        results.references.should.eql([3, 4]);

        results = cpm.getNext(results.continuationPoint);
        results.statusCode.should.eql(StatusCodes.Good);
        should.exist(results.continuationPoint);
        results.references.should.eql([5, 6]);

        results = cpm.getNext(results.continuationPoint);
        results.statusCode.should.eql(StatusCodes.Good);
        should.not.exist(results.continuationPoint);
        results.references.should.eql([7, 8]);

        results = cpm.getNext(results.continuationPoint);
        results.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);

    });

    it("ContinuationPointManager#cancel - should be possible to cancel a continuation point to free up memory", function () {
        var cpm = new ContinuationPointManager();

        var fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        var maxElements = 2;
        var results = cpm.register(maxElements, fullarray);
        should.exist(results.continuationPoint);
        results.references.should.eql([1, 2]);

        cpm.cancel(results.continuationPoint);

        results = cpm.getNext(results.continuationPoint);
        results.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        should.not.exist(results.continuationPoint);
        should.not.exist(results.references);

    });


});
