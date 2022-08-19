import { UAVariable } from "node-opcua-address-space-base";
import { NodeIdLike } from "node-opcua-nodeid";
import { InstantiateAlarmConditionOptions } from "./instantiate_alarm_condition_options";

export interface InstantiateOffNormalAlarmOptions extends InstantiateAlarmConditionOptions {
    /**
     * 
     * https://reference.opcfoundation.org/v105/Core/docs/Part9/5.8.23/#5.8.23.2
     * 
     * The NormalState Property is a Property that points to a Variable which has a value that corresponds 
     * to one of the possible values of the Variable pointed to by the InputNode Property where the NormalState 
     * Property Variable value is the value that is considered to be the normal state of the Variable
     * pointed to by the InputNode Property. 
     * 
     * When the value of the Variable referenced by the InputNode Property is not equal to the value of 
     * the NormalState Property the Alarm is Active. If this Variable is not in the AddressSpace,
     * a NULL NodeId shall be provided.
     * 
     */
    normalState?: NodeIdLike | UAVariable | null;
}
