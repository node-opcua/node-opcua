// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAFunctionalGroup, UAFunctionalGroup_Base } from "node-opcua-nodeset-di/source/ua_functional_group"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MachineryOperationCounterType i=1009                        |
 * |isAbstract      |false                                                       |
 */
export interface UAMachineryOperationCounter_Base extends UAFunctionalGroup_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * operationCycleCounter
     * OperationCycleCounter is counting the times the
     * component switches from not performing an
     * activity to performing an activity. For example,
     * each time a valve starts moving, is counted. This
     * value shall only increase during the lifetime of
     * the component and shall not be reset when the
     * component is restarted.
     */
    operationCycleCounter?: UAProperty<any, any>;
    /**
     * operationDuration
     * OperationDuration is the duration the
     * MachineryItem has been powered and performing an
     * activity. This counter is intended for machines
     * and components where a distinction is made
     * between switched on and in operation. For
     * example, a drive might be powered on but not
     * operating. It is not intended for machines or
     * components always performing an activity like
     * sensors always measuring data. This value shall
     * only increase during the lifetime of the
     * MachineryItem and shall not be reset when it is
     * restarted. The OperationDuration is provided as
     * Duration, i.e., in milliseconds or even fractions
     * of a millisecond. However, the Server is not
     * expected to update the value in such a high
     * frequency, but maybe once a minute or once an
     * hour, depending on the application.
     */
    operationDuration?: UAProperty<number, DataType.Double>;
    /**
     * powerOnDuration
     * PowerOnDuration is the duration the MachineryItem
     * has been powered. The main purpose is to
     * determine the time in which degradation of the
     * MachineryItem occurred. The details, when the
     * time is counted, is implementation-specific.
     * Companion specifications might define specific
     * rules. Typically, when the MachineryItem has
     * supply voltage and the main CPU is running, the
     * time is counted. This may include any kind of
     * sleep mode, but may not include pure Wake on LAN.
     * This value shall only increase during the
     * lifetime of the MachineryItem and shall not be
     * reset when it is restarted. The PowerOnDuration
     * is provided as Duration, i.e., in milliseconds or
     * even fractions of a millisecond. However, the
     * Server is not expected to update the value in
     * such a high frequency, but maybe once a minute or
     * once an hour, depending on the application.
     */
    powerOnDuration?: UAProperty<number, DataType.Double>;
}
export interface UAMachineryOperationCounter extends UAFunctionalGroup, UAMachineryOperationCounter_Base {
}