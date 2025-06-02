// ----- this file has been automatically generated - do not edit
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { UAStatistic, UAStatistic_Base } from "./ua_statistic"
import { UAAcceptedStatisticCounter } from "./ua_accepted_statistic_counter"
import { UARejectedStatisticCounter } from "./ua_rejected_statistic_counter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CheckweigherStatisticType i=48                              |
 * |isAbstract      |false                                                       |
 */
export interface UACheckweigherStatistic_Base extends UAStatistic_Base {
   // PlaceHolder for $PackagesAcceptedWithProperty$
   // PlaceHolder for $PackagesRejectedBySystem$
    /**
     * giveAway
     * Defines the totalized value of volume above
     * TargetWeight.
     */
    giveAway?: UAAnalogUnit<any, any>;
    packagesAcceptedWithLowerToleranceLimit1?: UAAcceptedStatisticCounter;
    packagesRejectedByDistanceFault?: UARejectedStatisticCounter;
    packagesRejectedByLength?: UARejectedStatisticCounter;
    packagesRejectedByLowerToleranceLimit1?: UARejectedStatisticCounter;
    packagesRejectedByLowerToleranceLimit2?: UARejectedStatisticCounter;
    packagesRejectedByMeanValueRequirement?: UARejectedStatisticCounter;
    packagesRejectedByMetal?: UARejectedStatisticCounter;
    packagesRejectedByVision?: UARejectedStatisticCounter;
    packagesRejectedByXRay?: UARejectedStatisticCounter;
    /**
     * percentageLowerToleranceLimit
     * Defines the lower tolerance limit defined in
     * welmec 6.4.
     */
    percentageLowerToleranceLimit?: UAAnalogItem<any, any>;
    totalPackagesAccepted?: UAAcceptedStatisticCounter;
    totalPackagesRejected?: UARejectedStatisticCounter;
}
export interface UACheckweigherStatistic extends UAStatistic, UACheckweigherStatistic_Base {
}