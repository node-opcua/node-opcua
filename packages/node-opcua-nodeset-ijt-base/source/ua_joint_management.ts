// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
/**
 * The JointManagementType provides access to the
 * Joint and associated information.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JointManagementType i=1023                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAJointManagement_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    deleteJoint?: UAMethod;
    deleteJointComponent?: UAMethod;
    deleteJointDesign?: UAMethod;
    getJoint?: UAMethod;
    getJointComponent?: UAMethod;
    getJointComponentList?: UAMethod;
    getJointDesign?: UAMethod;
    getJointDesignList?: UAMethod;
    getJointList?: UAMethod;
    getJointRevisionList?: UAMethod;
    selectJoint?: UAMethod;
    sendJoint?: UAMethod;
    sendJointComponent?: UAMethod;
    sendJointDesign?: UAMethod;
}
export interface UAJointManagement extends UAObject, UAJointManagement_Base {
}