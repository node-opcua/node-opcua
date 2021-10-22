import * as should from "should";
import { ReferenceDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { DataValue } from "node-opcua-data-value";
import { ContinuationPointManager } from "..";

describe("ContinuationPointManager", () => {
    it("should create a ContinuationPointManager", () => {
        const cpm = new ContinuationPointManager();
        cpm.should.be.instanceOf(ContinuationPointManager);
    });
    const toReferenceDescription = (reference: number): ReferenceDescription =>
        new ReferenceDescription({ browseName: reference.toString() }) as any;
    it("ContinuationPointManager#hasReachedMaximum", () => {
        const cpm = new ContinuationPointManager();
        cpm.hasReachedMaximum(0).should.eql(false);
        cpm.hasReachedMaximum(1).should.eql(false);

        const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription);
        const maxElements = 2;

        const results = cpm.registerReferences(maxElements, fullArray, { continuationPoint: null });
        should.exist(results.continuationPoint);

        cpm.hasReachedMaximum(0).should.eql(false);
        cpm.hasReachedMaximum(1).should.eql(true);

        cpm.getNextReferences(0, { continuationPoint: results.continuationPoint, releaseContinuationPoints: true });

        cpm.hasReachedMaximum(0).should.eql(false);
        cpm.hasReachedMaximum(1).should.eql(false);
    });

    describe("browseNext Continuation point", () => {
        it("should return the full a array and no continuation point if array length is less than maxElements", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription);
            const maxElements = 1000;
            const results = cpm.registerReferences(maxElements, fullArray, { continuationPoint: null });
            should.not.exist(results.continuationPoint);
            results.values.should.eql([1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription));
        });

        it("should return the full a array if maxElements===0", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription);
            const maxElements = 0;
            const results = cpm.registerReferences(maxElements, fullArray, { continuationPoint: null });
            should(results.continuationPoint).eql(undefined);
            results.values.should.eql([1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription));
        });

        it("should return up  maxElements if array.length is greater than maxElements", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription);
            const maxElements = 2;
            let results = cpm.registerReferences(maxElements, fullArray, { continuationPoint: null });
            should.exist(results.continuationPoint);
            results.values.should.eql([1, 2].map(toReferenceDescription));

            results = cpm.getNextReferences(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.Good);
            should.exist(results.continuationPoint);
            results.values.should.eql([3, 4].map(toReferenceDescription));

            results = cpm.getNextReferences(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.Good);
            should.exist(results.continuationPoint);
            results.values.should.eql([5, 6].map(toReferenceDescription));

            results = cpm.getNextReferences(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.Good);
            should.not.exist(results.continuationPoint);
            results.values.should.eql([7, 8].map(toReferenceDescription));

            results = cpm.getNextReferences(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });

        it("ContinuationPointManager#cancel - should be possible to cancel a continuation point to free up memory", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toReferenceDescription);
            const maxElements = 2;
            let results = cpm.registerReferences(maxElements, fullArray, { continuationPoint: null });
            should.exist(results.continuationPoint);
            results.values.should.eql([1, 2].map(toReferenceDescription));

            cpm.getNextReferences(0, { continuationPoint: results.continuationPoint, releaseContinuationPoints: true });

            results = cpm.getNextReferences(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
            should.not.exist(results.continuationPoint);
            should.not.exist(results.values);
        });
    });
    describe("readHistory Continuation Point: registerHistoryReadRaw", () => {
        const toDV = (value: number): DataValue => new DataValue({ value: { dataType: DataType.Int32, value } });
        it("should return the full array and no continuation point if array length is less than maxElements", () => {
            const cpm = new ContinuationPointManager();
            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toDV);
            const maxElements = 1000;
            const results = cpm.registerHistoryReadRaw(maxElements, fullArray, { continuationPoint: null });
            should.not.exist(results.continuationPoint);
            results.values.should.eql(fullArray);
        });

        it("should return the full a array if maxElements===0", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toDV);
            const maxElements = 0;
            const results = cpm.registerHistoryReadRaw(maxElements, fullArray, { continuationPoint: null });
            should(results.continuationPoint).eql(undefined);
            results.values.should.eql([1, 2, 3, 4, 5, 6, 7, 8].map(toDV));
        });
        it("should return up  maxElements if array.length is greater than maxElements", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toDV);
            const maxElements = 2;
            let results = cpm.registerHistoryReadRaw(maxElements, fullArray, { continuationPoint: null });
            should.exist(results.continuationPoint);
            results.values.should.eql([1, 2].map(toDV));

            results = cpm.getNextHistoryReadRaw(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.Good);
            should.exist(results.continuationPoint);
            results.values.should.eql([3, 4].map(toDV));

            results = cpm.getNextHistoryReadRaw(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.Good);
            should.exist(results.continuationPoint);
            results.values.should.eql([5, 6].map(toDV));

            results = cpm.getNextHistoryReadRaw(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.Good);
            should.not.exist(results.continuationPoint);
            results.values.should.eql([7, 8].map(toDV));

            results = cpm.getNextHistoryReadRaw(maxElements, { continuationPoint: results.continuationPoint });
            results.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });
        it("should not server continuation point that have been released", () => {
            const cpm = new ContinuationPointManager();

            const maxElements = 2;

            const results = cpm.registerHistoryReadRaw(maxElements, [1, 2, 3, 4, 5, 6, 7, 8].map(toDV), {
                continuationPoint: null,
                releaseContinuationPoints: false,
                index: 0
            });
            results.statusCode.should.eql(StatusCodes.Good);
            results.values.should.eql([1, 2].map(toDV));
            should.exist(results.continuationPoint);

            const results2 = cpm.getNextHistoryReadRaw(maxElements, {
                continuationPoint: results.continuationPoint,
                index: 0,
                releaseContinuationPoints: true // <<< RELEASING THE CONTINUATION POINT
            });
            results2.statusCode.should.eql(StatusCodes.Good);
            results2.values.should.eql([3, 4].map(toDV));
            should.not.exist(results2.continuationPoint);

            const results3 = cpm.getNextHistoryReadRaw(maxElements, {
                continuationPoint: results.continuationPoint,
                index: 0,
                releaseContinuationPoints: false
            });
            results3.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });
        it("it shall automatically free ContinuationPoints from prior requests if a new request from this Session.", () => {
            const cpm = new ContinuationPointManager();

            const fullArray = [1, 2, 3, 4, 5, 6, 7, 8].map(toDV);
            const maxElements = 2;

            const results = cpm.registerHistoryReadRaw(maxElements, [1, 2, 3, 4, 5, 6, 7, 8].map(toDV), {
                continuationPoint: null,
                releaseContinuationPoints: false,
                index: 0
            });
            results.statusCode.should.eql(StatusCodes.Good);
            results.values.should.eql([1, 2].map(toDV));
            should.exist(results.continuationPoint);

            const results1 = cpm.registerHistoryReadRaw(maxElements, [10, 20, 30, 40, 50, 60, 70, 80].map(toDV), {
                continuationPoint: null,
                releaseContinuationPoints: false,
                index: 0
            });
            results1.statusCode.should.eql(StatusCodes.Good);
            should.exist(results1.continuationPoint);

            const results2 = cpm.getNextHistoryReadRaw(maxElements, {
                continuationPoint: results.continuationPoint
            });
            results2.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
        });
    });
});
