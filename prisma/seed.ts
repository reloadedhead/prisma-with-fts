import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

interface Movie {
  title: string;
  year: number;
  genres: string[];
  extract?: string;
  thumbnail?: string;
}

function parseMoviesFile(): Movie[] {
  const rawMovies = readFileSync(path.join(__dirname, "movies.json"));
  return JSON.parse(rawMovies as unknown as string);
}

async function seed() {
  const movies = parseMoviesFile();
  /** Deletes existing data. */
  await prisma.movie.deleteMany();

  /** Creates movies */

  for (const movie of movies) {
    await prisma.movie.create({
      data: {
        title: movie.title,
        year: movie.year,
        genre: movie.genres.at(0),
        extract: movie.extract,
        thumbnail: movie.thumbnail,
      },
    });
  }

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
