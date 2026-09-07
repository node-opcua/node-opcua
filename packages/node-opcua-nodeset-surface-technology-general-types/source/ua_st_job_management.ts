import type { UAMethod } from "node-opcua-address-space-base";
import type { UAJobManagement, UAJobManagement_Base } from "node-opcua-nodeset-machinery-jobs/dist/ua_job_management";
import type { UAAliasNameCategory } from "node-opcua-nodeset-ua/dist/ua_alias_name_category";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/GeneralTypes/ |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STJobManagementType i=1008                                  |
 * |isAbstract      |false                                                       |
 */
export interface UASTJobManagement_Base extends UAJobManagement_Base {
    addAlias?: UAMethod;
    removeAlias?: UAMethod;
    stJobManagementAliases?: UAAliasNameCategory;
}
export interface UASTJobManagement extends UAJobManagement, UASTJobManagement_Base {}