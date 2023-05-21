import { Knex } from "knex";

const TAG = "knex-paginator";

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
    this.config = { ...config };
    this.initialQuery = query.clone();
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

    if (!results?.length) return [];

    if (previous) {
      results.sort((a, b) => {
        const [first, second] = order === "asc" ? [a, b] : [b, a];

        if (orderByColumn) {
          if (first[orderByColumn] < second[orderByColumn]) {
            return -1;
          }

          if (first[orderByColumn] > second[orderByColumn]) {
            return 1;
          }
        }

        if (first[cursorColumn] < second[cursorColumn]) {
          return -1;
        }

        if (first[cursorColumn] > second[cursorColumn]) {
          return 1;
        }

        console.warn(`${TAG}: Duplicate values found in results.`);
        return 0;
      });
    }

    const length = results.length;
    Object.assign(this.config, {
      cursor: results[length - 1][cursorColumn],
      orderByValue: results[length - 1][orderByColumn],
      tailCursor: results[0][cursorColumn],
      tailOrderByValue: results[0][orderByColumn],
    });

    return results;
  }

  next() {
    return this.exec();
  }

  previous() {
    return this.exec({ previous: true });
  }

  toJSON() {
    return this.config;
  }

  static load<TRecord, TResult extends NonNullable<unknown>>(
    query: Knex.QueryBuilder<TRecord, TResult>,
    json: string
  ) {
    const config: PaginateConfig = JSON.parse(json);
    return new Paginator(query, config);
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
        _qb.where(cursorColumn, order === "asc" ? ">" : "<", cursor);
      } else {
        _qb
          .where(orderByColumn, order === "asc" ? ">=" : "<=", orderByValue)
          .andWhereNot((_andWhereNot) => {
            _andWhereNot
              .where(orderByColumn, orderByValue)
              .andWhere(cursorColumn, order === "asc" ? "<=" : ">=", cursor);
          });
      }
    })
    .modify((_qb) => {
      const orderByClause = [
        {
          column: cursorColumn,
          order: order,
        },
      ];

      if (orderByColumn) {
        orderByClause.unshift({
          column: orderByColumn,
          order: order,
        });
      }
      _qb.orderBy(orderByClause);
    })
    .limit(pageSize)
    .modify((_qb) => {
      if (pageOffset) {
        _qb.offset(pageOffset * pageSize);
      }
    });
}

export { Paginator, PaginateConfig, paginate };
