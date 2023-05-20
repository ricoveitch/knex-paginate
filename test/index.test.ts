import { Paginator, PaginateConfig, paginate } from "../lib";
import { describe, beforeAll, expect, test, afterAll } from "@jest/globals";
import knex, { Knex } from "knex";

interface Item {
  id: number;
  name: string;
}

let database: Knex;

function getData(options: string[]) {
  const permutations: string[][] = [];

  const permute = (solution: string[]) => {
    if (solution.length > options.length - 1) {
      permutations.push(solution);
      return;
    }

    for (let i = 0; i < options.length; i++) {
      permute(solution.concat([options[i]]));
    }
  };

  permute([]);

  return permutations.map((p) => {
    const res: Item[] = [];
    for (let i = 0; i < p.length; i++) {
      res.push({ id: i, name: p[i] });
    }
    return res;
  });
}

async function page(
  iteration: number,
  tableData: Item[],
  order: "asc" | "desc"
) {
  return test(`paging ${JSON.stringify(tableData)} on ${order}`, async () => {
    const table = `table_${iteration}_${order}`;
    try {
      await database.schema.createTable(table, (t) => {
        t.integer("id").primary();
        t.string("name");
      });

      await database(table).insert(tableData);

      const pageSize = 2;
      const query = database<Item>(table).select("*");
      const paginateConfig: PaginateConfig = {
        cursorColumn: "id",
        order,
        orderByColumn: "name",
        pageSize,
      };
      const paginator = new Paginator(query.clone(), paginateConfig);
      const referenceData = await paginate(query.clone(), {
        ...paginateConfig,
        pageSize: 4,
      });

      let referenceCursor = 0;

      const movePage = async (direction: "next" | "previous") => {
        let page = [] as Item[];
        if (direction === "next") {
          page = await paginator.next();
        } else {
          page = await paginator.previous();
          referenceCursor -= pageSize * 2;
        }

        // check page against reference data
        for (let i = 0; i < pageSize; i++) {
          expect(page[i].id).toBe(referenceData[referenceCursor].id);
          referenceCursor += 1;
        }
      };

      await movePage("next");
      await movePage("next");
      await movePage("previous");
      await movePage("next");
      await movePage("previous");
    } finally {
      await database.schema.dropTable(table);
    }
  });
}

describe("Pagination", () => {
  beforeAll(() => {
    database = knex({
      client: "mysql2",
      connection: {
        host: "127.0.0.1",
        port: 5010,
        user: "root",
        password: "secret",
        database: "test_pagination_db",
      },
    });
  });

  afterAll(() => database.destroy());

  const data = getData(["a", "b", "c", "d"]);

  for (let iteration = 0; iteration < data.length; iteration++) {
    const tableData = data[iteration];
    page(iteration, tableData, "asc");
    page(iteration, tableData, "desc");
  }
});
