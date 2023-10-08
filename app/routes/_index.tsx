import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Movies" }];

export default function Index() {
  return (
    <main className="relative min-h-screen bg-white sm:flex sm:items-center sm:justify-center">
      <span>Hello</span>
    </main>
  );
}
