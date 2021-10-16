import * as should from "should";

import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";

import { getInterval, interpolatedValue } from "..";

import { makeDataValue, makeDate } from "./helpers/helpers";

const _should = should;

describe("Aggregates Intervals & Regions", () => {
    const dataValues: DataValue[] = [];
    const oneSeconds = 1000;
    const tenSeconds = 10 * oneSeconds;

    before(() => {
        dataValues.push(makeDataValue("12:00:05", 10, StatusCodes.Good));
        dataValues.push(makeDataValue("12:00:15", 20, StatusCodes.Good));
        dataValues.push(makeDataValue("12:00:25", 30, StatusCodes.Good));
        dataValues.push(makeDataValue("12:00:35", 31, StatusCodes.UncertainSubstituteValue));
        dataValues.push(makeDataValue("12:00:45", 50, StatusCodes.Good));
        dataValues.push(makeDataValue("12:00:55", null, StatusCodes.Bad));
        dataValues.push(makeDataValue("12:01:05", 70, StatusCodes.Good));
    });

    describe("Stepped = false", () => {
        const options = {
            stepped: false,
            treadUncertainAsBad: false
        };

        it("should find interval below start of data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("11:10:00"), tenSeconds, indexHint, dataValues);
            interval.getPercentBad().should.eql(100);
            interval.hasRawDataAsStart().should.eql(false);

            interval.index.should.eql(0);
            interval.startTime.should.eql(makeDate("11:10:00"));
            interpolatedValue(interval, options).statusCode.should.eql(StatusCodes.BadNoData);
        });
        it("should find interval starting at raw data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:05"), tenSeconds, indexHint, dataValues);
            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(0);
            interval.startTime.should.eql(makeDate("12:00:05"));
            interval.hasRawDataAsStart().should.eql(true);

            interpolatedValue(interval, options).statusCode.should.eql(StatusCodes.Good);
            interpolatedValue(interval, options).value.value.should.eql(10);
        });
        it("should find interval starting with interpolated data - case 1", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:10"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(1);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:10"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(15);
        });
        it("should find interval starting with interpolated data - case 2", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:06"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(1);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:06"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(11);
        });
        it("should find interval starting with uncertain raw data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:35"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(3);
            interval.hasRawDataAsStart().should.eql(true);

            interval.startTime.should.eql(makeDate("12:00:35"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("UncertainSubstituteValue (0x40910000)");
            interpolated.value.value.should.eql(31);
        });
        it("should find interval having a single uncertain raw data inside - ", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:34"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(3);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:34"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(30.900000000000002);
        });
        it("should find interval starting with bad raw data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:55"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(5);
            interval.hasRawDataAsStart().should.eql(true);

            interval.startTime.should.eql(makeDate("12:00:55"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(60);
        });
        it("should find interval having a single bad raw data inside - ", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:54"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(5);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:54"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(59);
        });
        it("should find interval with no data in it", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:06"), oneSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(1);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:06"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(11);
        });
        it("should extrapolate if interval is beyond end data - useSlopedExtrapolation = true", () => {
            const options2 = {
                useSlopedExtrapolation: true
            };

            const indexHint = 0;
            const interval = getInterval(makeDate("12:01:10"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(-1, "-1 is when we exceed end data");
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:01:10"));

            const interpolated = interpolatedValue(interval, options2);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(75);
        });
        it("should extrapolate if interval is beyond end data - useSlopedExtrapolation = false", () => {
            const options2 = {
                useSlopedExtrapolation: false
            };

            const indexHint = 0;
            const interval = getInterval(makeDate("12:01:10"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(-1, "-1 is when we exceed end data");
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:01:10"));

            const interpolated = interpolatedValue(interval, options2);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(70);
        });
    });

    describe("Stepped = true", () => {
        const options = {
            stepped: true,
            treadUncertainAsBad: false
        };

        it("should find interval below start of data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("11:10:00"), tenSeconds, indexHint, dataValues);
            interval.getPercentBad().should.eql(100);
            interval.hasRawDataAsStart().should.eql(false);

            interval.index.should.eql(0);
            interval.startTime.should.eql(makeDate("11:10:00"));
            interpolatedValue(interval, options).statusCode.should.eql(StatusCodes.BadNoData);
        });
        it("should find interval starting at raw data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:05"), tenSeconds, indexHint, dataValues);
            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(0);
            interval.startTime.should.eql(makeDate("12:00:05"));
            interval.hasRawDataAsStart().should.eql(true);

            interpolatedValue(interval, options).statusCode.should.eql(StatusCodes.Good);
            interpolatedValue(interval, options).value.value.should.eql(10);
        });
        it("should find interval starting with interpolated data - case 1", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:10"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(1);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:10"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(10);
        });
        it("should find interval starting with interpolated data - case 2", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:06"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(1);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:06"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(10);
        });
        it("should find interval starting with uncertain raw data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:35"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(3);
            interval.hasRawDataAsStart().should.eql(true);

            interval.startTime.should.eql(makeDate("12:00:35"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("UncertainSubstituteValue (0x40910000)");
            interpolated.value.value.should.eql(31);
        });
        it("should find interval having a single uncertain raw data inside - ", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:34"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(3);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:34"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(30);
        });
        it("should find interval starting with bad raw data", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:55"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(5);
            interval.hasRawDataAsStart().should.eql(true);

            interval.startTime.should.eql(makeDate("12:00:55"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(50);
        });
        it("should find interval having a single bad raw data inside - ", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:54"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(5);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:54"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(50);
        });
        it("should find interval with no data in it", () => {
            const indexHint = 0;
            const interval = getInterval(makeDate("12:00:06"), oneSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(1);
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:00:06"));

            const interpolated = interpolatedValue(interval, options);

            interpolated.statusCode.toString().should.eql("Good#HistorianInterpolated (0x00002)");
            interpolated.value.value.should.eql(10);
        });
        it("should extrapolate if interval is beyond end data - useSlopedExtrapolation = true", () => {
            const options2 = {
                useSlopedExtrapolation: true
            };

            const indexHint = 0;
            const interval = getInterval(makeDate("12:01:10"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(-1, "-1 is when we exceed end data");
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:01:10"));

            const interpolated = interpolatedValue(interval, options2);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(75);
        });
        it("should extrapolate if interval is beyond end data - useSlopedExtrapolation = false", () => {
            const options2 = {
                useSlopedExtrapolation: false
            };

            const indexHint = 0;
            const interval = getInterval(makeDate("12:01:10"), tenSeconds, indexHint, dataValues);

            interval.getPercentBad().should.eql(100);
            interval.index.should.eql(-1, "-1 is when we exceed end data");
            interval.hasRawDataAsStart().should.eql(false);

            interval.startTime.should.eql(makeDate("12:01:10"));

            const interpolated = interpolatedValue(interval, options2);

            interpolated.statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
            interpolated.value.value.should.eql(70);
        });
    });
});
