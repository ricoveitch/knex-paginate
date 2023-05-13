import { Knex } from "knex";

interface PaginateConfig {
  cursorColumn: string;
  orderByColumn: string;
  order: "asc" | "desc";
  pageSize: number;
  orderByValue?: string;
  cursor?: string;
  pageOffset?: number;
}

interface PaginatorConfig extends PaginateConfig {
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
  ) {
    this.config = config;
    this.initialQuery = query;
  }

  private async exec(opts: ExecOptions = {}) {
    const { previous } = opts;
    const { cursorColumn, orderByColumn, order } = this.config;

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

    if (previous) {
      results.sort((a, b) => {
        const [first, second] = order === "asc" ? [a, b] : [b, a];

        if (first[orderByColumn] < second[orderByColumn]) {
          return -1;
        }

        if (first[orderByColumn] > second[orderByColumn]) {
          return 1;
        }

        if (first[cursorColumn] < second[cursorColumn]) {
          return -1;
        }

        if (first[cursorColumn] > second[cursorColumn]) {
          return 1;
        }

        console.warn("Pagination: Duplicate values found in results.");
        return 0;
      });
    }

    const length = results.length;
    Object.assign(this.config, {
      tailCursor: results[0][cursorColumn],
      cursor: results[length - 1][cursorColumn],
      orderByValue: results[length - 1][orderByColumn],
      tailOrderByValue: results[0][orderByColumn],
    });

    return results;
  }

  next() {
    return this.exec();
  }

  // TODO: handle going previous first.
  previous() {
    return this.exec({ previous: true });
  }

  toJSON() {
    return {
      config: this.config,
      query: this.initialQuery.clone().toSQL(),
    };
  }

  static parse(json: string) {
    const { config, query } = JSON.parse(json);
    return new Paginator(config, query);
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

  // TODO: error handling for cursor && orderByValue
  // TODO: make sorting optional
  return query
    .modify((_qb) => {
      if (cursor && orderByValue) {
        _qb
          .where(orderByColumn, order === "asc" ? ">=" : "<=", orderByValue)
          .andWhereNot((_andWhereNot) => {
            _andWhereNot
              .where(orderByColumn, orderByValue)
              .andWhere(cursorColumn, order === "asc" ? "<=" : ">=", cursor);
          });
      }
    })
    .orderBy([
      {
        column: orderByColumn,
        order: order,
      },
      {
        column: cursorColumn,
        order: order,
      },
    ])
    .limit(pageSize)
    .modify((_qb) => {
      if (pageOffset) {
        _qb.offset(pageOffset * pageSize);
      }
    });
}

export { Paginator, PaginateConfig, paginate };
