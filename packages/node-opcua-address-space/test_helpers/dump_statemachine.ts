// /**
//  * @module node-opcua-address-space
//  */
// // tslint:disable:no-console
// /*
//  * class Node {
//  *     { browseName: "string", nodeId: NodeId}
//  * }
//  * Transition {
//  *     browseName: "String"
//  *     fromState: Node
//  *     toState: Node
//  * }
//  * class SateMachineType {
//  *    initialState: Node
//  *    states: [ Node,Node, ...]
//  *    transitions: [Transition]
//  * }
//  * @param stateMachineType
//  */
// import { BaseNode, UAState, UAStateMachineEx, UATransition, UAObject, UATransitionEx } from "..";

// export function dumpStateMachineToPlantUML(stateMachineType: UAStateMachineEx): void {
//     function w(str: string) {
//         console.log(str);
//     }

//     function s(state: BaseNode) {
//         return state.nodeId.value.toString();
//     }

//     function n(state: BaseNode) {
//         return state.browseName.name!.toString();
//     }

//     w("@startuml "); // + stateMachineType.browseName.toString() + ".png");
//     // initial state if any

//     if (stateMachineType.initialState) {
//         w(" [*] --> " + s(stateMachineType.initialState));
//         w(" " + s(stateMachineType.initialState) + ":" + n(stateMachineType.initialState));
//     } else {
//         w("[*] --> [*]");
//     }

//     function t(transition: BaseNode) {
//         let name = n(transition);
//         name = name.replace(":", "");
//         name = name.replace("To", "\\nTo\\n");
//         name = name.replace("Transition", "\\nTransition");
//         return name;
//     }

//     stateMachineType.states.forEach((state: UAObject) => w(" " + s(state) + ": " + n(state)));

//     stateMachineType.transitions.forEach((transition: UATransitionEx) =>
//         w("  " + s(transition.fromStateNode!) + " --> " + s(transition.toStateNode!) + " : " + t(transition))
//     );

//     w("@enduml");
// }

// /*
//  @startuml

//  2930: Unshelved

//  2932: TimedShelved

//  2933: OneShotShelved

//  2930 --> 2932 :   "2935\nUnshelvedToTimedShelved"

//  2930 --> 2933 :   "2936\nUnshelvedToOneShotShelved"

//  2932 --> 2930 :   "2940\nTimedShelvedToUnshelved"

//  2932 --> 2933 :   "2942\nTimedShelvedToOneShotShelved"

//  2933 --> 2930 :   "2943\nOneShotShelvedToUnshelved"

//  2933 --> 2932 :   "2945\nOneShotShelvedToTimedShelved"

//  @enduml

//  */

// /*
//  digraph finite_state_machine {
//  rankdir=LR;
//  size="8,5"
//  node [shape = doublecircle]; LR_0 LR_3 LR_4 LR_8;
//  node [shape = circle];
//  LR_0 -> LR_2 [ label = "SS(B)" ];
//  LR_0 -> LR_1 [ label = "SS(S)" ];
//  LR_1 -> LR_3 [ label = "S($end)" ];
//  LR_2 -> LR_6 [ label = "SS(b)" ];
//  LR_2 -> LR_5 [ label = "SS(a)" ];
//  LR_2 -> LR_4 [ label = "S(A)" ];
//  LR_5 -> LR_7 [ label = "S(b)" ];
//  LR_5 -> LR_5 [ label = "S(a)" ];
//  LR_6 -> LR_6 [ label = "S(b)" ];
//  LR_6 -> LR_5 [ label = "S(a)" ];
//  LR_7 -> LR_8 [ label = "S(b)" ];
//  LR_7 -> LR_5 [ label = "S(a)" ];
//  LR_8 -> LR_6 [ label = "S(b)" ];
//  LR_8 -> LR_5 [ label = "S(a)" ];
//  }
//  */
// export function dumpStateMachineToGraphViz(
//     /*StateMachineProxy*/
//     stateMachineType: UAStateMachineEx
// ): void {
//     function w(str: string) {
//         console.log(str);
//     }

//     function s(state: BaseNode) {
//         return state.nodeId.value.toString();
//     }

//     function n(state: BaseNode) {
//         return state.browseName.name!.toString();
//     }

//     function s_full(state: BaseNode) {
//         return s(state) + ' [ label = "' + n(state) + '" ]';
//     }

//     w("digraph finite_state_machine {");
//     // initial state if any

//     if (stateMachineType.initialState) {
//         w("node [ shape = doublecircle];");
//         w("  _" + s_full(stateMachineType.initialState!) + " ;");
//     }
//     w("node [ shape = circle];");
//     stateMachineType.states.forEach((state: UAState) => w("   _" + s_full(state)));

//     stateMachineType.transitions.forEach((transition) =>
//         w(
//             "  _" +
//                 s(transition.fromStateNode!) +
//                 " -> _" +
//                 s(transition.toStateNode!) +
//                 " [ " +
//                 //   " labeltooltip = \"" + i(transition) + "\" " +
//                 ', label = "' +
//                 n(transition) +
//                 '" ];'
//         )
//     );

//     w("}");
// }
