export function PageHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">{title}</h1>
    </div>
  );
}
