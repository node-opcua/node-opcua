/* eslint-disable max-statements */
import * as should from "should";

import { AddressSpace, BaseNode, UAObject, UAVariable } from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { DataType } from "node-opcua-variant";

import { AggregateFunction, getInterpolatedData, installAggregateConfigurationOptions } from "..";
import { addAggregateSupport, getAggregateConfiguration } from "..";
import { getMaxData, getMinData } from "..";
import { getAverageData } from "../source/average";
import { getCountData } from "../source/count";
import { getPercentGoodData } from "../source/percent_good";
import { getPercentBadData } from "../source/percent_bad";
import { getDurationBadData } from "../source/duration_bad";
import { getDurationGoodData } from "../source/duration_good";

import { createHistorian1, createHistorian2, createHistorian3, createHistorian4 } from "./helpers/create_historizing_variables";
import { makeDate } from "./helpers/helpers";

const _should = should;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Aggregates ", () => {
    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        const namespaces: string[] = [nodesets.standard];
        await generateAddressSpace(addressSpace, namespaces);
        addressSpace.registerNamespace("MyNamespace");
    });
    afterEach(async () => {
        addressSpace.dispose();
    });

    it("should augment the addressSpace with aggregate function support", async () => {
        addAggregateSupport(addressSpace);
    });

    function extractAggregateFunction(uaVariable: UAVariable) {
        const haConfiguration = uaVariable.getChildByName("HA Configuration") as UAObject;
        if (!haConfiguration) {
            throw new Error("Cannot find HA Configuration");
        }
        haConfiguration.getComponentByName("AggregateConfiguration");
        const aggregateFunctionsFolder = haConfiguration.getComponentByName("AggregateFunctions") as UAObject;
        const functions = aggregateFunctionsFolder.findReferencesAsObject("Organizes");
        return functions;
    }
    it("should add aggregate support to a variable - form 1", async () => {
        addAggregateSupport(addressSpace);
        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "Temperature",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects.server
        });

        addressSpace.installHistoricalDataNode(uaVariable);
        installAggregateConfigurationOptions(uaVariable, {});

        const functions = extractAggregateFunction(uaVariable);

        const f = functions.map((a: BaseNode) => a.browseName.name).sort();
        f.should.eql(["Average", "Interpolative", "Maximum", "Minimum"]);
    });

    it("should add aggregate support to a variable - form 2", async () => {
        addAggregateSupport(addressSpace);
        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "Temperature",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects.server
        });

        addressSpace.installHistoricalDataNode(uaVariable);
        installAggregateConfigurationOptions(uaVariable, {}, []);

        const functions = extractAggregateFunction(uaVariable);

        const f = functions.map((a: BaseNode) => a.browseName.name).sort();
        f.should.eql([]);
    });

    it("should add aggregate support to a variable - form 3", async () => {
        addAggregateSupport(addressSpace);
        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "Temperature",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects.server
        });

        addressSpace.installHistoricalDataNode(uaVariable);
        installAggregateConfigurationOptions(uaVariable, {}, [
            AggregateFunction.Average,
            AggregateFunction.DurationGood,
            AggregateFunction.PercentGood,
            AggregateFunction.Count
        ]);

        const functions = extractAggregateFunction(uaVariable);

        const f = functions.map((a: BaseNode) => a.browseName.name).sort();
        f.should.eql(["Average", "Count", "DurationGood", "PercentGood"]);
    });
});

describe("Aggregates - Function ", () => {
    let addressSpace: AddressSpace;
    let h1: UAVariable;
    let h2: UAVariable;
    let h3: UAVariable;
    let h4: UAVariable;

    before((done: (err: Error | null) => void) => {
        addressSpace = AddressSpace.create();

        const namespaces: string[] = [nodesets.standard];
        generateAddressSpace(addressSpace, namespaces, (err?: Error) => {
            const namespace = addressSpace.registerNamespace("PRIVATENAMESPACE");
            namespace.index.should.eql(1);
            should.exist(addressSpace.getOwnNamespace());

            addAggregateSupport(addressSpace);

            h1 = createHistorian1(addressSpace);
            h2 = createHistorian2(addressSpace);
            h3 = createHistorian3(addressSpace);
            h4 = createHistorian4(addressSpace);

            done(err!);
        });
    });
    after((done) => {
        addressSpace.dispose();
        done();
    });

    function n(num: number): string {
        const s1 = num.toString();
        const s2 = num.toFixed(3);
        return s1.length <= s2.length ? s1 : s2;
    }

    function getInfo(dataValue: DataValue): string {
        const d = dataValue.sourceTimestamp!;
        const s = d.toISOString().split("T")[1];

        const v =
            dataValue.value && dataValue.value.value !== undefined && dataValue.value.value !== null
                ? n(dataValue.value.value) + " "
                : "";

        const retVal = s + " " + v + dataValue.statusCode.toString().split(" ")[0];
        // console.log(retVal);
        return retVal;
    }
    function getValue(dataValue: DataValue, dataType: DataType): number | DataType.Null {
        if (dataValue.value.dataType !== dataType) {
            throw new Error("Wrong value dataType");
        }
        if (dataValue.value.dataType === DataType.Null) {
            return DataType.Null;
        }
        return dataValue.value.value;
    }

    it("Aggregate Interpolate with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getInterpolatedData(h1, 5000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;

            // Timestamp Value StatusCode Notes
            // 12:00:00.000 BadNoData
            getInfo(dataValues[0]).should.eql("12:00:00.000Z BadNoData");
            // 12:00:05.000 BadNoData
            getInfo(dataValues[1]).should.eql("12:00:05.000Z BadNoData");
            // 12:00:10.000 10 Good
            getInfo(dataValues[2]).should.eql("12:00:10.000Z 10 Good");
            // 12:00:15.000 15 Good, Interpolated
            getInfo(dataValues[3]).should.eql("12:00:15.000Z 15 Good#HistorianInterpolated");
            // 12:00:20.000 20 Good
            getInfo(dataValues[4]).should.eql("12:00:20.000Z 20 Good");
            // 12:00:25.000 25 Good, Interpolated
            getInfo(dataValues[5]).should.eql("12:00:25.000Z 25 Good#HistorianInterpolated");
            // 12:00:30.000 30 Good
            getInfo(dataValues[6]).should.eql("12:00:30.000Z 30 Good");
            // 12:00:35.000 35 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[7]).should.eql("12:00:35.000Z 35 UncertainDataSubNormal#HistorianInterpolated");
            // 12:00:40.000 40 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[8]).should.eql("12:00:40.000Z 40 UncertainDataSubNormal#HistorianInterpolated");
            // 12:00:45.000 45 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[9]).should.eql("12:00:45.000Z 45 UncertainDataSubNormal#HistorianInterpolated");
            // 12:00:50.000 50 Good
            getInfo(dataValues[10]).should.eql("12:00:50.000Z 50 Good");
            // 12:00:55.000 55 Good, Interpolated
            getInfo(dataValues[11]).should.eql("12:00:55.000Z 55 Good#HistorianInterpolated");
            // 12:01:00.000 60 Good
            getInfo(dataValues[12]).should.eql("12:01:00.000Z 60 Good");
            // 12:01:05.000 65 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[13]).should.eql("12:01:05.000Z 65 UncertainDataSubNormal#HistorianInterpolated");
            // 12:01:10.000 70 Uncertain
            getInfo(dataValues[14]).should.eql("12:01:10.000Z 70 Uncertain");
            // 12:01:15.000 75 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[15]).should.eql("12:01:15.000Z 75 UncertainDataSubNormal#HistorianInterpolated");
            // 12:01:20.000 80 Good
            getInfo(dataValues[16]).should.eql("12:01:20.000Z 80 Good");
            // 12:01:25.000 85 Good, Interpolated
            getInfo(dataValues[17]).should.eql("12:01:25.000Z 85 Good#HistorianInterpolated");
            // 12:01:30.000 90 Good
            getInfo(dataValues[18]).should.eql("12:01:30.000Z 90 Good");
            // 12:01:35.000 90 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[19]).should.eql("12:01:35.000Z 90 UncertainDataSubNormal#HistorianInterpolated");
            done();
        });
    });

    it("Aggregate Interpolate with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getInterpolatedData(h2, 5000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;

            // Timestamp Value StatusCode Notes
            // 12:00:00.000 BadNoData
            getInfo(dataValues[0]).should.eql("12:00:00.000Z BadNoData");
            // 12:00:05.000 11.304 Good, Interpolated
            getInfo(dataValues[1]).should.eql("12:00:05.000Z 11.304 Good#HistorianInterpolated");
            // 12:00:10.000 13.478 Good, Interpolated
            getInfo(dataValues[2]).should.eql("12:00:10.000Z 13.478 Good#HistorianInterpolated");
            // 12:00:15.000 15.652 Good, Interpolated
            getInfo(dataValues[3]).should.eql("12:00:15.000Z 15.652 Good#HistorianInterpolated");
            // 12:00:20.000 17.826 Good, Interpolated
            getInfo(dataValues[4]).should.eql("12:00:20.000Z 17.826 Good#HistorianInterpolated");
            // 12:00:25.000 20 Good
            getInfo(dataValues[5]).should.eql("12:00:25.000Z 20 Good");
            // 12:00:30.000 25.909 Good, Interpolated
            getInfo(dataValues[6]).should.eql("12:00:30.000Z 25.909 Good#HistorianInterpolated");
            // 12:00:35.000 28.182 Good, Interpolated
            getInfo(dataValues[7]).should.eql("12:00:35.000Z 28.182 Good#HistorianInterpolated");
            // 12:00:40.000 31.111 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[8]).should.eql("12:00:40.000Z 31.111 UncertainDataSubNormal#HistorianInterpolated");
            // 12:00:45.000 36.667 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[9]).should.eql("12:00:45.000Z 36.667 UncertainDataSubNormal#HistorianInterpolated");
            // 12:00:50.000 45 Good, Interpolated
            getInfo(dataValues[10]).should.eql("12:00:50.000Z 45 Good#HistorianInterpolated");
            // 12:00:55.000 51.500 Good, Interpolated
            getInfo(dataValues[11]).should.eql("12:00:55.000Z 51.5 Good#HistorianInterpolated");
            // 12:01:00.000 54 Good, Interpolated
            getInfo(dataValues[12]).should.eql("12:01:00.000Z 54 Good#HistorianInterpolated");
            // 12:01:05.000 56.500 Good, Interpolated
            getInfo(dataValues[13]).should.eql("12:01:05.000Z 56.5 Good#HistorianInterpolated");
            // 12:01:10.000 59 Good, Interpolated
            getInfo(dataValues[14]).should.eql("12:01:10.000Z 59 Good#HistorianInterpolated");
            // 12:01:15.000 62.727 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[15]).should.eql("12:01:15.000Z 62.727 UncertainDataSubNormal#HistorianInterpolated");
            // 12:01:20.000 67.273 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[16]).should.eql("12:01:20.000Z 67.273 UncertainDataSubNormal#HistorianInterpolated");
            // 12:01:25.000 76.667 Good, Interpolated
            getInfo(dataValues[17]).should.eql("12:01:25.000Z 76.667 Good#HistorianInterpolated");
            // 12:01:30.000 90 Good
            getInfo(dataValues[18]).should.eql("12:01:30.000Z 90 Good");
            // 12:01:35.000 90 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[19]).should.eql("12:01:35.000Z 90 UncertainDataSubNormal#HistorianInterpolated");
            done();
        });
    });

    it("Aggregate Interpolate with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        const configuration = getAggregateConfiguration(h3);

        configuration.treatUncertainAsBad!.should.eql(true);
        configuration.stepped!.should.eql(true);
        configuration.useSlopedExtrapolation!.should.eql(false);
        // xx configuration.percentDataBad.should.eql(50);
        // xx configuration.percentDataGood.should.eql(50);

        getInterpolatedData(h3, 5000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;

            // Timestamp Value StatusCode Notes
            // 12:00:00.000 BadNoData
            // 12:00:00.000 BadNoData
            getInfo(dataValues[0]).should.eql("12:00:00.000Z BadNoData");
            // 12:00:05.000 10 Good, Interpolated
            getInfo(dataValues[1]).should.eql("12:00:05.000Z 10 Good#HistorianInterpolated");
            // 12:00:10.000 10 Good, Interpolated
            getInfo(dataValues[2]).should.eql("12:00:10.000Z 10 Good#HistorianInterpolated");
            // 12:00:15.000 10 Good, Interpolated
            getInfo(dataValues[3]).should.eql("12:00:15.000Z 10 Good#HistorianInterpolated");
            // 12:00:20.000 10 Good, Interpolated
            getInfo(dataValues[4]).should.eql("12:00:20.000Z 10 Good#HistorianInterpolated");
            // 12:00:25.000 20 Good
            getInfo(dataValues[5]).should.eql("12:00:25.000Z 20 Good");
            // 12:00:30.000 25 Good, Interpolated
            getInfo(dataValues[6]).should.eql("12:00:30.000Z 25 Good#HistorianInterpolated");
            // 12:00:35.000 25 Good, Interpolated
            getInfo(dataValues[7]).should.eql("12:00:35.000Z 25 Good#HistorianInterpolated");
            // 12:00:40.000 30 Good, Interpolated
            getInfo(dataValues[8]).should.eql("12:00:40.000Z 30 Good#HistorianInterpolated");
            // 12:00:45.000 30 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[9]).should.eql("12:00:45.000Z 30 UncertainDataSubNormal#HistorianInterpolated");
            // 12:00:50.000 40 Good, Interpolated
            getInfo(dataValues[10]).should.eql("12:00:50.000Z 40 Good#HistorianInterpolated");
            // 12:00:55.000 50 Good, Interpolated
            getInfo(dataValues[11]).should.eql("12:00:55.000Z 50 Good#HistorianInterpolated");
            // 12:01:00.000 50 Good, Interpolated
            getInfo(dataValues[12]).should.eql("12:01:00.000Z 50 Good#HistorianInterpolated");
            // 12:01:05.000 50 Good, Interpolated
            getInfo(dataValues[13]).should.eql("12:01:05.000Z 50 Good#HistorianInterpolated");
            // 12:01:10.000 50 Good, Interpolated
            getInfo(dataValues[14]).should.eql("12:01:10.000Z 50 Good#HistorianInterpolated");
            // 12:01:15.000 60 Good, Interpolated
            getInfo(dataValues[15]).should.eql("12:01:15.000Z 60 Good#HistorianInterpolated");
            // 12:01:20.000 60 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[16]).should.eql("12:01:20.000Z 60 UncertainDataSubNormal#HistorianInterpolated");
            // 12:01:25.000 70 Good, Interpolated
            getInfo(dataValues[17]).should.eql("12:01:25.000Z 70 Good#HistorianInterpolated");
            // 12:01:30.000 90 Good
            getInfo(dataValues[18]).should.eql("12:01:30.000Z 90 Good");
            // 12:01:35.000 90 UncertainDataSubNormal, Interpolated
            getInfo(dataValues[19]).should.eql("12:01:35.000Z 90 UncertainDataSubNormal#HistorianInterpolated");

            done();
        });
    });

    it("Aggregate Min with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getMinData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;

            // Timestamp Value StatusCode Notes
            // 12:00:00.000 10 Good, Calculated, Partial
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated|HistorianPartial");
            // 12:00:16.000 20 Good, Calculated
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 20 Good#HistorianCalculated");
            // 12:00:32.000 BadNoData
            getInfo(dataValues[2]).should.eql("12:00:32.000Z BadNoData");
            // 12:00:48.000 50 Good, Calculated
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 50 Good#HistorianCalculated");
            // 12:01:04.000 BadNoData
            getInfo(dataValues[4]).should.eql("12:01:04.000Z BadNoData");
            // 12:01:20.000 80 Good, Partial
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 80 Good#HistorianPartial");
            // 12:01:36.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");
            done();
        });
    });
    it("Aggregate Min with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getMinData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            // 12:00:00.000 10 Good, Calculated, Partial
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated|HistorianPartial");
            // 12:00:16.000 20 Good, Calculated
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 20 Good#HistorianCalculated");
            // 12:00:32.000 30 UncertainDataSubNormal, Calculated
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 30 UncertainDataSubNormal#HistorianCalculated");
            // 12:00:48.000 40 Good
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 40 Good");
            // 12:01:04.000 60 UncertainDataSubNormal, Calculated
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 60 UncertainDataSubNormal#HistorianCalculated");
            // 12:01:20.000 70 Good, Calculated, Partial
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 70 Good#HistorianCalculated|HistorianPartial");
            // 12:01:36.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");
            done();
        });
    });
    it("Aggregate Min with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getMinData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            // 12:00:00.000 10 Good, Calculated, Partial
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated|HistorianPartial");
            // 12:00:16.000 20 Good, Calculated
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 20 Good#HistorianCalculated");
            // 12:00:32.000 30 UncertainDataSubNormal, Calculated
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 30 UncertainDataSubNormal#HistorianCalculated");
            // 12:00:48.000 40 Good
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 40 Good");
            // 12:01:04.000 60 UncertainDataSubNormal, Calculated
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 60 UncertainDataSubNormal#HistorianCalculated");
            // 12:01:20.000 70 Good, Calculated, Partial
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 70 Good#HistorianCalculated|HistorianPartial");
            // 12:01:36.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");
            done();
        });
    });

    it("Aggregate Max with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getMaxData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;

            // Timestamp Value StatusCode Notes
            // 12:00:00.000 10 Good, Calculated, Partial
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated|HistorianPartial");
            // 12:00:16.000 30 Good, Calculated
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 30 Good#HistorianCalculated");
            // 12:00:32.000 BadNoData
            getInfo(dataValues[2]).should.eql("12:00:32.000Z BadNoData");
            // 12:00:48.000 60 Good, Calculated
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 60 Good#HistorianCalculated");
            // 12:01:04.000 BadNoData
            getInfo(dataValues[4]).should.eql("12:01:04.000Z BadNoData");
            // 12:01:20.000 90 Good, Calculated, Partial
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 90 Good#HistorianPartial");
            // 12:01:36.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate Max with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getMaxData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;

            // 12:00:00.000 10 Good, Calculated, Partial
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated|HistorianPartial");
            // 12:00:16.000 25 Good, Calculated
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 25 Good#HistorianCalculated");
            // 12:00:32.000 30 UncertainDataSubNormal, Calculated
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 30 UncertainDataSubNormal#HistorianCalculated");
            // 12:00:48.000 50 Good, Calculated
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 50 Good");
            // 12:01:04.000 60 UncertainDataSubNormal, Calculated
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 60 UncertainDataSubNormal#HistorianCalculated");
            // 12:01:20.000 90 Good, Calculated, Partial
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 90 Good#HistorianCalculated|HistorianPartial");
            // 12:01:36.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate Max with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getMaxData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            // 12:00:00.000 10 Good, Calculated, Partial
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated|HistorianPartial");
            // 12:00:16.000 25 Good, Calculated
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 25 Good#HistorianCalculated");
            // 12:00:32.000 30 UncertainDataSubNormal, Calculated
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 30 UncertainDataSubNormal#HistorianCalculated");
            // 12:00:48.000 50 Good, Calculated
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 50 Good");
            // 12:01:04.000 60 UncertainDataSubNormal, Calculated
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 60 UncertainDataSubNormal#HistorianCalculated");
            // 12:01:20.000 90 Good, Calculated, Partial
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 90 Good#HistorianCalculated|HistorianPartial");
            // 12:01:36.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");
            done();
        });
    });

    it("Aggregate Average with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getAverageData(h1, 5 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            // 12:00:00.000 BadNoData
            getInfo(dataValues[0]).should.eql("12:00:00.000Z BadNoData");
            // 12:00:05.000 BadNoData
            getInfo(dataValues[1]).should.eql("12:00:05.000Z BadNoData");
            //  12:00:10.000 10 Good, Calculated
            getInfo(dataValues[2]).should.eql("12:00:10.000Z 10 Good#HistorianCalculated");
            // 12:00:15.000 BadNoData
            getInfo(dataValues[3]).should.eql("12:00:15.000Z BadNoData");
            // 12:00:20.000 20 Good, Calculated
            getInfo(dataValues[4]).should.eql("12:00:20.000Z 20 Good#HistorianCalculated");
            // 12:00:25.000 BadNoData
            getInfo(dataValues[5]).should.eql("12:00:25.000Z BadNoData");
            // 12:00:30.000 30 Good, Calculated
            getInfo(dataValues[6]).should.eql("12:00:30.000Z 30 Good#HistorianCalculated");
            // 12:00:35.000 BadNoData
            getInfo(dataValues[7]).should.eql("12:00:35.000Z BadNoData");
            // 12:00:40.000 BadNoData
            getInfo(dataValues[8]).should.eql("12:00:40.000Z BadNoData");
            // 12:00:45.000 BadNoData
            getInfo(dataValues[9]).should.eql("12:00:45.000Z BadNoData");
            // 12:00:50.000 50 Good, Calculated
            getInfo(dataValues[10]).should.eql("12:00:50.000Z 50 Good#HistorianCalculated");
            // 12:00:55.000 BadNoData
            getInfo(dataValues[11]).should.eql("12:00:55.000Z BadNoData");
            // 12:01:00.000 60 Good, Calculated
            getInfo(dataValues[12]).should.eql("12:01:00.000Z 60 Good#HistorianCalculated");
            // 12:01:05.000 BadNoData
            getInfo(dataValues[13]).should.eql("12:01:05.000Z BadNoData");
            // 12:01:10.000 BadNoData
            getInfo(dataValues[14]).should.eql("12:01:10.000Z BadNoData");
            // 12:01:15.000 BadNoData
            getInfo(dataValues[15]).should.eql("12:01:15.000Z BadNoData");
            // 12:01:20.000 80 Good, Calculated
            getInfo(dataValues[16]).should.eql("12:01:20.000Z 80 Good#HistorianCalculated");
            // 12:01:25.000 BadNoData
            getInfo(dataValues[17]).should.eql("12:01:25.000Z BadNoData");
            // 12:01:30.000 90 Good, Calculated
            getInfo(dataValues[18]).should.eql("12:01:30.000Z 90 Good#HistorianCalculated");
            // 12:01:35.000 BadNoData
            getInfo(dataValues[19]).should.eql("12:01:35.000Z BadNoData");

            done();
        });
    });
    it("Aggregate Average with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getAverageData(h2, 5 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            // 12:00:00.000 10 Good, Calculated
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated");
            // 12:00:05.000 BadNoData
            getInfo(dataValues[1]).should.eql("12:00:05.000Z BadNoData");
            // 12:00:10.000 BadNoData
            getInfo(dataValues[2]).should.eql("12:00:10.000Z BadNoData");
            // 12:00:15.000 BadNoData
            getInfo(dataValues[3]).should.eql("12:00:15.000Z BadNoData");
            // 12:00:20.000 BadNoData
            getInfo(dataValues[4]).should.eql("12:00:20.000Z BadNoData");
            // 12:00:25.000 22.500 Good, Calculated
            getInfo(dataValues[5]).should.eql("12:00:25.000Z 22.5 Good#HistorianCalculated");
            // 12:00:30.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:00:30.000Z BadNoData");
            // 12:00:35.000 30 Good, Calculated
            getInfo(dataValues[7]).should.eql("12:00:35.000Z 30 Good#HistorianCalculated");
            // 12:00:40.000 BadNoData
            getInfo(dataValues[8]).should.eql("12:00:40.000Z BadNoData");
            // 12:00:45.000 40 Good, Calculated
            getInfo(dataValues[9]).should.eql("12:00:45.000Z 40 Good#HistorianCalculated");
            // 12:00:50.000 50 Good, Calculated
            getInfo(dataValues[10]).should.eql("12:00:50.000Z 50 Good#HistorianCalculated");
            // 12:00:55.000 BadNoData
            getInfo(dataValues[11]).should.eql("12:00:55.000Z BadNoData");
            // 12:01:00.000 BadNoData
            getInfo(dataValues[12]).should.eql("12:01:00.000Z BadNoData");
            // 12:01:05.000 BadNoData
            getInfo(dataValues[13]).should.eql("12:01:05.000Z BadNoData");
            // 12:01:10.000 60 Good, Calculated
            getInfo(dataValues[14]).should.eql("12:01:10.000Z 60 Good#HistorianCalculated");
            // 12:01:15.000 BadNoData
            getInfo(dataValues[15]).should.eql("12:01:15.000Z BadNoData");
            // 12:01:20.000 70 Good, Calculated
            getInfo(dataValues[16]).should.eql("12:01:20.000Z 70 Good#HistorianCalculated");
            // 12:01:25.000 80 Good, Calculated
            getInfo(dataValues[17]).should.eql("12:01:25.000Z 80 Good#HistorianCalculated");
            // 12:01:30.000 90 Good, Calculated
            getInfo(dataValues[18]).should.eql("12:01:30.000Z 90 Good#HistorianCalculated");
            // 12:01:35.000 BadNoData
            getInfo(dataValues[19]).should.eql("12:01:35.000Z BadNoData");
            done();
        });
    });
    it("Aggregate Average with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getAverageData(h3, 5 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            // 12:00:00.000 10 Good, Calculated
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10 Good#HistorianCalculated");
            // 12:00:05.000 BadNoData
            getInfo(dataValues[1]).should.eql("12:00:05.000Z BadNoData");
            // 12:00:10.000 BadNoData
            getInfo(dataValues[2]).should.eql("12:00:10.000Z BadNoData");
            // 12:00:15.000 BadNoData
            getInfo(dataValues[3]).should.eql("12:00:15.000Z BadNoData");
            // 12:00:20.000 BadNoData
            getInfo(dataValues[4]).should.eql("12:00:20.000Z BadNoData");
            // 12:00:25.000 22.500 Good, Calculated
            getInfo(dataValues[5]).should.eql("12:00:25.000Z 22.5 Good#HistorianCalculated");
            // 12:00:30.000 BadNoData
            getInfo(dataValues[6]).should.eql("12:00:30.000Z BadNoData");
            // 12:00:35.000 30 Good, Calculated
            getInfo(dataValues[7]).should.eql("12:00:35.000Z 30 Good#HistorianCalculated");
            // 12:00:40.000 BadNoData
            getInfo(dataValues[8]).should.eql("12:00:40.000Z BadNoData");
            // 12:00:45.000 40 Good, Calculated
            getInfo(dataValues[9]).should.eql("12:00:45.000Z 40 Good#HistorianCalculated");
            // 12:00:50.000 50 Good, Calculated
            getInfo(dataValues[10]).should.eql("12:00:50.000Z 50 Good#HistorianCalculated");
            // 12:00:55.000 BadNoData
            getInfo(dataValues[11]).should.eql("12:00:55.000Z BadNoData");
            // 12:01:00.000 BadNoData
            getInfo(dataValues[12]).should.eql("12:01:00.000Z BadNoData");
            // 12:01:05.000 BadNoData
            getInfo(dataValues[13]).should.eql("12:01:05.000Z BadNoData");
            // 12:01:10.000 60 Good, Calculated
            getInfo(dataValues[14]).should.eql("12:01:10.000Z 60 Good#HistorianCalculated");
            // 12:01:15.000 BadNoData
            getInfo(dataValues[15]).should.eql("12:01:15.000Z BadNoData");
            // 12:01:20.000 70 Good, Calculated
            getInfo(dataValues[16]).should.eql("12:01:20.000Z 70 Good#HistorianCalculated");
            // 12:01:25.000 80 Good, Calculated
            getInfo(dataValues[17]).should.eql("12:01:25.000Z 80 Good#HistorianCalculated");
            // 12:01:30.000 90 Good, Calculated
            getInfo(dataValues[18]).should.eql("12:01:30.000Z 90 Good#HistorianCalculated");
            // 12:01:35.000 BadNoData
            getInfo(dataValues[19]).should.eql("12:01:35.000Z BadNoData");
            done();
        });
    });

    it("Aggregate Count with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getCountData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 1 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 2 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z Bad");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 2 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 0 UncertainDataSubNormal#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 2 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate Count with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getCountData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 1 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 2 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 1 UncertainDataSubNormal#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 2 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 1 UncertainDataSubNormal#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 3 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate Count with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getCountData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 1 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 2 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z Bad");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 2 Good#HistorianCalculated");
            // Not OK with this one !getInfo(dataValues[4]).should.eql("12:01:04.000Z 1 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 3 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate PercentGood with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentGoodData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 37.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z Bad");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 87.5 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 100 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate PercentGood with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentGoodData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 87.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 62.5 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 81.25 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 70.003 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate PercentGood with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentGoodData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 87.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 62.5 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 81.25 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 70.003 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate PercentGood with History4 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentGoodData(h4, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 87.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 62.5 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 100 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 81.25 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 70.003 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate PercentBad with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentBadData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 62.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 50 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 12.5 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 0 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate PercentBad with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentBadData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 12.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 37.5 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 18.75 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 29.997 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate PercentBad with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentBadData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 12.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 37.5 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 18.75 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 29.997 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate PercentBad with History4 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getPercentBadData(h4, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 12.5 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 37.5 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 18.75 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 29.997 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate DurationBad with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationBadData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 10000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 8000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 2000 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 0 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate DurationBad with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationBadData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 2000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 6000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 3000 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 3000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate DurationBad with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationBadData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 2000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 6000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 3000 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 3000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate DurationBad with History4 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationBadData(h4, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 2000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 6000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 3000 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 3000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    //
    it("Aggregate DurationGood with History1 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationGoodData(h1, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 6000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 14000 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 0 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 10001 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });

    it("Aggregate DurationGood with History2 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationGoodData(h2, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 14000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 10000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 13000 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 7001 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate DurationGood with History3 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationGoodData(h3, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 14000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 10000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 13000 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 7001 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
    it("Aggregate DurationGood with History4 use case", (done) => {
        const startDate = makeDate("12:00:00");
        const endDate = makeDate("12:01:40");

        getDurationGoodData(h4, 16 * 1000, startDate, endDate, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return done(err);
            }
            dataValues = dataValues!;
            getInfo(dataValues[0]).should.eql("12:00:00.000Z 14000 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[1]).should.eql("12:00:16.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[2]).should.eql("12:00:32.000Z 10000 Good#HistorianCalculated");
            getInfo(dataValues[3]).should.eql("12:00:48.000Z 16000 Good#HistorianCalculated");
            getInfo(dataValues[4]).should.eql("12:01:04.000Z 13000 Good#HistorianCalculated");
            getInfo(dataValues[5]).should.eql("12:01:20.000Z 7001 Good#HistorianCalculated|HistorianPartial");
            getInfo(dataValues[6]).should.eql("12:01:36.000Z BadNoData");

            done();
        });
    });
});

// bounding values
// values at the startTime and endTime needed for Aggregates to compute the result
//
// Note 1 to entry: If Raw data does not exist at the startTime and endTime a value shall be estimated. There are
// two ways to determine Bounding Values for an interval. One way (called Interpolated Bounding Values) uses the
// first non-Bad data points found before and after the timestamp to estimate the bound. The other (called Simple
// Bounding Values) uses the data points immediately before and after the boundary timestamps to estimate the
// bound even if these points are Bad. Subclauses 3.1.8 and 3.1.9 describe the two different approaches in more
// detail.
// In all cases the TreatUncertainAsBad (see 4.2.1.2) flag is used to determine whether Uncertain values are Bad or
// non-Bad.
// If a Raw value was not found and a non-Bad bounding value exists the Aggregate Bits (see 5.3.3) are set to
// ‘Interpolated’
// When calculating bounding values, the value portion of Raw data that has Bad status is set to null. This means the
// value portion is not used in any calculation and a null is returned if the raw value is returned.
// The status portion is determined by the rules specified by the bound or Aggregate.
// The Interpolated Bounding Values approach (see 3.1.8) is the same as what is used in Classic OPC Historical Data
// Access (HDA) and is important for applications such as advanced process control where having useful value s at all
// times is important. The Simple Bounding Values approach (see 3.1.9) is new in this standard and is important for
// applications which shall produce regulatory reports and cannot use estimated values in place of Bad data.
//

// const RegionColor = {Red: "Red", Orane: "Orange", Green: "Green"};
// class Region {
//
//     constructor(options) {
//         this.parentInterval = options.parentInterval;
//         this.dataValue1 = options.dataValue1;
//         this.dataValue2 = options.dataValue2;
//
//     }
//     public isUncertain() {
//         // A region is Uncertain if a region ends in a Bad or Uncertain value and SlopedInterpolation is
//         // used. The end point has no effect on the region if SteppedInterpolation is used.
//
//     }
//     public duration() {
//         // duration of the region within it's parent interval
//     }
// }
