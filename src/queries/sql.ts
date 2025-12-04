import pgFormat from "pg-format";

export const enquote = (text: string) => `'${text.replace(/'/g, "''")}'`;
export const vectorize = (embedding: number[]) =>
  `'${JSON.stringify(embedding)}'::vector`;
export const joinArrayItems = (items: string[]) =>
  items.map((item) => `'${item}'`).join(", ");
export const formatSqlString = (sql: string) => pgFormat(sql.replaceAll('\n', ''));
/**
 * Query composition utilities for building complex SQL queries
 */
export interface QueryBuilder {
  select: string[];
  from: string[];
  joins: string[];
  where: string[];
  orderBy: string[];
  limit?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: any[];
  paramIndex: number;
}

export const createQueryBuilder = (): QueryBuilder => ({
  select: [],
  from: [],
  joins: [],
  where: [],
  orderBy: [],
  parameters: [],
  paramIndex: 1,
});

export const addSelectField = (
  builder: QueryBuilder,
  field: string,
  alias?: string
): QueryBuilder => {
  const fieldExpression = alias ? `${field} as ${alias}` : field;
  return {
    ...builder,
    select: [...builder.select, fieldExpression],
  };
};

export const addFrom = (
  builder: QueryBuilder,
  table: string,
  alias?: string
): QueryBuilder => {
  const fromExpression = alias ? `${table} ${alias}` : table;
  return {
    ...builder,
    from: [...builder.from, fromExpression],
  };
};

export const addJoin = (
  builder: QueryBuilder,
  joinType: "JOIN" | "LEFT JOIN" | "RIGHT JOIN" | "INNER JOIN",
  table: string,
  condition: string,
  alias?: string
): QueryBuilder => {
  const tableExpression = alias ? `${table} ${alias}` : table;
  const joinExpression = `${joinType} ${tableExpression} ON ${condition}`;
  return {
    ...builder,
    joins: [...builder.joins, joinExpression],
  };
};

export const addWhereCondition = (
  builder: QueryBuilder,
  condition: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any
): QueryBuilder => {
  const updatedBuilder = {
    ...builder,
    where: [...builder.where, condition],
  };

  if (value !== undefined) {
    updatedBuilder.parameters.push(value);
    updatedBuilder.paramIndex++;
  }

  return updatedBuilder;
};

export const addOrderBy = (
  builder: QueryBuilder,
  field: string,
  direction: "ASC" | "DESC" = "ASC"
): QueryBuilder => ({
  ...builder,
  orderBy: [...builder.orderBy, `${field} ${direction}`],
});

export const setLimit = (
  builder: QueryBuilder,
  limit: number
): QueryBuilder => ({
  ...builder,
  limit,
});

export const buildQuery = (
  builder: QueryBuilder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { query: string; parameters: any[] } => {
  const parts: string[] = [];

  // SELECT
  if (builder.select.length === 0) {
    throw new Error("Query must have at least one SELECT field");
  }
  parts.push(`SELECT ${builder.select.join(", ")}`);

  // FROM
  if (builder.from.length === 0) {
    throw new Error("Query must have a FROM clause");
  }
  parts.push(`FROM ${builder.from.join(", ")}`);

  // JOINS
  if (builder.joins.length > 0) {
    parts.push(builder.joins.join(" "));
  }

  // WHERE
  if (builder.where.length > 0) {
    parts.push(`WHERE ${builder.where.join(" AND ")}`);
  }

  // ORDER BY
  if (builder.orderBy.length > 0) {
    parts.push(`ORDER BY ${builder.orderBy.join(", ")}`);
  }

  // LIMIT
  if (builder.limit) {
    parts.push(`LIMIT $${builder.paramIndex}`);
    builder.parameters.push(builder.limit);
  }

  return {
    query: parts.join("\n"),
    parameters: builder.parameters,
  };
};

/**
 * Helper to create parameterized conditions
 */
export const createParameterizedCondition = (
  field: string,
  operator: string,
  builder: QueryBuilder
): { condition: string; updatedBuilder: QueryBuilder } => {
  const condition = `${field} ${operator} $${builder.paramIndex}`;
  const updatedBuilder = {
    ...builder,
    paramIndex: builder.paramIndex + 1,
  };

  return { condition, updatedBuilder };
};

/**
 * Helper for IN conditions with multiple parameters
 */
export const createInCondition = (
  field: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: any[],
  builder: QueryBuilder,
  negate = false
): { condition: string; updatedBuilder: QueryBuilder } => {
  if (values.length === 0) {
    return {
      condition: negate ? "1=1" : "1=0",
      updatedBuilder: builder,
    };
  }

  const placeholders = values.map(() => `$${builder.paramIndex++}`).join(",");
  const operator = negate ? "NOT IN" : "IN";
  const condition = `${field} ${operator} (${placeholders})`;

  const updatedBuilder = {
    ...builder,
    parameters: [...builder.parameters, ...values],
    paramIndex: builder.paramIndex,
  };

  return { condition, updatedBuilder };
};
