export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
    </main>
  );
}
