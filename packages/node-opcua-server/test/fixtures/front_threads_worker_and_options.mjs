// one module for a front thread, as an application bundles it: the front worker itself and the
// options of its server, given as both the workerScript and the serverModule of the fronts
import "../../dist/front_threads/front_worker.js";

export { default } from "./front_threads_server_options.mjs";
