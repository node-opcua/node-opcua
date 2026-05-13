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
    abortJoiningProcess?: UAMethod;
    decrementJoiningProcessCounter?: UAMethod;
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    deleteJoiningProcess?: UAMethod;
    deselectJoiningProcess?: UAMethod;
    getJoiningProcess?: UAMethod;
    getJoiningProcessList?: UAMethod;
    getJoiningProcessRevisionList?: UAMethod;
    getSelectedJoiningProgram?: UAMethod;
    incrementJoiningProcessCounter?: UAMethod;
    resetJoiningProcess?: UAMethod;
    selectJoiningProcess?: UAMethod;
    sendJoiningProcess?: UAMethod;
    setJoiningProcessCounter?: UAMethod;
    setJoiningProcessMapping?: UAMethod;
    setJoiningProcessSize?: UAMethod;
    startJoiningProcess?: UAMethod;
    startSelectedJoining?: UAMethod;
}
export interface UAJoiningProcessManagement extends UAObject, UAJoiningProcessManagement_Base {}