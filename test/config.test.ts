import { Paginator, PaginateConfig } from "../lib";
import { describe, expect, test } from "@jest/globals";
import { getDatabase } from ".";

describe("Set config", () => {
  test("Set config", () => {
    const database = getDatabase();

    const paginateConfig: PaginateConfig = {
      cursorColumn: "id",
      order: "asc",
      orderByColumn: "name",
      pageSize: 2,
    };

    const getConfig = () => {
      return new Paginator(database("table").select("*"), paginateConfig).state;
    };

    let config = getConfig();

    expect(config.cursorColumn).toBe("id");
    expect(config.cursorColumnName).toBe("id");
    expect(config.orderByColumn).toBe("name");
    expect(config.orderByColumnName).toBe("name");

    paginateConfig.cursorColumn = "id as idAlias";
    paginateConfig.orderByColumn = "name as nameAlias";
    config = getConfig();
    expect(config.cursorColumn).toBe("id");
    expect(config.cursorColumnName).toBe("idAlias");
    expect(config.orderByColumn).toBe("name");
    expect(config.orderByColumnName).toBe("nameAlias");

    paginateConfig.cursorColumn = "t.id as idAlias";
    paginateConfig.orderByColumn = "t.name as nameAlias";
    config = getConfig();
    expect(config.cursorColumn).toBe("t.id");
    expect(config.cursorColumnName).toBe("idAlias");
    expect(config.orderByColumn).toBe("t.name");
    expect(config.orderByColumnName).toBe("nameAlias");
  });
});
