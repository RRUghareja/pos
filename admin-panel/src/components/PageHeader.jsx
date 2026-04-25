export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-center justify-between px-8 py-6 bg-white border-b">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}
