import { Paginator, PaginateConfig, paginate } from "../lib";
import { describe, beforeAll, expect, test, afterAll } from "@jest/globals";
import knex, { Knex } from "knex";

interface User {
  id: number;
  name: string;
}

let database: Knex;

async function paging(table: string, order: "asc" | "desc") {
  return test(`paging ${table} ${order}`, async () => {
    const pageSize = 2;
    const query = database<User>(table).select("*");
    const paginateConfig: PaginateConfig = {
      cursorColumn: "id",
      order,
      orderByColumn: "name",
      pageSize: 2,
    };
    const paginator = new Paginator(query.clone(), paginateConfig);
    const referenceData = await paginate(query.clone(), {
      ...paginateConfig,
      pageSize: 16,
    });

    let referenceCursor = 0;

    const movePage = async (direction: "next" | "previous") => {
      let page = [] as User[];
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

    let i = 1;
    while (referenceCursor < referenceData.length - 1) {
      if (i % 3 === 0) {
        await movePage("previous");
      } else {
        await movePage("next");
      }
      i++;
    }

    i = 1;
    while (referenceCursor > pageSize) {
      if (i % 3 === 0) {
        await movePage("next");
      } else {
        await movePage("previous");
      }
      i++;
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

  const tables = ["users", "users_same", "users_split3"];

  tables.forEach((t) => {
    paging(t, "asc");
    paging(t, "desc");
  });
});
