const should = require("should");

const { StatusCodes } = require("node-opcua-status-code");
const { ContinuationPointManager } = require("..");

describe("ContinuationPointManager", () => {

    it("should create a ContinuationPointManager", () => {

        const cpm = new ContinuationPointManager();

    });
    it("should return the full a array and no continuation point if array length is less than maxElements", () => {

        const cpm = new ContinuationPointManager();

        const fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        const maxElements = 1000;
        const results = cpm.register(maxElements, fullarray);
        should.not.exist(results.continuationPoint);
        results.references.should.eql([1, 2, 3, 4, 5, 6, 7, 8]);

    });

    it("should return the full a array if maxElements===0", () => {

        const cpm = new ContinuationPointManager();

        const fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        const maxElements = 0;
        const results = cpm.register(maxElements, fullarray);
        should(results.continuationPoint).eql(undefined);
        results.references.should.eql([1, 2, 3, 4, 5, 6, 7, 8]);

    });

    it("should return up  maxElements if array.length is greater than maxElements", () => {

        const cpm = new ContinuationPointManager();

        const fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        const maxElements = 2;
        let results = cpm.register(maxElements, fullarray);
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

    it("ContinuationPointManager#cancel - should be possible to cancel a continuation point to free up memory", () => {
        const cpm = new ContinuationPointManager();

        const fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        const maxElements = 2;
        let results = cpm.register(maxElements, fullarray);
        should.exist(results.continuationPoint);
        results.references.should.eql([1, 2]);

        cpm.cancel(results.continuationPoint);

        results = cpm.getNext(results.continuationPoint);
        results.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        should.not.exist(results.continuationPoint);
        should.not.exist(results.references);

    });
    it("ContinuationPointManager#hasReachMaximum", () => {

        const cpm = new ContinuationPointManager();
        cpm.hasReachMaximum(0).should.eql(false);
        cpm.hasReachMaximum(1).should.eql(false);

        const fullarray = [1, 2, 3, 4, 5, 6, 7, 8];
        const maxElements = 2;
        let results = cpm.register(maxElements, fullarray);

        cpm.hasReachMaximum(0).should.eql(false);
        cpm.hasReachMaximum(1).should.eql(true);

        cpm.cancel(results.continuationPoint);

        cpm.hasReachMaximum(0).should.eql(false);
        cpm.hasReachMaximum(1).should.eql(false);

    });

});
