// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAYArrayItem } from "node-opcua-nodeset-ua/dist/ua_y_array_item"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
import { UAStream_parameterSet, UAStream_acquisitionData, UAStream, UAStream_Base } from "./ua_stream"
export interface UAParticleSizeMonitorDeviceStream_parameterSet extends UAStream_parameterSet { // Object
      background?: UAYArrayItem<number, DataType.Float>;
      sizeDistribution: UAYArrayItem<number, DataType.Float>;
      backgroundAcquisitionTime: UADataItem<Date, DataType.DateTime>;
}
export interface UAParticleSizeMonitorDeviceStream_acquisitionData extends UAStream_acquisitionData { // Object
      background?: UAYArrayItem<number, DataType.Float>;
      sizeDistribution: UAYArrayItem<number, DataType.Float>;
      backgroundAcquisitionTime: UADataItem<Date, DataType.DateTime>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ParticleSizeMonitorDeviceStreamType i=1032                  |
 * |isAbstract      |false                                                       |
 */
export interface UAParticleSizeMonitorDeviceStream_Base extends UAStream_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAParticleSizeMonitorDeviceStream_parameterSet;
    acquisitionData: UAParticleSizeMonitorDeviceStream_acquisitionData;
}
export interface UAParticleSizeMonitorDeviceStream extends Omit<UAStream, "parameterSet"|"acquisitionData">, UAParticleSizeMonitorDeviceStream_Base {
}