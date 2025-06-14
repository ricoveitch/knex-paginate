# knex-cursor-paginator

Cursor based pagination for a [knex](https://www.npmjs.com/package/knex) query.

## Installation

```sh
npm i knex-cursor-paginator
```

## Usage

```ts
import { Paginator } from "knex-cursor-paginator";
import { knex } from "knex";

const database = knex({/*connection config*/});

const query = database("users").select("*");
const paginator = new Paginator(query, {/*paginate config*/});

const firstPage = await paginator.next();
const secondPage = await paginator.next();
const firstPageAgain = await paginator.previous();
```

### Paginate Config

| Name           | Type  | Description |
|----------------|:-----|:-------------|
| `cursorColumn` | `string`    | Used as the cursor, must be unique.|
| `orderByColumn`| `string`    | (`Optional`) Primary sort key. |
| `order`        | `asc\|desc` | The sort order of the results. Results are ordered by (`orderByColumn`, `cursorColumn`). If `orderByColumn` is not provided then only `cursorColumn is used`|
|`pageSize`      | `number`    | Number of results to be returned in each page. Equivalent to `limit pageSize`|

**Important**

The `cursorColumn` and `orderByColumn` column need to correspond to a field in the select statement, for example:

```ts
import { PaginateConfig } from "knex-cursor-paginator";

const query = database("users").select("id", "name")

const config: PaginateConfig = {
    cursorColumn: "id",
    orderByColumn: "name",
    order: "asc",
    pageSize: 10
}
```

Both the `cursorColumn` and `orderByColumn` both appear in the select statement of the query. See the below examples to deal with aliases and computed columns.

### Examples

#### Generic

Will sort based on (`age asc`, `id asc`). Returning an array of length 2 with each fetch.

```ts
// users = [
//     { id: 0, name: "a" },
//     { id: 1, name: "b" },
//     { id: 2, name: "c" },
//     { id: 3, name: "c" },
// ];
const query = database("users").select("*")

const config: PaginateConfig = {
    cursorColumn: "id",
    orderByColumn: "age",
    order: "asc",
    pageSize: 2
}

// [{ id: 0, name: "a" }, { id: 1, name: "b" }]
const firstPage = await paginator.next();

// [{ id: 2, name: "c" }, { id: 3, name: "c" }]
const secondPage = await paginator.next();
```

#### With table alias

```ts
const query = database("users as u").select("u.id", "u.name").leftJoin("foo as f", "f.id", "u.id")

const config: PaginateConfig = {
    cursorColumn: "u.id",
    orderByColumn: "u.age",
    order: "asc",
    pageSize: 10
}
```

#### With column alias

```ts
const query = database("users").select("id", "firstName as name")

const config: PaginateConfig = {
    cursorColumn: "id",
    orderByColumn: "firstName as name",
    order: "asc",
    pageSize: 10
}
```

#### Skipping pages

```ts
const paginator = new Paginator(query, {/*paginate config*/});

const firstPage = await paginator.next();
const thirdPage = await paginator.next({ pageOffset: 1 });
```

#### Saving state

If you need to save the paginator's state across api calls, you can serialize the object for later use.

```ts
const query = database("users").select("*")
const paginator = new Paginator(query, {/*paginate config*/});

const firstPage = await paginator.next();

const json = JSON.stringify(paginator);
const connection = uuid();
await cache.set(connection, json);

return firstPage

// -> call to fetch next page

const json = await cache.get(connection)
const paginator = new Paginator(query, json)
const secondPage = await paginator.next();
```
