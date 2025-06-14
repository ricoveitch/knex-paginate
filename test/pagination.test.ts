import { Paginator, PaginateConfig } from "../lib";
import { describe, expect, test } from "@jest/globals";
import { getDatabase } from ".";
import { randomUUID } from "crypto";

interface Item {
  id: number;
  name: string;
}

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
  const database = getDatabase();

  await database.schema.createTable(table, (t) => {
    t.integer("id").primary();
    t.string("name");
  });

  if (tableData.length) {
    await database(table).insert(tableData);
  }
}

async function testPaging(
  tableData: Item[],
  paginateConfig: PaginateConfig,
  tableAlias?: string
) {
  const order = paginateConfig.order;

  return test(`paging ${JSON.stringify(tableData)} on ${order}`, async () => {
    const database = getDatabase();

    const table = randomUUID();
    try {
      await initTable(table, tableData);

      const pageSize = paginateConfig.pageSize;
      const query = database(`${table}${tableAlias ? ` AS ${tableAlias}` : ""}`)
        .select(database.raw(paginateConfig.cursorColumn))
        .modify((qb) => {
          if (paginateConfig.orderByColumn) {
            qb.select(database.raw(paginateConfig.orderByColumn));
          }
        });

      let paginator = new Paginator(query.clone(), paginateConfig);
      const referenceData = await new Paginator(query.clone(), {
        ...paginateConfig,
        pageSize: 4,
      }).next();

      let referenceCursor = 0;

      const movePage = async (direction: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let page = [] as any[];
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

      const directions = ["next"];
      for (let i = 1; i < Math.floor(referenceData.length / pageSize); i++) {
        for (let j = 0; j < i; j++) {
          directions.push("next");
        }
        for (let j = 0; j < i; j++) {
          directions.push("previous");
        }
      }
      directions.push("next", "previous");

      for (const direction of directions) {
        await movePage(direction);
        const json = JSON.stringify(paginator);
        paginator = new Paginator(query, json);
      }
    } finally {
      await database.schema.dropTable(table);
    }
  });
}

function testOutOfBounds() {
  return test("out of bounds", async () => {
    const database = getDatabase();
    const table = "table_out_of_bounds";

    try {
      await initTable(table, []);
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
      paginator = new Paginator(query, json);
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

function testOffset() {
  return test("page offset", async () => {
    const database = getDatabase();
    const table = "table_with_offset";

    try {
      await initTable(table, [
        { id: 1, name: "b" },
        { id: 2, name: "b" },
        { id: 3, name: "b" },
      ]);
      const query = database<Item>(table).select("*");
      const paginateConfig: PaginateConfig = {
        cursorColumn: "id",
        order: "asc",
        pageSize: 1,
      };

      const paginator = new Paginator(query.clone(), paginateConfig);

      let page = await paginator.next({ pageOffset: 2 });
      expect(page[0].id).toEqual(3);

      page = await paginator.previous({ pageOffset: 1 });
      expect(page[0].id).toEqual(1);
    } finally {
      await database.schema.dropTable(table);
    }
  });
}

describe("Pagination", () => {
  const permutationData = getData(["a", "b", "c", "d"]);

  const paginateConfig: PaginateConfig = {
    cursorColumn: "id",
    order: "asc",
    orderByColumn: "name",
    pageSize: 2,
  };

  // stress test permutations of data
  for (let i = 0; i < permutationData.length; i += 3) {
    const tableData = permutationData[i];
    testPaging(tableData, paginateConfig);
    testPaging(tableData, { ...paginateConfig, order: "desc" });
  }

  const tableData = [
    { id: 0, name: "b" },
    { id: 1, name: "c" },
    { id: 2, name: "c" },
    { id: 3, name: "a" },
  ];

  testPaging(tableData, {
    ...paginateConfig,
    pageSize: 1,
  });

  //   test no order column
  paginateConfig.orderByColumn = undefined;
  testPaging(tableData, paginateConfig);
  testPaging(tableData, { ...paginateConfig, order: "desc" });

  testOutOfBounds();

  testOffset();
});
