"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");
// OPC Unified Architecture, Part 4 Release 1.02 page 115
var FilterOperator_Schema = {

    name: "FilterOperator",
    enumValues: {

        /*
         * Equals:          [2 operands]
         * TRUE if operand[0] is equal to operand[1].
         * If the operands are of different types, the system shall perform any implicit
         * conversion to a common type. This operator resolves to FALSE if no implicit
         * conversion is available and the operands are of different types. This operator returns
         * FALSE if the implicit conversion fails. See the discussion on data type precedence in
         * Table 114 for more information how to convert operands of different types.
         */
        Equals:             0,

        /*
         * IsNull:          [1 operands]
         * TRUE if operand[0] is a null value
         */
        IsNull:             1,

        /*
         * GreaterThan:          [2 operands]
         * TRUE if operand[0] is greater than operand[1].
         * The following restrictions apply to the operands:
         *   [0]: Any operand that resolves to an ordered value.
         *   [1]: Any operand that resolves to an ordered value.
         * The same conversion rules as defined for Equals apply.
         */
        GreaterThan:        2,

        /*
         * LessThan:          [2 operands]
         * TRUE if operand[0] is less than operand[1].
         * The same conversion rules and restrictions as defined for GreaterThan apply.
         */
        LessThan:           3,

        /*
         * GreaterThanOrEqual [2 operands]
         * TRUE if operand[0] is greater than or equal to operand[1].
         * The same conversion rules and restrictions as defined for GreaterThan apply
         */
        GreaterThanOrEqual: 4,

        /*
         * LessThanOrEqual    [2 operands]
         * TRUE if operand[0] is less than or equal to operand[1].
         * The same conversion rules and restrictions as defined for GreaterThan apply
         */
        LessThanOrEqual:    5,

        /*
         * Like               [2 operands]
         * TRUE if operand[0] matches a pattern defined by operand[1].
         * See Table 112 for the definition of the pattern syntax.
         * The following restrictions apply to the operands:
         *    [0]: Any operand that resolves to a String.
         *    [1]: Any operand that resolves to a String.
         * This operator resolves to FALSE if no operand can be resolved to a string.
         *
         * note:
         *  The Like operator can be used to perform wildcard comparisons. Several special characters can be
         *  included in the second operand of the Like operator. The valid characters are defined in Table 112.
         *  The wildcard characters can be combined in a single string (i.e. „Th[ia][ts]%‟ would match „That is
         *  fine‟, „This is fine‟, „That as one‟, „This it is‟, „Then at any‟, etc.)
         *
         *  Special
         *  Character   Description
         *
         *      %       Match any string of zero or more characters (i.e. „main%‟ would
         *              match any string that starts with „main‟, „%en%‟ would match
         *              any string that contains the letters „en‟ such as „entail‟, „green‟
         *              and „content‟.) If a „%‟ sign is intend in a string the list operand
         *              can be used (i.e. 5[%] would match „5%‟).
         *      _       Match any single character (i.e. „_ould‟ would match „would‟,
         *              „could‟). If the „_‟ is indended in a string then the list operand can
         *              be used (i.e. 5[_] would match „5_‟).
         *      \       Escape character allows literal interpretation
         *              (i.e. \\ is \, \% is %, \_ is _)
         *      []      Match any single character in a list
         *              (i.e. „abc[13-68] would match „abc1‟,‟abc3‟,‟abc4‟,‟abc5‟,‟abc6‟,
         *              and „abc8‟.
         *              'xyz[c-f]' would match 'xyzc','xyzd', 'xyze', 'xyzf').
         *      [^]     Not Matching any single character in a list.
         *              The ^ shall be the first character inside on the [].
         *              (i.e. 'ABC[^13-5]' would NOT match 'ABC1', 'ABC3', 'ABC4',
         *              and 'ABC5'. xyz[^dgh] would NOT match 'xyzd', 'xyzg', 'xyzh'. )
         */
        Like:               6,

        /*
         * Not               [1 operands]
         * TRUE if operand[0] is FALSE.
         * The following restrictions apply to the operands:
         *   [0]: Any operand that resolves to a Boolean.
         * If the operand cannot be resolved to a Boolean, the result is a NULL. See below for
         * a discussion on the handling of NULL.
         *
         */
        Not:                7,

        /*
         * Between          [3 operands]
         * TRUE if operand[0] is greater or equal to operand[1] and less than or equal to
         * operand[2].
         * The following restrictions apply to the operands:
         *   [0]: Any operand that resolves to an ordered value.
         *   [1]: Any operand that resolves to an ordered value.
         *   [2]: Any operand that resolves to an ordered value.
         * If the operands are of different types, the system shall perform any implicit
         * conversion to match all operands to a common type. If no implicit conversion is
         * available and the operands are of different types, the particular result is FALSE. See
         * the discussion on data type precedence in Table 114 for more information how to
         * convert operands of different types.
         */
        Between:            8,

        /*
         * InList          [2..n operands]
         *   TRUE if operand[0] is equal to one or more of the remaining operands.
         *   The Equals Operator is evaluated for operand[0] and each remaining operand in the
         *list. If any Equals evaluation is TRUE, InList returns TRUE.
         */
        InList:             9,

        /*
         * And          [2 operands]
         * TRUE if operand[0] and operand[1] are TRUE.
         * The following restrictions apply to the operands:
         *    [0]: Any operand that resolves to a Boolean.
         *    [1]: Any operand that resolves to a Boolean.
         * If any operand cannot be resolved to a Boolean it is considered a NULL. See below
         * for a discussion on the handling of NULL.
         */
        And:                10,

        /*
         * Or          [2 operands]
         * TRUE if operand[0] or operand[1] are TRUE.
         * The following restrictions apply to the operands:
         *    [0]: Any operand that resolves to a Boolean.
         *    [1]: Any operand that resolves to a Boolean.
         * If any operand cannot be resolved to a Boolean it is considered a NULL. See below
         * for a discussion on the handling of NULL
         */
        Or:                 11,

        /*
         * Cast          [2 operands]
         * Converts operand[0] to a value with a data type with a NodeId identified by
         * operand[1].
         * The following restrictions apply to the operands:
         *  [0]: Any operand.
         *  [1]: Any operand that resolves to a NodeId or ExpandedNodeId where the Node is
         * of the NodeClass DataType.
         * If there is any error in conversion or in any of the parameters then the Cast
         * Operation evaluates to a NULL. See below for a discussion on the handling of NULL
         */
        Cast:               12,


        /*
         * InView          [1 operands]
         * TRUE if the target Node is contained in the View defined by operand[0].
         * The following restrictions apply to the operands:
         *    [0]: Any operand that resolves to a NodeId that identifies a View Node.
         * If operand[0] does not resolve to a NodeId that identifies a View Node, this operation
         * shall always be False
         */
        InView:             13,

        /*
         * OfType          [1 operands]
         * TRUE if the target Node is of type operand[0] or of a subtype of operand[0].
         * The following restrictions apply to the operands:
         * [0]: Any operand that resolves to a NodeId that identifies an ObjectType or
         * VariableType Node.
         * If operand[0] does not resolve to a NodeId that identifies an ObjectType or
         * VariableType Node, this operation shall always be False
         */
        OfType:             14,

        /*
         * RelatedTo          [6 operands]
         * TRUE if the target Node is of type Operand[0] and is related to a NodeId of the type
         * defined in Operand[1] by the Reference type defined in Operand[2].
         * Operand[0] or Operand[1] can also point to an element Reference where the referred
         * to element is another RelatedTo operator. This allows chaining of relationships (e.g.
         * A is related to B is related to C), where the relationship is defined by the
         * ReferenceType defined in Operand[2]. In this case, the referred to element returns a
         * list of NodeIds instead of TRUE or FALSE. In this case if any errors occur or any of
         * the operands cannot be resolved to an appropriate value, the result of the chained
         * relationship is an empty list of nodes.
         * Operand[3] defines the number of hops for which the relationship should be followed.
         * If Operand[3] is 1, then objects shall be directly related. If a hop is greater than 1,
         * then a NodeId of the type described in Operand[1] is checked for at the depth
         * specified by the hop. In this case, the type of the intermediate Node is undefined,
         * and only the Reference type used to reach the end Node is defined. If the requested
         * number of hops cannot be followed, then the result is FALSE, i.e., an empty Node
         * list. If Operand[3] is 0, the relationship is followed to its logical end in a forward
         * direction and each Node is checked to be of the type specified in Operand[1]. If any
         * Node satisfies this criterion, then the result is TRUE, i.e., the NodeId is included in
         * the sub-list.
         * Operand [4] defines if Operands [0] and [1] should include support for subtypes of
         * the types defined by these operands. A TRUE indicates support for subtypes
         * Operand [5] defines if Operand [2] should include support for subtypes of the
         * reference type. A TRUE indicates support for subtypes.
         *
         * The following restrictions apply to the operands:
         * [0]: Any operand that resolves to a NodeId or ExpandedNodeId that identifies an
         *      ObjectType or VariableType Node or a reference to another element which is a
         *      RelatedTo operator.
         * [1]: Any operand that resolves to a NodeId or ExpandedNodeId that identifies an
         *      ObjectType or VariableType Node or a reference to another element which is a
         *      RelatedTo operator.
         * [2]: Any operand that resolves to a NodeId that identifies a ReferenceType Node.
         * [3]: Any operand that resolves to a value implicitly convertible to Uint32.
         * [4]: Any operand that resolves to a value implicitly convertible to a boolean; if this
         *      operand does not resolve to a Boolean, then a value of FALSE is used.
         * [5]: Any operand that resolves to a value implicitly convertible to a boolean; if this
         *   *    operand does not resolve to a Boolean, then a value of FALSE is used.
         * If none of the operands [0],[1],[2],[3] resolves to an appropriate value then the result
         * of this operation shall always be False (or an Empty set in the case of a nested
         * RelatedTo operand).
         *  See examples for RelatedTo in Annex B.2
         *
         *  note:
         *  The RelatedTo operator can be used to identify if a given type, set as operand[1], is a subtype of
         *  another type set as operand[0] by setting operand[2] to the HasSubtype ReferenceType and
         *  operand[3] to 0
         */
        RelatedTo:          15,

        /*
         * BitwiseAnd          [2 operands]
         * The result is an integer which matches the size of the largest operand and contains a
         * bitwise And operation of the two operands where both have been converted to the
         * same size (largest of the two operands).
         * The following restrictions apply to the operands:
         * [0]: Any operand that resolves to a integer.
         * [1]: Any operand that resolves to a integer.
         * If any operand cannot be resolved to a integer it is considered a NULL. See below
         * for a discussion on the handling of NULL.
         */
        BitwiseAnd:         16,

        /*
         * BitwiseOr          [2 operands]
         * The result is an integer which matches the size of the largest operand and contains a
         * bitwise Or operation of the two operands where both have been converted to the
         * same size (largest of the two operands).
         * The following restrictions apply to the operands:
         * [0]: Any operand that resolves to a Integer.
         * [1]: Any operand that resolves to a Integer.
         * If any operand cannot be resolved to a Integer it is considered a NULL. See below
         * for a discussion on the handling of NULL.
         */
        BitwiseOr:          17
    }
};
exports.FilterOperator_Schema = FilterOperator_Schema;
exports.FilterOperator = factories.registerEnumeration(FilterOperator_Schema);
