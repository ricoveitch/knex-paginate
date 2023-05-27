import { beforeAll, afterAll } from "@jest/globals";
import knex, { Knex } from "knex";

let database: Knex;

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

function getDatabase() {
  return database;
}

export { getDatabase };
