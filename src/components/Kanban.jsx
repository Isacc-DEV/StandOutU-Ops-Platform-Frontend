export default function Kanban({ lanes = [] }) {
  return (
    <div className="flex w-full gap-4 overflow-x-auto pb-2">
      {lanes.map(lane => (
        <section
          key={lane.key}
          className="flex min-w-[240px] flex-col gap-3 rounded-2xl border border-indigo-100/80 bg-indigo-50/60 p-3 shadow-sm"
        >
          <header className="flex items-center justify-between text-sm font-semibold text-indigo-700">
            <span>{lane.title}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-indigo-500 shadow">{lane.items.length}</span>
          </header>
          <div className="flex flex-col gap-2">
            {lane.items.map(item => (
              <article
                key={item.id}
                className="rounded-xl border border-white bg-white p-3 text-sm shadow-sm shadow-indigo-100"
              >
                {lane.render ? lane.render(item) : item.title}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
