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

  return permutations.map((set) => set.map((name, i) => ({ id: i, name })));
}

async function initTable(table: string, tableData: Item[]) {
  await database.schema.createTable(table, (t) => {
    t.integer("id").primary();
    t.string("name");
  });

  if (tableData.length) {
    await database(table).insert(tableData);
  }
}

async function testPaging(
  iteration: number,
  tableData: Item[],
  order: "asc" | "desc"
) {
  return test(`paging ${JSON.stringify(tableData)} on ${order}`, async () => {
    const table = `table_${iteration}_${order}`;
    try {
      await initTable(table, tableData);

      const pageSize = 2;
      const query = database<Item>(table).select("*");
      const paginateConfig: PaginateConfig = {
        cursorColumn: "id",
        order,
        orderByColumn: "name",
        pageSize,
      };

      let paginator = new Paginator(query.clone(), paginateConfig);
      const referenceData = await paginate(query.clone(), {
        ...paginateConfig,
        pageSize: 4,
      });

      let referenceCursor = 0;

      const movePage = async (direction: string) => {
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

      const directions = ["next", "next", "previous", "next", "previous"];
      for (const direction of directions) {
        await movePage(direction);
        const json = JSON.stringify(paginator);
        paginator = Paginator.load(query, json);
      }
    } finally {
      await database.schema.dropTable(table);
    }
  });
}

function testOutOfBounds() {
  return test("out of bounds", async () => {
    const table = "table_out_of_bounds";
    try {
      await initTable("table_out_of_bounds", []);
      const query = database<Item>(table).select("*");
      const paginateConfig: PaginateConfig = {
        cursorColumn: "id",
        order: "asc",
        orderByColumn: "name",
        pageSize: 2,
      };

      let paginator = new Paginator(query.clone(), paginateConfig);

      let page = await paginator.next();
      expect(page).toEqual([]);

      page = await paginator.previous();
      expect(page).toEqual([]);

      const json = JSON.stringify(paginator);
      paginator = Paginator.load(query, json);
      page = await paginator.next();
      expect(page).toEqual([]);

      await database(table).insert([
        { id: 1, name: "a" },
        { id: 2, name: "b" },
        { id: 3, name: "c" },
      ]);

      page = await paginator.next();
      expect(page.length).toEqual(2);
      expect(page[0].id).toEqual(1);

      page = await paginator.next();
      expect(page[0].id).toEqual(3);

      page = await paginator.previous();
      expect(page[0].id).toEqual(1);
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
    testPaging(iteration, tableData, "asc");
    testPaging(iteration, tableData, "desc");
  }

  testOutOfBounds();
});
