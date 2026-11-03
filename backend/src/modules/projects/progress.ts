/**
 * Progress is the share of completed work items (milestones and top-level or sub tasks), excluding
 * cancelled ones. A project with no work items reports 0, never an invented figure.
 */
export function calculateProgress(items: { status: string }[]) {
  const counted = items.filter((item) => item.status !== "CANCELLED");
  if (!counted.length) return 0;
  const done = counted.filter((item) => item.status === "COMPLETED").length;
  return Math.floor((done / counted.length) * 100);
}
