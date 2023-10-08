import { Prisma } from "@prisma/client";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { prisma } from "~/db.server";

export const meta: MetaFunction = () => [{ title: "Movies" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");

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

  return json(movies);
}

export default function Index() {
  const movies = useLoaderData<typeof loader>();
  return (
    <main className="antialiased text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-4 h-full space-y-4">
      <Form className="flex items-end space-x-2" method="get">
        <SearchInput className="flex-1" />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-2 text-[0.8125rem] font-semibold leading-5 text-white hover:bg-indigo-500"
        >
          Go
        </button>
      </Form>
      <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden dark:bg-slate-800/25">
        <div className="shadow-sm overflow-auto h-full my-8">
          <table className="border-collapse table-auto w-full text-sm">
            <thead>
              <td className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                Title
              </td>
              <td className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                Year
              </td>
              <td className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                Genre
              </td>
              <td className="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">
                Extract
              </td>
            </thead>

            <tbody className="bg-white dark:bg-slate-800">
              {movies.map((movie) => (
                <tr key={movie.id}>
                  <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-500 dark:text-slate-400">
                    {movie.title}
                  </td>
                  <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-500 dark:text-slate-400">
                    {movie.year}
                  </td>
                  <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-500 dark:text-slate-400">
                    {movie.genre}
                  </td>
                  <td className="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-500 dark:text-slate-400">
                    {movie.extract}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

interface SearchInputProps {
  className?: string;
}

function SearchInput({ className }: SearchInputProps) {
  return (
    <div className={className}>
      <label
        htmlFor="search"
        className="block text-sm font-medium leading-6 text-gray-900 dark:text-slate-400"
      >
        Search
      </label>
      <div className="relative mt-2 rounded-md shadow-sm">
        <input
          type="text"
          name="search"
          id="search"
          className="bg-white dark:bg-slate-800 block w-full rounded-md border-0 py-1.5 pl-7 pr-20 dark:text-slate-400 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          placeholder="E.g. Star Wars"
        />
      </div>
    </div>
  );
}

/** Direct representation of a row in the Movie table. */
interface MovieRecord {
  id: string
  title: string
  year: number
  genre?: string
  extract: string
}