import type { ExpenseView, TaskSummaryView } from "@datum/core";
import { ExpenseStatusChip } from "@/components/status/expense-status-chip";
import { formatWireMoney } from "@/lib/format";
import { taskSummaryTitle } from "./task-list";

function ExpenseRow({
  expense,
  task,
}: {
  expense: ExpenseView;
  task: TaskSummaryView | undefined;
}) {
  return (
    <li className="flex gap-4 py-4">
      <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg">
        <img
          src={expense.receiptUrl}
          alt="Receipt photo"
          loading="lazy"
          className="size-14 rounded-lg border border-line bg-raised object-cover"
        />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-base text-ink tabular-nums">
            {formatWireMoney(expense.amount)}
          </span>
          <ExpenseStatusChip status={expense.status} />
        </div>
        <p className="mt-1 text-sm break-words text-muted">
          {expense.merchant ?? "Shop not given"}
          {task === undefined ? "" : ` · ${taskSummaryTitle(task)}`}
        </p>
        <p className="mt-1 text-sm break-words text-ink">{expense.explanation}</p>
      </div>
    </li>
  );
}

export function ExpenseList({
  expenses,
  tasks,
}: {
  expenses: readonly ExpenseView[];
  tasks: readonly TaskSummaryView[];
}) {
  if (expenses.length === 0) {
    return <p className="mt-4 text-sm text-muted">No print receipt yet.</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-line border-y border-line">
      {expenses.map((expense) => (
        <ExpenseRow
          key={expense.id}
          expense={expense}
          task={tasks.find((task) => task.id === expense.taskId)}
        />
      ))}
    </ul>
  );
}
