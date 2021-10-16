import { AddressSpace, IHistoricalDataNodeOptions, UAVariable } from "node-opcua-address-space";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { AggregateConfigurationOptions, AggregateConfigurationOptionsEx, installAggregateConfigurationOptions } from "../..";
import { makeDataValue } from "./helpers";

function addHistory(node: UAVariable, time: string, value: number | boolean | null, statusCode: StatusCode): void {
    (node as any)._historyPush(makeDataValue(time, value, statusCode));
}

/// Example 1 : Example Aggregate data – Historian 1
//  For the purposes of Historian 1 examples consider a source historian with the following data:
//
// Timestamp Value StatusCode Notes
// 12:00:00 - BadNoData First archive entry, Point created
// 12:00:10 10 Raw, Good
// 12:00:20 20 Raw, Good
// 12:00:30 30 Raw, Good
// 12:00:40 40 Raw, Bad         ANNOTATION: Operator 1
//                                          Jan-02-2012 8:00:00 Scan failed, Bad data entered
//                              ANNOTATION:
//                                          Jan-04-2012 7:10:00 Value cannot be verified
// 12:00:50 50 Raw, Good        ANNOTATION: Engineer1
//                                          Jan-04-2012 7:00:00 Scanner fixed
// 12:01:00 60 Raw, Good
// 12:01:10 70 Raw, Uncertain   ANNOTATION: Technician_1
//                                          Jan-02-2012 8:00:00 Value flagged as questionable
// 12:01:20 80 Raw, Good
// 12:01:30 90 Raw, Good
//             null No Data No more entries, awaiting next scan
// The example historian also has Annotations associated with three data point
//
// 1) TreatUncertainAsBad = False.    Therefore Uncertain values are included in Aggregate calls.
// 2) Stepped Attribute = False.      Therefore SlopedInterpolation is used between
//                                    data points.
// 3) UseSlopedExtrapolation = False. Therefore SteppedExtrapolation is used at end
//                                    boundary conditions.
// 4) PercentBad = 100, PercentGood = 100. Therefore if all values are Good then the
// quality will be Good, or if all values are Bad then the quality will be Bad, but if there is
// some Good and some Bad then the quality will be Uncertain
//
// ----------------------------------------------------------------------------

export function createHistorian1(addressSpace: AddressSpace): UAVariable {
    const node = addressSpace.getOwnNamespace().addVariable({
        browseName: "History1",
        dataType: "Float"
    });

    const options: AggregateConfigurationOptionsEx & IHistoricalDataNodeOptions = {
        historian: undefined,
        percentDataBad: 100,
        percentDataGood: 100, // Therefore if all values are Good then the
        // quality will be Good, or if all values are Bad then the quality will be Bad, but if there is
        // some Good and some Bad then the quality will be Uncertain
        stepped: false, // Therefore SlopedInterpolation is used between data points.
        treatUncertainAsBad: false, // Therefore Uncertain values are included in Aggregate calls.
        useSlopedExtrapolation: false // Therefore SteppedExtrapolation is used at end boundary conditions.
    };

    addressSpace.installHistoricalDataNode(node, options);

    installAggregateConfigurationOptions(node, options);

    // 12:00:00 - BadNoData First archive entry, Point created
    addHistory(node, "12:00:00", null, StatusCodes.BadNoData);
    // 12:00:10 10 Raw, Good
    addHistory(node, "12:00:10", 10, StatusCodes.Good);
    // 12:00:20 20 Raw, Good
    addHistory(node, "12:00:20", 20, StatusCodes.Good);
    // 12:00:30 30 Raw, Good
    addHistory(node, "12:00:30", 30, StatusCodes.Good);
    // 12:00:40 40 Raw, Bad         ANNOTATION: Operator 1
    //                                          Jan-02-2012 8:00:00 Scan failed, Bad data entered
    //                              ANNOTATION:
    //                                          Jan-04-2012 7:10:00 Value cannot be verified
    addHistory(node, "12:00:40", 40, StatusCodes.Bad);
    // 12:00:50 50 Raw, Good        ANNOTATION: Engineer1
    //                                          Jan-04-2012 7:00:00 Scanner fixed
    addHistory(node, "12:00:50", 50, StatusCodes.Good);
    // 12:01:00 60 Raw, Good
    addHistory(node, "12:01:00", 60, StatusCodes.Good);
    // 12:01:10 70 Raw, Uncertain   ANNOTATION: Technician_1
    //                                          Jan-02-2012 8:00:00 Value flagged as questionable
    addHistory(node, "12:01:10", 70, StatusCodes.Uncertain);
    // 12:01:20 80 Raw, Good
    addHistory(node, "12:01:20", 80, StatusCodes.Good);
    // 12:01:30 90 Raw, Good
    addHistory(node, "12:01:30", 90, StatusCodes.Good);

    return node;
}

export function createHistorian2(addressSpace: AddressSpace): UAVariable {
    const node = addressSpace.getOwnNamespace().addVariable({
        browseName: "History2",
        dataType: "Double"
    });

    const options = {};

    addressSpace.installHistoricalDataNode(node, options);

    // 12:00:00  -      Bad_NoData         First archive entry, Point created
    addHistory(node, "12:00:00", 10, StatusCodes.BadNoData);
    // 12:00:02  10     Raw, Good
    addHistory(node, "12:00:02", 10, StatusCodes.Good);
    // 12:00:25  20     Raw, Good
    addHistory(node, "12:00:25", 20, StatusCodes.Good);
    // 12:00:28  25     Raw, Good
    addHistory(node, "12:00:28", 25, StatusCodes.Good);
    // 12:00:39  30     Raw, Good
    addHistory(node, "12:00:39", 30, StatusCodes.Good);
    // 12:00:42  -      Raw, Bad           Bad quality data received, Bad data entered
    addHistory(node, "12:00:42", null, StatusCodes.BadDataLost);
    // 12:00:48  40     Raw, Good          Received Good StatusCode value
    addHistory(node, "12:00:48", 40, StatusCodes.Good);
    // 12:00:52  50     Raw, Good
    addHistory(node, "12:00:52", 50, StatusCodes.Good);
    // 12:01:12  60     Raw, Good
    addHistory(node, "12:01:12", 60, StatusCodes.Good);
    // 12:01:17  70     Raw, Uncertain     Value is flagged as questionable
    addHistory(node, "12:01:17", 70, StatusCodes.UncertainNoCommunicationLastUsableValue);
    // 12:01:23  70     Raw, Good
    addHistory(node, "12:01:23", 70, StatusCodes.Good);
    // 12:01:26  80     Raw, Good
    addHistory(node, "12:01:26", 80, StatusCodes.Good);
    // 12:01:30  90     Raw, Good
    addHistory(node, "12:01:30", 90, StatusCodes.Good);
    //           -      No Data             No more entries, awaiting next Value
    return node;
}

// This example is included to illustrate non-periodic data. For the purposes of Historian 2
// examples consider a source historian with the following data:
// Timestamp Value  StatusCode         Notes
// 12:00:00  -      Bad_NoData         First archive entry, Point created
// 12:00:02  10     Raw, Good
// 12:00:25  20     Raw, Good
// 12:00:28  25     Raw, Good
// 12:00:39  30     Raw, Good
// 12:00:42  -      Raw, Bad           Bad quality data received, Bad data entered
// 12:00:48  40     Raw, Good          Received Good StatusCode value
// 12:00:52  50     Raw, Good
// 12:01:12  60     Raw, Good
// 12:01:17  70     Raw, Uncertain     Value is flagged as questionable
// 12:01:23  70     Raw, Good
// 12:01:26  80     Raw, Good
// 12:01:30  90     Raw, Good
//           -      No Data             No more entries, awaiting next Value
//
// For the purposes of all Historian 2 examples:
// 1) TreatUncertainAsBad = True. Therefore Uncertain values are treated as Bad, and not
// included in the Aggregate call.
// 2) Stepped Attribute = False. Therefore SlopedInterpolation is used between data points.
// 3) UseSlopedExtrapolation = False. Therefore SteppedExtrapolation is used at end
// boundary conditions.
// 4) PercentBad = 100, PercentGood = 100. Therefore unless if all values are Good then
// the quality will be Good, or if all values are Bad then the quality will be Bad, but if
// there is some Good and some Bad then the quality will be Uncertain.
// ------------------------------------------------------------------------------------

// A.1.3 Example Aggregate data – Historian 3
// This example is included to illustrate stepped data. For the purposes of Historian 3 examples
// consider a source historian with the following data:
//
// Timestamp Value StatusCode       Notes
// 12:00:00     - Bad_NoData        First archive entry, Point created
// 12:00:02     10 Raw, Good
// 12:00:25     20 Raw, Good
// 12:00:28     25 Raw, Good
// 12:00:39     30 Raw, Good
// 12:00:42     - Raw, Bad          Bad quality data received, Bad data entered
// 12:00:48     40 Raw, Good        Received Good StatusCode value
// 12:00:52     50 Raw, Good
// 12:01:12     60 Raw, Good
// 12:01:17     70 Raw,             Uncertain Value is flagged as questionable
// 12:01:23     70 Raw, Good
// 12:01:26     80 Raw, Good
// 12:01:30     90 Raw, Good
//              -  No Data          No more entries, awaiting next Value
//
// For the purposes of all Historian 3 examples:
// 1) TreatUncertainAsBad = True. Therefore Uncertain values are treated as Bad, and not
// included in the Aggregate call.
// 2) Stepped Attribute = True. Therefore SteppedInterpolation is used between data points.
// 3) UseSlopedExtrapolation = False. Therefore SteppedExtrapolation is used at end
// boundary conditions.
// 4) PercentBad = 50, PercentGood = 50. Therefore data will be either Good or Bad quality.
//     Uncertain should not happen since a value is either Good or Bad
//
export function createHistorian3(addressSpace: AddressSpace): UAVariable {
    const node = addressSpace.getOwnNamespace().addVariable({
        browseName: "History3",
        dataType: "Double"
    });

    const options: AggregateConfigurationOptionsEx & IHistoricalDataNodeOptions = {
        percentDataBad: 50,
        percentDataGood: 50,
        stepped: true, // therefore SteppedInterpolation is used between data points
        treatUncertainAsBad: true, // therefore Uncertain values are treated as Bad,
        // and not included in the Aggregate call.
        useSlopedExtrapolation: false // therefore SteppedExtrapolation is used at end boundary conditions.
    };

    addressSpace.installHistoricalDataNode(node, options);
    installAggregateConfigurationOptions(node, options);

    // 12:00:00  -      Bad_NoData         First archive entry, Point created
    addHistory(node, "12:00:00", 10, StatusCodes.BadNoData);
    // 12:00:02     10 Raw, Good
    addHistory(node, "12:00:02", 10, StatusCodes.Good);
    // 12:00:25     20 Raw, Good
    addHistory(node, "12:00:25", 20, StatusCodes.Good);
    // 12:00:28     25 Raw, Good
    addHistory(node, "12:00:28", 25, StatusCodes.Good);
    // 12:00:39     30 Raw, Good
    addHistory(node, "12:00:39", 30, StatusCodes.Good);
    // 12:00:42     - Raw, Bad          Bad quality data received, Bad data entered
    addHistory(node, "12:00:42", null, StatusCodes.BadDataLost);
    // 12:00:48     40 Raw, Good        Received Good StatusCode value
    addHistory(node, "12:00:48", 40, StatusCodes.Good);
    // 12:00:52     50 Raw, Good
    addHistory(node, "12:00:52", 50, StatusCodes.Good);
    // 12:01:12     60 Raw, Good
    addHistory(node, "12:01:12", 60, StatusCodes.Good);
    // 12:01:17     70 Raw,             Uncertain Value is flagged as questionable
    addHistory(node, "12:01:17", 70, StatusCodes.UncertainLastUsableValue);
    // 12:01:23     70 Raw, Good
    addHistory(node, "12:01:23", 70, StatusCodes.Good);
    // 12:01:26     80 Raw, Good
    addHistory(node, "12:01:26", 80, StatusCodes.Good);
    // 12:01:30     90 Raw, Good
    addHistory(node, "12:01:30", 90, StatusCodes.Good);
    //              -  No Data          No more entries, awaiting next Value
    return node;
}

/// ------------------------------------------------------------------------------
// A.1.4 Example Aggregate data – Historian 4
// This example is included to illustrate Boolean data. For the purposes of Historian 4 examples
// consider a source historian with the following data:
//     Timestamp Value StatusCode Notes
// 12:00:00 - Bad_NoData First archive entry, Point created
// 12:00:02 TRUE Raw, Good
// 12:00:25 FALSE Raw, Good
// 12:00:28 TRUE Raw, Good
// 12:00:39 TRUE Raw, Good
// 12:00:42 - Raw, Bad Bad quality data received, Bad data entered
// 12:00:48 TRUE Raw, Good Received Good StatusCode value
// 12:00:52 FALSE Raw, Good
// 12:01:12 FALSE Raw, Good
// 12:01:17 TRUE Raw, Uncertain Value is flagged as questionable
// 12:01:23 TRUE Raw, Good
// 12:01:26 FALSE Raw, Good
// 12:01:30 TRUE Raw, Good
// - No Data No more entries, awaiting next Value
// For the purposes of all Historian 4 examples:
//     1) TreatUncertainAsBad = True. Therefore Uncertain values are treated as Bad, and not
// included in the Aggregate call.
// 2) Stepped Attribute = True. Therefore SteppedInterpolation is used between data points.
// 3) UseSlopedExtrapolation = False. Therefore SteppedExtrapolation is used at end
// boundary conditions.
// 4) PercentGood = 100, PercentBad = 100.
// For Boolean data interpolation and extrapolation shall always be stepped.
export function createHistorian4(addressSpace: AddressSpace): UAVariable {
    const node = addressSpace.getOwnNamespace().addVariable({
        browseName: "History4",
        dataType: "Boolean"
    });

    const options = {};

    addressSpace.installHistoricalDataNode(node, options);
    // 12:00:00 - Bad_NoData First archive entry, Point created
    addHistory(node, "12:00:00", null, StatusCodes.BadNoData);
    // 12:00:02 TRUE Raw, Good
    addHistory(node, "12:00:02", true, StatusCodes.Good);
    // 12:00:25 FALSE Raw, Good
    addHistory(node, "12:00:25", false, StatusCodes.Good);
    // 12:00:28 TRUE Raw, Good
    addHistory(node, "12:00:28", true, StatusCodes.Good);
    // 12:00:39 TRUE Raw, Good
    addHistory(node, "12:00:39", true, StatusCodes.Good);
    // 12:00:42 - Raw, Bad Bad quality data received, Bad data entered
    addHistory(node, "12:00:42", true, StatusCodes.BadDataLost);
    // 12:00:48 TRUE Raw, Good Received Good StatusCode value
    addHistory(node, "12:00:48", true, StatusCodes.Good);
    // 12:00:52 FALSE Raw, Good
    addHistory(node, "12:00:52", false, StatusCodes.Good);
    // 12:01:12 FALSE Raw, Good
    addHistory(node, "12:01:12", true, StatusCodes.Good);
    // 12:01:17 TRUE Raw, Uncertain Value is flagged as questionable
    addHistory(node, "12:01:17", true, StatusCodes.UncertainLastUsableValue);
    // 12:01:23 TRUE Raw, Good
    addHistory(node, "12:01:23", true, StatusCodes.Good);
    // 12:01:26 FALSE Raw, Good
    addHistory(node, "12:01:26", false, StatusCodes.Good);
    // 12:01:30 TRUE Raw, Good
    addHistory(node, "12:01:30", true, StatusCodes.Good);
    return node;
}
