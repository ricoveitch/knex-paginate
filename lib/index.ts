import { Knex } from "knex";

const TAG = "knex-paginate";

interface PaginatorConfig {
  cursorColumn: string;
  order: "asc" | "desc";
  pageSize: number;
  orderByColumn?: string;
}

interface PaginateConfig extends PaginatorConfig {
  orderByValue?: string;
  cursor?: string;
  pageOffset?: number;
}

interface PaginatorState extends PaginateConfig {
  orderByColumnName: string;
  cursorColumnName: string;
  tailCursor?: string;
  tailOrderByValue?: string;
}

interface NavigationOptions {
  pageOffset?: number;
}

interface ExecOptions extends NavigationOptions {
  previous?: boolean;
}

class Paginator<TRecord, TResult extends NonNullable<unknown>> {
  private state: PaginatorState;
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
      this.state = JSON.parse(config);
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

    this.state = {
      ...config,
      orderByColumnName,
      orderByColumn,
      cursorColumnName,
      cursorColumn,
    };
  }

  private async exec(opts: ExecOptions = {}) {
    const { previous } = opts;
    const { order, cursorColumn, cursorColumnName, orderByColumnName } =
      this.state;

    const paginateConfig: PaginateConfig = previous
      ? {
          ...this.state,
          order: order === "asc" ? "desc" : "asc",
          cursor: this.state.tailCursor,
          orderByValue: this.state.tailOrderByValue,
        }
      : this.state;

    const results = await paginate(this.initialQuery.clone(), {
      ...paginateConfig,
      pageOffset: opts.pageOffset,
    });

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

        console.warn(
          `${TAG}: ${cursorColumn} is not unique, cursorColumn must be unique to page correctly.`
        );
        return 0;
      });
    }

    const length = results.length;
    Object.assign(this.state, {
      cursor: results[length - 1][cursorColumnName],
      orderByValue: results[length - 1][orderByColumnName],
      tailCursor: results[0][cursorColumnName],
      tailOrderByValue: results[0][orderByColumnName],
    });

    return results;
  }

  /** get the next page of results */
  next(options: NavigationOptions = {}) {
    return this.exec(options);
  }

  /** get the previous page of results */
  previous(options: NavigationOptions = {}) {
    return this.exec({ ...options, previous: true });
  }

  public get value() {
    return { ...this.state };
  }

  toJSON() {
    return this.value;
  }
}

function getOrder(order: string) {
  switch (order) {
   case "asc":
   case "desc":
    return order
    default:
      return null
  }
}

function paginate<TRecord, TResult>(
  query: Knex.QueryBuilder<TRecord, TResult>,
  config: PaginateConfig
): Knex.QueryBuilder<TRecord, TResult> {
  const {
    cursor,
    cursorColumn,
    orderByColumn,
    pageSize,
    orderByValue,
    pageOffset,
  } = config;

  const order = getOrder(config.order)

  return query
    .modify((_qb) => {
      if (cursor == null && orderByValue == null) return;

      if (cursor == null) {
        throw new Error(`${TAG}: no cursor provided (${cursor})`);
      }

      if (orderByValue == null) {
        _qb.whereRaw(
          `?? ${order === "asc" ? ">" : "<"} ?`,
          [cursorColumn, cursor]
        );
      } else {
        _qb
          .whereRaw(
            `?? ${order === "asc" ? ">=" : "<="} ?`,
            [orderByColumn, orderByValue]
          )
          .andWhereNot((_andWhereNot) => {
            _andWhereNot
              .whereRaw("?? = ?", [orderByColumn, orderByValue])
              .andWhereRaw(
                `?? ${order === "asc" ? "<=" : ">="} ?`,
                [cursorColumn, cursor]
              );
          });
      }
    })
    .modify((_qb) => {
     if (order) {
				const bindings = [];
				if (orderByColumn) {
					bindings.push(orderByColumn);
				}
				bindings.push(cursorColumn);

				_qb.orderByRaw(
					`${orderByColumn ? `?? ${order}, ` : ""}?? ${order}`,
					bindings
				);
			}

    })
    .limit(pageSize)
    .modify((_qb) => {
      if (pageOffset) {
        _qb.offset(pageOffset * pageSize);
      }
    });
}

export { Paginator, PaginateConfig, paginate };
