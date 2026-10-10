import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The JoiningProcessManagementType provides access
 * to various joining processes in a joining system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JoiningProcessManagementType i=1025                         |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningProcessManagement_Base {
    /**
     * abortJoiningProcess
     * The Method AbortJoiningProcess is used to abort
     * the input joining process if it is under
     * execution.
     */
    abortJoiningProcess?: UAMethod;
    /**
     * decrementJoiningProcessCounter
     * The Method DecrementJoiningProcessCounter used to
     * decrement the counter of the sequential joining
     * processes such as Job, etc.
     */
    decrementJoiningProcessCounter?: UAMethod;
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * deleteJoiningProcess
     * The Method DeleteJoiningProcess is used to delete
     * the input joining process.
     */
    deleteJoiningProcess?: UAMethod;
    /**
     * deselectJoiningProcess
     * The Method DeselectJoiningProcess is used to
     * deselect any selected joining process.
     */
    deselectJoiningProcess?: UAMethod;
    /**
     * getJoiningProcess
     * The Method GetJoiningProcess is used to get the
     * joining process based on the input identifier.
     */
    getJoiningProcess?: UAMethod;
    /**
     * getJoiningProcessList
     * The Method GetJoiningProcessList is used to get
     * the list of joining process meta data available
     * in the system.
     */
    getJoiningProcessList?: UAMethod;
    /**
     * getJoiningProcessRevisionList
     * The Method GetJoiningProcessRevisionList is used
     * to get the list available revisions of a specific
     * joining process based on the
     * joiningProcessOriginId.
     */
    getJoiningProcessRevisionList?: UAMethod;
    /**
     * getSelectedJoiningProgram
     * The Method GetSelectedJoiningProgram is used to
     * get the selected joining program for a given
     * asset.
     */
    getSelectedJoiningProgram?: UAMethod;
    /**
     * incrementJoiningProcessCounter
     * The Method IncrementJoiningProcessCounter is used
     * to increment the counter of the sequential
     * joining processes such as Job, etc.
     */
    incrementJoiningProcessCounter?: UAMethod;
    /**
     * resetJoiningProcess
     * The Method ResetJoiningProcess is used to
     * reset/restart the sequential joining processes
     * such as Job, etc.
     */
    resetJoiningProcess?: UAMethod;
    /**
     * selectJoiningProcess
     * The Method SelectJoiningProcess is used to select
     * the joining process based on the input arguments.
     */
    selectJoiningProcess?: UAMethod;
    /**
     * sendJoiningProcess
     * The Method SendJoiningProcess is used to send a
     * joining process to the joining system. It can be
     * used to insert a joining program or joining batch
     * or joining job or any other process applicable to
     * a joining system. It shall overwrite the joining
     * process if it already exists in the joining
     * system.
     */
    sendJoiningProcess?: UAMethod;
    /**
     * setJoiningProcessCounter
     * The Method SetJoiningProcessCounter is used to
     * set the counter of a sequential joining processes
     * (such as Job, etc.) to the given input value.
     */
    setJoiningProcessCounter?: UAMethod;
    /**
     * setJoiningProcessMapping
     * The Method SetJoiningProcessMapping is used to
     * set the mapping of the joining process in a
     * joining system. It can be used to map a joining
     * process to a selection name.
     */
    setJoiningProcessMapping?: UAMethod;
    /**
     * setJoiningProcessSize
     * The Method SetJoiningProcessSize is used to set
     * the size of the batch joining process.
     */
    setJoiningProcessSize?: UAMethod;
    /**
     * startJoiningProcess
     * The Method StartJoiningProcess is used to start
     * the input joining process. 
     * Note: It is not intended to be used in a hard
     * real-time use case.
     */
    startJoiningProcess?: UAMethod;
    /**
     * startSelectedJoining
     * The Method StartSelectedJoining is used to start
     * the selected joining. The joining operation can
     * be selected using SelectJoiningProcess or
     * SelectJoint. 
     * Note: It is not intended to be used in a hard
     * real-time use case.
     */
    startSelectedJoining?: UAMethod;
}
export interface UAJoiningProcessManagement extends UAObject, UAJoiningProcessManagement_Base {}