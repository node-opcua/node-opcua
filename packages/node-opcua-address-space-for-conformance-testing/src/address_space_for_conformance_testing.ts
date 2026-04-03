/**
 * @module opcua.server.simulation
 *
 * Builds the conformance-testing address space by delegating to focused sub-modules.
 */
import type { AddressSpace, UAObject } from "node-opcua-address-space";
import { add_eventGeneratorObject } from "node-opcua-address-space/testHelpers";

import { addAccessRightVariables } from "./conformance_testing/access_right_variables";
import { addAnalogDataItems } from "./conformance_testing/analog_data_items";
import { addMultiStateDiscreteVariable, addMultiStateValueDiscreteVariables, addTwoStateDiscreteVariables } from "./conformance_testing/discrete_variables";
import { addEnumerationVariable } from "./conformance_testing/enumeration_variable";
import { addMassVariables } from "./conformance_testing/mass_variables";
import { addNodeWithReferences } from "./conformance_testing/node_with_references";
import { addObjectWithMethod } from "./conformance_testing/object_with_methods";
import { addPath10Deep, addVeryLargeArrayVariables } from "./conformance_testing/path_and_large_arrays";
import { addSampleView } from "./conformance_testing/sample_view";
import { addSimulationVariables } from "./conformance_testing/simulation_variables";
import { addStaticVariables } from "./conformance_testing/static_variables";
import { addTriggerNodes } from "./conformance_testing/trigger_nodes";

export async function build_address_space_for_conformance_testing(
    addressSpace: AddressSpace,
    options?: { mass_variable?: boolean; mass_variables?: boolean }
): Promise<void> {
    const namespace = addressSpace.registerNamespace("urn://node-opcua-simulator");

    options = options || {};
    options.mass_variable = options.mass_variable || false;

    const objectsFolder = addressSpace.findNode("ObjectsFolder") as UAObject;

    const simulationFolder = namespace.addFolder(objectsFolder, {
        browseName: "Simulation",
        nodeId: "s=SimulationFolder"
    });

    addAccessRightVariables(namespace, simulationFolder);

    const staticVariablesFolder = namespace.addFolder(simulationFolder, {
        browseName: "Static"
    });

    const allProfileFolder = namespace.addFolder(staticVariablesFolder, {
        browseName: "All Profiles"
    });

    // Scalars/Array/MultiDim array of all sorts
    await addStaticVariables(namespace, allProfileFolder);

    if (options.mass_variables) {
        addMassVariables(namespace, allProfileFolder);
    }
    addAnalogDataItems(namespace, allProfileFolder);

    const dynamicVariablesFolder = namespace.addFolder(simulationFolder, {
        browseName: "Dynamic"
    });
    addSimulationVariables(namespace, dynamicVariablesFolder);

    addVeryLargeArrayVariables(namespace, staticVariablesFolder);

    addPath10Deep(namespace, simulationFolder);

    addNodeWithReferences(namespace, simulationFolder);

    addObjectWithMethod(namespace, simulationFolder);

    add_eventGeneratorObject(namespace, simulationFolder);

    addSampleView(namespace);

    addEnumerationVariable(namespace, simulationFolder);

    addMultiStateValueDiscreteVariables(namespace, simulationFolder);

    addTwoStateDiscreteVariables(namespace, simulationFolder);

    addMultiStateDiscreteVariable(namespace, simulationFolder);

    addTriggerNodes(namespace, simulationFolder);
}
