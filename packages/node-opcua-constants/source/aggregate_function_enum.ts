import { ObjectIds } from "./opcua_node_ids";

export enum AggregateFunction {
    AnnotationCount = ObjectIds.AggregateFunction_AnnotationCount,
    Average = ObjectIds.AggregateFunction_Average,
    Count = ObjectIds.AggregateFunction_Count,
    Delta = ObjectIds.AggregateFunction_Delta,
    DeltaBounds = ObjectIds.AggregateFunction_DeltaBounds,
    DurationBad = ObjectIds.AggregateFunction_DurationBad,
    DurationGood = ObjectIds.AggregateFunction_DurationGood,
    DurationInStateNonZero = ObjectIds.AggregateFunction_DurationInStateNonZero,
    DurationInStateZero = ObjectIds.AggregateFunction_End,
    EndBound = ObjectIds.AggregateFunction_EndBound,
    Interpolative = ObjectIds.AggregateFunction_Interpolative,
    Maximum = ObjectIds.AggregateFunction_Maximum,
    Maximum2 = ObjectIds.AggregateFunction_Maximum2,
    MaximumActualTime = ObjectIds.AggregateFunction_MaximumActualTime,
    MaximumActualTime2 = ObjectIds.AggregateFunction_MaximumActualTime2,
    Minimum = ObjectIds.AggregateFunction_Minimum,
    Minimum2 = ObjectIds.AggregateFunction_Minimum2,
    MinimumActualTime = ObjectIds.AggregateFunction_MinimumActualTime,
    MinimumActualTime2 = ObjectIds.AggregateFunction_MinimumActualTime2,
    NumberOfTransitions = ObjectIds.AggregateFunction_NumberOfTransitions,
    PercentBad = ObjectIds.AggregateFunction_PercentBad,
    PercentGood = ObjectIds.AggregateFunction_PercentGood,
    Range = ObjectIds.AggregateFunction_Range,
    Range2 = ObjectIds.AggregateFunction_Range2,
    StandardDeviationPopulation = ObjectIds.AggregateFunction_StandardDeviationPopulation,
    StandardDeviationSample = ObjectIds.AggregateFunction_StandardDeviationSample,
    Start = ObjectIds.AggregateFunction_Start,
    StartBound = ObjectIds.AggregateFunction_StartBound,
    TimeAverage = ObjectIds.AggregateFunction_TimeAverage,
    TimeAverage2 = ObjectIds.AggregateFunction_TimeAverage2,
    Total = ObjectIds.AggregateFunction_Total,
    Total2 = ObjectIds.AggregateFunction_Total2,
    VariancePopulation = ObjectIds.AggregateFunction_VariancePopulation,
    VarianceSample = ObjectIds.AggregateFunction_VarianceSample,
    WorstQuality = ObjectIds.AggregateFunction_WorstQuality,
    WorstQuality2 = ObjectIds.AggregateFunction_WorstQuality2
}
