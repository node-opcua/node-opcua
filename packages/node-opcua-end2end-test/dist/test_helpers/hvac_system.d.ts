import type { IAddressSpace } from "node-opcua-address-space";
/**
 * @method createHVACSystem
 *
 * @startuml
 *
 * class HVACModuleType {
 * }
 * HVACModuleType -up-> ObjectType
 * HVACModuleType o-down-> ExteriorTemperatureSensor     << (P,#F0F0FF)TemperatureSensorType >>
 * HVACModuleType o-down-> InteriorTemperatureSensor     << (P,#F0F0FF)TemperatureSensorType >>
 * HVACModuleType o-down-> TargetTemperature     << (P,#F0F0FF)TemperatureSensorType >>
 * HVACModuleType o-down-> HVACEnabledEventType  << (E,#00F0FF)BaseEventType >>
 * HVACModuleType o-down-> HVACDisabledEventType << (E,#00F0FF)BaseEventType >>
 * HVACModuleType o-left-> SetTargetTemperature<< (M,#ABFFF0) >>
 * HVACModuleType o-left---> Enable  << (M,#ABFFF0) >>
 * HVACModuleType o-left---> Disable << (M,#ABFFF0) >>
 * AnalogItemType -up-> DataItemType
 * DataItemType -up-> BaseDataVariableType
 * @enduml
 *
 * compact version
 * @startuml
 *
 * class HVACModuleType << (C,F0F0F0)ObjectType >> {
 *   ExteriorTemperatureSensor: AnalogItemType
 *   InteriorTemperatureSensor: AnalogItemType
 *   TargetTemperature : Variable
 *   --------
 *   HVACEnabledEventType
 *   HVACDisabledEventType
 *   --------
 *   SetTargetTemperature
 *   Enable
 *   Disable
 * }
 * @enduml
 *
 * @param addressSpace
 * @return {*}
 */
export declare function createHVACSystem(addressSpace: IAddressSpace): string;
//# sourceMappingURL=hvac_system.d.ts.map