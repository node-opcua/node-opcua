/**
 * Which directories of a package hold its tests.
 *
 * Shared for the same reason `shippedDirsOf` is: three gates each kept their own copy of this
 * list, the copies disagreed, and every one of them was blind to something.
 *
 *     check-debug-name        test_fixtures   (missed node-opcua-transport)
 *     check-import-extension  test_fixtures   (missed node-opcua-transport)
 *     check-test-ports        test-fixtures   (missed secure-channel, convert-nodeset)
 *
 * Both spellings are in use on disk and neither is going away, so the list carries both. It
 * is a constant rather than something derived: unlike shipped source, test trees are not
 * published, so no manifest declares them.
 *
 * A new spelling here is cheap to add. A gate silently not looking is not.
 */

/**
 * every directory name a package's tests may live in. The list itself lives with the
 * scanner that publishes it, so the one package that leaves this repo carries no
 * import of a path outside itself.
 */
export { TEST_DIRS } from "../check-test-ports/src/scanner.js";
