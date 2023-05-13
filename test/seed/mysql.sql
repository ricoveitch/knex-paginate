CREATE TABLE users (
    id INT NOT NULL auto_increment PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE users_same (
    id INT NOT NULL auto_increment PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE users_split3 (
    id INT NOT NULL auto_increment PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

INSERT INTO
    users (name)
VALUES
    ('foo'),
    ('bar'),
    ('foo'),
    ('foo'),
    ('ba'),
    ('baz'),
    ('foobar'),
    ('alice'),
    ('foobar'),
    ('bob'),
    ('bob'),
    ('qux'),
    ('qux'),
    ('qux'),
    ('john'),
    ('jane');

INSERT INTO
    users_same (name)
VALUES
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo'),
    ('foo');

INSERT INTO
    users_split3 (name)
VALUES
    ('foo'),
    ('foo'),
    ('foo'),
    ('bar'),
    ('bar'),
    ('bar'),
    ('baz'),
    ('baz'),
    ('baz'),
    ('qux'),
    ('qux'),
    ('qux'),
    ('foobar'),
    ('foobar'),
    ('foobar'),
    ('ba');