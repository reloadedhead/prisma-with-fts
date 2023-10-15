# Full, fuzzy text search with Postgres and Prisma

At some point in your software engineering life, you might have heard the phrase "we need to build a search feature for this". Large datasets demand to be searchable. You can add filters to it, yeah, but the end user will always want to type `lrd of t` and get The Fellowship of The Ring as a first result. You probably thought of using some fancy third party solution, which looks promising, you just point the database to it and search is handled somehow. But what if, with a tiny bit of SQL tinkering, you can get to the same result, or even better?

## The Postgres basics for full text search

When it comes to text analysis or mining, there are a few diferent concepts that are useful to grasp before venturing in the beautiful journey of full text search. We can start by defining a **document**. A document is pretty much what you probably already know, a set of sentences following some kind of structure, written in a specific language. *El cantar del mío Cid* is a document, and the sinopsis of a 1930 film is a document as well. When it comes to Postgres, documents can be found in one or many more columns. Documents are usually parsed into **tokens**, that can be words and phrases, from which we can retrieve **lexemes**, meaningful units of text.

Postgres takes documents and parses lexemes from them using **dictionaries**. There is a default dictionary, language based dictionaries and you can even provide your own. Truth is, if you know your document is in german, you will likely want to use the german dictionary to parse your lexemes. By using specific dictionaries, you can get better lexemes specific to your language's alphabet and word roots and etymologies.

## Meet `tsvector`

`tsvector` is a built-in data type in Postgres [^1], that represents a sorted list of distinct, normalised lexemes. If we consider the following Prisma model

```typescript
model Movie {
  id        String  @id @default(cuid())
  title     String
  year      Int
  extract   String?
  thumbnail String?
  genre     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
we could think of a search function based on the extract of the movie. Unfortunately, as of today, Prisma lacks support for `tsvector`[^2]. However, one can make use of the `@unsupported` decorator, and venture into beautiful raw SQL.

```typescript
model Movie {
  id        String  @id @default(cuid())
  title     String
  year      Int
  extract   String?
  thumbnail String?
  genre     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  search Unsupported("tsvector")? @default(dbgenerated("''::tsvector"))
}
```

I know, if you are using Prisma, you probably don't like SQL much, but once you try to do something a little bit custom or hit a productive stage, you will find any ORM limiting.

## Generating vectors from columns
Okay, now we have got ourselves a nice vector column for full text search. With a simple SQL script, we can populate that column:

```SQL
ALTER TABLE "Movie"
SET search = to_tsvector('english', extract)
```

`to_tsvector` is one of the many built-in functions in Postgres[ˆ3] that will take your document (and an optional dictionary) and will create a vector for it. However, what happens if the extract gets updated? What if I add a new row? Well, we need to recalculate. And what a nice opportunity for generated columns[ˆ4] to shine, right? With SQL, you would do the following.

```SQL
ALTER TABLE "Movie" ADD COLUMN search tsvector
GENERATED ALWAYS AS (to_tsvector('english', extract)) STORED;
```

But life is not that simple, because we are using Prisma. Even though the Prisma team provides us with `npx prisma migrate dev --create-only`, a way of tinkering with the SQL generated in migrations, at the time of writing, there is a bug that prevents us from setting up a generated column[ˆ5]. Luckily, this is not the end, this is just another path! We can still achieve the same result using triggers! 

```sql
-- Function to be invoked by trigger

CREATE OR REPLACE FUNCTION update_tsvector_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.search := to_tsvector('english', COALESCE(NEW.extract, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY definer SET search_path = public, pg_temp;

-- Trigger that keeps the TSVECTOR up to date

DROP TRIGGER IF EXISTS "update_tsvector" ON "Movie";

CREATE TRIGGER "update_tsvector"
  BEFORE INSERT OR UPDATE ON "Movie"
  FOR EACH ROW
  EXECUTE FUNCTION update_tsvector_column ();
```

## Time to query
You now have your `tsvector` column set up, it's time to query. And yeah, you do it with a `ts_query`. There are many handy functions that can help you out converting your text search query into something Postgres will understand. `phraseto_tsquery` can take a dictionary and `websearch_to_tsquery` approximates the behavior of some common web search tools. You can choose your the one that fits your needs[ˆ3]. You can also go the extra mile and do fuzzy search. By converting your text search into a `tsvector`, you can mix lexemes and regular expressions to create a fuzzy `tsquery`:

```sql
SELECT to_tsquery(string_agg(lexeme || ':*', ' & ' ORDER BY positions)) AS q FROM unnest(to_tsvector(${searchQuery}))
```

Finally, your raw SQL Prisma query can look like this.

```typescript
const movies = await prisma.$queryRaw<MovieRecord[]>`
    WITH query AS (SELECT to_tsquery(string_agg(lexeme || ':*', ' & ' ORDER BY positions)) AS q FROM unnest(to_tsvector(${searchQuery})))
    SELECT
      id, title, genre, year, extract, ts_rank(search, query.q) AS rank
    FROM
      "Movie", query
    ${searchQuery ? Prisma.sql`WHERE search @@ query.q` : Prisma.empty}
    ORDER BY
      year, rank
    LIMIT 10
  `
/** Direct representation of a row in the Movie table. */
interface MovieRecord {
  id: string
  title: string
  year: number
  genre?: string
  extract: string
}
```

Note that we order by `ts_rank`[ˆ6], so we can provide best matching results first!

# Conclusion
All in all, you can build a powerful search feature without relying on third-party software, database duplication and complicated syntaxes. You just need Postgres and SQL, things that you already have. I am pretty sure that other DBMSs handle full text search in a similar manner. The implementation is simple, straightforward, flexible and maintainable. And if you are using Prisma, you can achieve the same results with a less elegant but still functional approach.

PS: Don't forget to index!

[^1]: [`tsvector` in Postgres documentation](https://www.postgresql.org/docs/current/datatype-textsearch.html#DATATYPE-TSVECTOR).

[ˆ2]: [Open issue for `tsvector` support in Prisma's repository](https://github.com/prisma/prisma/issues/5027).

[ˆ3]: [Text search functions and operators](https://www.postgresql.org/docs/16/functions-textsearch.html#FUNCTIONS-TEXTSEARCH).

[ˆ4]: [Generated columns in Postgres](https://www.postgresql.org/docs/current/ddl-generated-columns.html#DDL-GENERATED-COLUMNS).

[ˆ5]: [Support for generated columns](https://github.com/prisma/prisma/issues/6336).

[ˆ6]: [Ranking search results](https://www.postgresql.org/docs/16/textsearch-controls.html#TEXTSEARCH-RANKING)