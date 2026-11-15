import { SectionHead } from "./UI";
import { TEAM } from "../data/team";

/**
 * The team, as a section of its own rather than a bulleted list in a side panel.
 * Five cards, one per person, so names, roles and what each person owns are
 * scannable on a phone and legible on a wide screen.
 */
export function TeamSection() {
  return (
    <section className="team-section" aria-label="The team">
      <SectionHead eyebrow="THE TEAM" title="Skorpe Monad">
        <ul className="team-facts">
          <li>
            <strong>5</strong> people
          </li>
          <li>
            <strong>Sylhet</strong> Bangladesh
          </li>
          <li>
            <strong>2026</strong> NASA Space Apps
          </li>
        </ul>
      </SectionHead>
      <p className="team-lede">
        Five people from Sylhet, Bangladesh, building toward the 2026 NASA Space
        Apps Challenge. Named here because a prototype is only reviewable if you
        know who made it — and who to ask about which part.
      </p>
      <ul className="team-grid">
        {TEAM.map((member) => (
          <li className="team-card" key={member.name}>
            <div className="team-card-head">
              <span className="team-avatar" aria-hidden="true">
                {member.initials}
              </span>
              <div>
                <h3>{member.name}</h3>
                <p className="team-role">{member.role}</p>
              </div>
            </div>
            <p className="team-owns">{member.owns}</p>
          </li>
        ))}
      </ul>
      <p className="team-note">
        Roles describe what each person owns in this prototype; they are not job
        titles, academic credentials or clinical qualifications. One person can
        hold two of them on any given night. AI assistance is disclosed below.
      </p>
    </section>
  );
}
