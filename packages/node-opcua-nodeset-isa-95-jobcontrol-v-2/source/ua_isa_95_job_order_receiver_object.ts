// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { DTISA95JobOrderAndState } from "./dt_isa_95_job_order_and_state"
import { DTISA95WorkMaster } from "./dt_isa_95_work_master"
/**
 * The OPENSCSJobOrderReciverObjectType contains a
 * method to receive job order commands and optional
 * definitions of allowable job order information
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95JobOrderReceiverObjectType i=1002                      |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95JobOrderReceiverObject_Base extends UAFiniteStateMachine_Base {
    abort?: UAMethod;
    /**
     * aborted
     * The job order is aborted.
     */
    aborted: UAState;
    /**
     * allowedToStart
     * The job order is stored and may be executed.
     */
    allowedToStart: UAState;
    cancel?: UAMethod;
    clear?: UAMethod;
    /**
     * ended
     * The job order has been completed and is no longer
     * in execution.
     */
    ended: UAState;
    /**
     * equipmentID
     * Defines a read-only set of Equipment Class IDs
     * and Equipment IDs that may be specified in a job
     * order.
     */
    equipmentID: UABaseDataVariable<UAString[], DataType.String>;
    /**
     * fromAllowedToStartToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromAllowedToStartToAborted: UATransition;
    /**
     * fromAllowedToStartToAllowedToStart
     * This transition is triggered when the Update
     * Method is called and the job order is modified.
     */
    fromAllowedToStartToAllowedToStart: UATransition;
    /**
     * fromAllowedToStartToNotAllowedToStart
     * This transition is triggered when the RevokeStart
     * Method is called.
     */
    fromAllowedToStartToNotAllowedToStart: UATransition;
    /**
     * fromAllowedToStartToRunning
     * This transition is triggered when a job order is
     * started to be executed.
     */
    fromAllowedToStartToRunning: UATransition;
    /**
     * fromInterruptedToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromInterruptedToAborted: UATransition;
    /**
     * fromInterruptedToEnded
     * This transition is triggered when Stop Method is
     * called.
     */
    fromInterruptedToEnded: UATransition;
    /**
     * fromInterruptedToRunning
     * This transition is triggered when Resume Method
     * is called.
     */
    fromInterruptedToRunning: UATransition;
    /**
     * fromNotAllowedToStartToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromNotAllowedToStartToAborted: UATransition;
    /**
     * fromNotAllowedToStartToAllowedToStart
     * This transition is triggered when the Start
     * Method is called.
     */
    fromNotAllowedToStartToAllowedToStart: UATransition;
    /**
     * fromNotAllowedToStartToNotAllowedToStart
     * This transition is triggered when the Update
     * Method is called and the job order is modified.
     */
    fromNotAllowedToStartToNotAllowedToStart: UATransition;
    /**
     * fromRunningToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromRunningToAborted: UATransition;
    /**
     * fromRunningToEnded
     * This transition is triggered when the execution
     * of a job order has finished, either internally or
     * by the Stop Method.
     */
    fromRunningToEnded: UATransition;
    /**
     * fromRunningToInterrupted
     * This transition is triggered when an executing
     * job order gets interrupted, either internally or
     * by the Pause Method.
     */
    fromRunningToInterrupted: UATransition;
    /**
     * interrupted
     * The job order has been temporarily stopped.
     */
    interrupted: UAState;
    /**
     * jobOrderList
     * Defines a read-only list of job order information
     * available from the server.
     */
    jobOrderList: UABaseDataVariable<DTISA95JobOrderAndState[], DataType.ExtensionObject>;
    /**
     * materialClassID
     * Defines a read-only set of Material Classes IDs
     * that may be specified in a job order.
     */
    materialClassID: UABaseDataVariable<UAString[], DataType.String>;
    /**
     * materialDefinitionID
     * Defines a read-only set of Material Classes IDs
     * that may be specified in a job order.
     */
    materialDefinitionID: UABaseDataVariable<UAString[], DataType.String>;
    maxDownloadableJobOrders: UAProperty<UInt16, DataType.UInt16>;
    /**
     * notAllowedToStart
     * The job order is stored but may not be executed.
     */
    notAllowedToStart: UAState;
    pause?: UAMethod;
    /**
     * personnelID
     * Defines a read-only set of Personnel IDs and
     * Person IDs that may be specified in a job order.
     */
    personnelID: UABaseDataVariable<UAString[], DataType.String>;
    /**
     * physicalAssetID
     * Defines a read-only set of Physical Asset Class
     * IDs and Physical Asset IDs that may be specified
     * in a job order.
     */
    physicalAssetID: UABaseDataVariable<UAString[], DataType.String>;
    resume?: UAMethod;
    revokeStart?: UAMethod;
    /**
     * running
     * The job order is executing.
     */
    running: UAState;
    start?: UAMethod;
    stop?: UAMethod;
    store?: UAMethod;
    storeAndStart?: UAMethod;
    update?: UAMethod;
    /**
     * workMaster
     * Defines a read-only set of work master IDs that
     * may be specified in a job order, and the
     * read-only set of parameters that may be specified
     * for a specific work master.
     */
    workMaster: UABaseDataVariable<DTISA95WorkMaster[], DataType.ExtensionObject>;
}
export interface UAISA95JobOrderReceiverObject extends UAFiniteStateMachine, UAISA95JobOrderReceiverObject_Base {
}