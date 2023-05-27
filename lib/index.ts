import { Knex } from "knex";

const TAG = "knex-paginate";

interface PaginateConfig {
  cursorColumn: string;
  order: "asc" | "desc";
  pageSize: number;
  orderByColumn?: string;
  orderByValue?: string;
  cursor?: string;
  pageOffset?: number;
}

interface PaginatorConfig extends PaginateConfig {
  orderByColumnName: string;
  cursorColumnName: string;
  tailCursor?: string;
  tailOrderByValue?: string;
}

interface ExecOptions {
  previous?: boolean;
}

class Paginator<TRecord, TResult extends NonNullable<unknown>> {
  private config: PaginatorConfig;
  private initialQuery: Knex.QueryBuilder<TRecord, TResult>;

  constructor(
    query: Knex.QueryBuilder<TRecord, TResult>,
    config: PaginateConfig
  );
  constructor(query: Knex.QueryBuilder<TRecord, TResult>, json: string);
  constructor(
    query: Knex.QueryBuilder<TRecord, TResult>,
    config: PaginateConfig | string
  ) {
    this.initialQuery = query.clone();

    if (typeof config === "string") {
      this.config = JSON.parse(config);
      return;
    }

    const splitColumnDetails = (column: string) => {
      if (!column) return [null, null];

      // If using a column alias
      const splitAlias = column.split(/[ ]+[aA][sS][ ]+/);
      if (splitAlias.length === 2) return splitAlias;

      // If using a table alias
      const columnWithTableAlias = column.split(".");
      if (columnWithTableAlias.length === 2) {
        return [column, columnWithTableAlias[1]];
      }

      // If only using a column name
      return [column, column];
    };

    const [orderByColumn, orderByColumnName] = splitColumnDetails(
      config.orderByColumn
    );
    const [cursorColumn, cursorColumnName] = splitColumnDetails(
      config.cursorColumn
    );

    this.config = {
      ...config,
      orderByColumnName,
      orderByColumn,
      cursorColumnName,
      cursorColumn,
    };
  }

  private async exec(opts: ExecOptions = {}) {
    const { previous } = opts;
    const { order, cursorColumnName, orderByColumnName } = this.config;

    const results = await paginate(
      this.initialQuery.clone(),
      previous
        ? {
            ...this.config,
            order: order === "asc" ? "desc" : "asc",
            cursor: this.config.tailCursor,
            orderByValue: this.config.tailOrderByValue,
          }
        : this.config
    );

    if (!results?.length) return [];

    if (previous) {
      results.sort((a, b) => {
        const [first, second] = order === "asc" ? [a, b] : [b, a];

        if (orderByColumnName) {
          if (first[orderByColumnName] < second[orderByColumnName]) {
            return -1;
          }

          if (first[orderByColumnName] > second[orderByColumnName]) {
            return 1;
          }
        }

        if (first[cursorColumnName] < second[cursorColumnName]) {
          return -1;
        }

        if (first[cursorColumnName] > second[cursorColumnName]) {
          return 1;
        }

        console.warn(`${TAG}: Duplicate values found in results.`);
        return 0;
      });
    }

    const length = results.length;
    Object.assign(this.config, {
      cursor: results[length - 1][cursorColumnName],
      orderByValue: results[length - 1][orderByColumnName],
      tailCursor: results[0][cursorColumnName],
      tailOrderByValue: results[0][orderByColumnName],
    });

    return results;
  }

  next() {
    return this.exec();
  }

  previous() {
    return this.exec({ previous: true });
  }

  public get state() {
    return { ...this.config };
  }

  toJSON() {
    return this.state;
  }
}

function paginate<TRecord, TResult>(
  query: Knex.QueryBuilder<TRecord, TResult>,
  config: PaginateConfig
): Knex.QueryBuilder<TRecord, TResult> {
  const {
    cursor,
    cursorColumn,
    order,
    orderByColumn,
    pageSize,
    orderByValue,
    pageOffset,
  } = config;

  return query
    .modify((_qb) => {
      if (cursor == null && orderByValue == null) return;

      if (cursor == null) {
        throw new Error(`${TAG}: no cursor provided (${cursor})`);
      }

      if (orderByValue == null) {
        _qb.whereRaw(
          `${cursorColumn} ${order === "asc" ? ">" : "<"} ?`,
          cursor
        );
      } else {
        _qb
          .whereRaw(
            `${orderByColumn} ${order === "asc" ? ">=" : "<="} ?`,
            orderByValue
          )
          .andWhereNot((_andWhereNot) => {
            _andWhereNot
              .whereRaw(`${orderByColumn} = ?`, orderByValue)
              .andWhereRaw(
                `${cursorColumn} ${order === "asc" ? "<=" : ">="} ?`,
                cursor
              );
          });
      }
    })
    .orderByRaw(
      `${
        orderByColumn ? `${orderByColumn} ${order}, ` : ""
      }${cursorColumn} ${order}`
    )
    .limit(pageSize)
    .modify((_qb) => {
      if (pageOffset) {
        _qb.offset(pageOffset * pageSize);
      }
    });
}

export { Paginator, PaginateConfig, paginate };
