"use client";

import { CalendarClock, KanbanSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import {
  Dropdown,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  UserChip,
} from "@/components/ui";
import { ConvertDialog, LostReasonDialog, useMoveStage } from "@/features/pipeline/stage-dialogs";
import { useTeamOptions } from "@/features/shared/options";
import { useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useFormat, useMe } from "@/hooks/use-me";
import { label, PIPELINE_STAGES, PRIORITIES, toOptions } from "@/lib/constants";
import type { Board, OpportunityCard } from "@/types";
import { formatMoney } from "@/utils/money";

export default function PipelinePage() {
  const router = useRouter();
  const { can } = useMe();
  const format = useFormat();
  const team = useTeamOptions();
  const [search, setSearch] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("");
  const term = useDebounce(search);
  const params = {
    ...(term ? { search: term } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(priority ? { priority } : {}),
  };
  const {
    data: board,
    isLoading,
    error,
    refetch,
  } = useApiQuery<Board>("/opportunities/board", params, { keepPrevious: true });

  // Shows a dropped card in its new column right away; the refetch after the save confirms it.
  const [pending, setPending] = useState<{ id: string; stage: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [lostCard, setLostCard] = useState<OpportunityCard | null>(null);
  const [wonCard, setWonCard] = useState<OpportunityCard | null>(null);

  const move = useMoveStage();
  const canMove = can("opportunity:write");

  const requestMove = (card: OpportunityCard, to: string) => {
    if (card.stage === to) return;
    if (to === "LOST") return setLostCard(card);
    setPending({ id: card._id, stage: to });
    move.mutate(
      { id: card._id, to },
      {
        onSuccess: () => {
          if (to === "WON" && !card.project) setWonCard(card);
        },
        onSettled: () => setPending(null),
      },
    );
  };

  const onDrop = (event: DragEvent, stage: string) => {
    event.preventDefault();
    setOverStage(null);
    const card = board?.columns
      .flatMap((c) => c.cards)
      .find((c) => c._id === event.dataTransfer.getData("text/plain"));
    if (card) requestMove(card, stage);
  };

  const columns = (board?.columns ?? []).map((column) => ({
    ...column,
    cards: (board?.columns ?? [])
      .flatMap((c) => c.cards)
      .filter((card) => (pending?.id === card._id ? pending.stage : card.stage) === column.stage),
  }));
  const isEmpty = board && columns.every((c) => !c.cards.length);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          board
            ? `${board.conversionRate}% win rate across closed opportunities. Drag cards between stages.`
            : undefined
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px] lg:max-w-3xl">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, company or country"
        />
        {team.length > 0 && (
          <Select
            aria-label="Assigned to"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            options={team}
            placeholder="Anyone"
          />
        )}
        <Select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={toOptions(PRIORITIES)}
          placeholder="All priorities"
        />
      </div>
      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isEmpty ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={KanbanSquare}
            title={
              term || assignedTo || priority
                ? "No opportunities match these filters"
                : "The pipeline is empty"
            }
            description="Each new lead gets a card here automatically."
            action={
              can("lead:write") ? (
                <Link className="text-accent hover:underline" href="/leads?new=1">
                  Add a lead
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6"
          data-testid="pipeline-board"
        >
          {columns.map((column) => (
            <section
              key={column.stage}
              aria-label={label(column.stage)}
              data-stage={column.stage}
              onDragOver={(event) => {
                if (canMove) {
                  event.preventDefault();
                  setOverStage(column.stage);
                }
              }}
              onDragLeave={() => setOverStage((s) => (s === column.stage ? null : s))}
              onDrop={(event) => onDrop(event, column.stage)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-surface-2 ${overStage === column.stage ? "border-accent" : "border-line"}`}
            >
              <header className="border-b border-line px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold">{label(column.stage)}</h2>
                  <span className="tabular text-xs text-ink-3">{column.cards.length}</span>
                </div>
                <p className="tabular mt-0.5 min-h-4 text-xs text-ink-2">
                  {column.totals.map((t) => formatMoney(t.amount, t.currency)).join(" + ")}
                </p>
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                {column.cards.map((card) => (
                  <article
                    key={card._id}
                    draggable={canMove}
                    data-testid="pipeline-card"
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", card._id);
                      setDragging(card._id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={`rounded-lg border border-line bg-surface p-2.5 shadow-card ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${dragging === card._id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button
                        className="min-w-0 cursor-pointer text-left"
                        onClick={() => (card.lead ? router.push(`/leads/${card.lead}`) : undefined)}
                      >
                        <p className="truncate font-medium">{card.contactName || card.title}</p>
                        <p className="truncate text-xs text-ink-3">
                          {[card.companyName, card.country].filter(Boolean).join(" · ")}
                        </p>
                      </button>
                      {canMove && (
                        <Dropdown
                          ariaLabel={`Move ${card.contactName || card.title}`}
                          items={[
                            ...PIPELINE_STAGES.filter((stage) => stage !== card.stage).map(
                              (stage) => ({
                                label: `Move to ${label(stage)}`,
                                onClick: () => requestMove(card, stage),
                              }),
                            ),
                            ...(card.stage === "WON" && !card.project && can("opportunity:convert")
                              ? [
                                  {
                                    label: "Convert to client and project",
                                    onClick: () => setWonCard(card),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      )}
                    </div>
                    {card.value > 0 && (
                      <p className="tabular mt-1.5 font-medium">
                        {formatMoney(card.value, card.currency)}
                      </p>
                    )}
                    {card.service?.name && (
                      <p className="mt-0.5 truncate text-xs text-ink-2">{card.service.name}</p>
                    )}
                    {card.lostReason && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-2">
                        Lost: {card.lostReason}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <UserChip user={card.assignedTo} />
                      <StatusBadge status={card.priority} />
                    </div>
                    {card.nextFollowUpAt && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-2">
                        <CalendarClock className="size-3" aria-hidden />
                        {format.date(card.nextFollowUpAt)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <LostReasonDialog
        open={Boolean(lostCard)}
        onClose={() => setLostCard(null)}
        loading={move.isPending}
        onSubmit={(lostReason) =>
          lostCard &&
          move.mutate(
            { id: lostCard._id, to: "LOST", lostReason },
            { onSuccess: () => setLostCard(null) },
          )
        }
      />
      <ConvertDialog
        opportunity={wonCard}
        onClose={() => setWonCard(null)}
        onConverted={(r) =>
          router.push(r.projectId ? `/projects/${r.projectId}` : `/clients/${r.clientId}`)
        }
      />
    </>
  );
}
