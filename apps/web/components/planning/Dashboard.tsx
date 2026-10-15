import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChartIcon,
  CheckSquareIcon,
  FolderIcon,
  InboxIcon,
  PlayIcon,
  TargetIcon,
} from "@/components/shell/icons";

// Presentational pieces of the Today dashboard. All data is computed by the
// page from the same plan the rest of Today uses — nothing here invents state.

export function DashCard({
  title,
  headingId,
  action,
  icon,
  className,
  children,
}: {
  title: string;
  headingId: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={["dash-card", className].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
    >
      <div className="dash-card-head">
        <h2 id={headingId}>
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="card-link">
      {children} <ArrowRightIcon size={16} />
    </Link>
  );
}

type Stat = {
  label: string;
  value: number | string;
  tone: "sage" | "caramel" | "walnut";
  icon: "check" | "calendar" | "chart" | "inbox";
  href?: string;
};

const STAT_ICONS: Record<Stat["icon"], ComponentType<{ size?: number }>> = {
  check: CheckSquareIcon,
  calendar: CalendarIcon,
  chart: ChartIcon,
  inbox: InboxIcon,
};

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <ul className="stat-tiles" aria-label="Today at a glance">
      {stats.map((stat) => {
        const StatIcon = STAT_ICONS[stat.icon];
        const body = (
          <>
            <span className={`icon-tile icon-tile-${stat.tone}`}>
              <StatIcon size={22} />
            </span>
            <span className="stat-text">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </span>
          </>
        );
        return (
          <li key={stat.label} className="stat-tile">
            {stat.href ? (
              <Link href={stat.href} className="stat-tile-link">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface ScheduleEntry {
  id: string;
  time: string;
  title: string;
  detail: string;
  minutes: number;
  /** A calendar meeting rather than a suggested task block. */
  event?: boolean;
}

export function ScheduleCard({
  entries,
  allDay = [],
}: {
  entries: ScheduleEntry[];
  allDay?: string[];
}) {
  let tone = 0;
  return (
    <DashCard title="Today’s schedule" headingId="schedule-heading">
      {allDay.length > 0 && (
        <ul className="all-day-events" aria-label="All-day events">
          {allDay.map((title, index) => (
            <li key={`${title}-${index}`}>{title}</li>
          ))}
        </ul>
      )}
      {entries.length === 0 ? (
        <p className="field-hint">No blocks fit today’s usable time yet.</p>
      ) : (
        <ol className="timeline">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`timeline-item ${entry.event ? "timeline-event" : `timeline-tone-${tone++ % 3}`}`}
            >
              <span className="timeline-time">{entry.time}</span>
              <span className="timeline-block">
                <span className="timeline-text">
                  <strong>{entry.title}</strong>
                  <span>{entry.detail}</span>
                </span>
                <span className="timeline-duration">{formatMinutes(entry.minutes)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="field-hint">
        Suggested blocks — tasks move only when you decide.
        {entries.some((entry) => entry.event) && " Dashed blocks are from your calendar."}
      </p>
    </DashCard>
  );
}

export function FocusCard({
  taskId,
  title,
  minutes,
}: {
  taskId: string;
  title: string;
  minutes: number;
}) {
  return (
    <DashCard
      title="Focus session"
      headingId="focus-card-heading"
      icon={<TargetIcon size={22} />}
      className="focus-card"
    >
      <div className="focus-card-body">
        <div>
          <p className="focus-card-time">{minutes}:00</p>
          <p className="field-hint">{title}</p>
        </div>
        <Link href={`/focus?task=${taskId}`} className="btn btn-primary">
          <PlayIcon size={16} /> Focus mode
        </Link>
      </div>
    </DashCard>
  );
}

export interface ProjectProgress {
  id: string;
  name: string;
  done: number;
  total: number;
}

export function ProjectsCard({ projects }: { projects: ProjectProgress[] }) {
  if (projects.length === 0) return null;
  return (
    <DashCard
      title="Projects"
      headingId="projects-card-heading"
      action={<CardLink href="/projects">View all</CardLink>}
    >
      <ul className="project-grid">
        {projects.map((project, index) => {
          const percent = Math.round((project.done / project.total) * 100);
          return (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`} className="project-tile">
                <span className={`icon-tile icon-tile-${index % 2 ? "sage" : "caramel"}`}>
                  <FolderIcon size={22} />
                </span>
                <span className="project-tile-body">
                  <span className="project-tile-head">
                    <strong>{project.name}</strong>
                    <span>{percent}%</span>
                  </span>
                  <span className="field-hint">
                    {project.done} of {project.total} tasks done
                  </span>
                  <span
                    className={`progress progress-${index % 2 ? "sage" : "caramel"}`}
                    aria-hidden="true"
                  >
                    <span style={{ width: `${percent}%` }} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </DashCard>
  );
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
