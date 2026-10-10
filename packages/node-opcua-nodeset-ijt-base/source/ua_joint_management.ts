import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
    /**
     * deleteJoint
     * The Method DeleteJoint is used to delete the
     * joint based on the input identifier.
     */
    deleteJoint?: UAMethod;
    /**
     * deleteJointComponent
     * The Method DeleteJointComponent is used to delete
     * the joint component based on the input identifier.
     */
    deleteJointComponent?: UAMethod;
    /**
     * deleteJointDesign
     * The Method DeleteJointDesign is used to delete
     * the joint design based on the input identifier.
     */
    deleteJointDesign?: UAMethod;
    /**
     * getJoint
     * The Method GetJoint is used to get the joint
     * based on the input identifier.
     */
    getJoint?: UAMethod;
    /**
     * getJointComponent
     * The Method GetJointComponent is used to get the
     * joint component based on the input identifier.
     */
    getJointComponent?: UAMethod;
    /**
     * getJointComponentList
     * The Method GetJointComponentList is used to get
     * the list of available joint components in the
     * system.
     */
    getJointComponentList?: UAMethod;
    /**
     * getJointDesign
     * The Method GetJointDesign is used to get the
     * joint design based on the input identifier.
     */
    getJointDesign?: UAMethod;
    /**
     * getJointDesignList
     * The Method GetJointDesignList is used to get the
     * list of available joint designs in the system.
     */
    getJointDesignList?: UAMethod;
    /**
     * getJointList
     * The Method GetJointList is used to get the list
     * of available joints in the system.
     */
    getJointList?: UAMethod;
    /**
     * getJointRevisionList
     * The Method GetJointRevisionList is used to get
     * the list available revisions of a specific joint
     * based on the JointOriginId.
     */
    getJointRevisionList?: UAMethod;
    /**
     * selectJoint
     * The Method SelectJoint is used to select the
     * joint and the associated joining process.
     */
    selectJoint?: UAMethod;
    /**
     * sendJoint
     * The Method SendJoint is used to send a joint to a
     * joining system. If the input joint already exists
     * in the system, it shall be overwritten.
     */
    sendJoint?: UAMethod;
    /**
     * sendJointComponent
     * The Method SendJointComponent is used to send a
     * joint component to a joining system. If the input
     * joint component already exists in the system, it
     * shall be overwritten.
     */
    sendJointComponent?: UAMethod;
    /**
     * sendJointDesign
     * The Method SendJointDesign is used to send a
     * joint design to a joining system. If the input
     * joint design already exists in the system, it
     * shall be overwritten.
     */
    sendJointDesign?: UAMethod;
}
export interface UAJointManagement extends UAObject, UAJointManagement_Base {}