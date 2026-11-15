/**
 * The team, in one place.
 *
 * "Owns" describes the part of the prototype each person is responsible for, not
 * a job title or a credential. The About page says so in its own words, because a
 * research prototype is only reviewable if you know who made it and who to ask.
 */
export type TeamMember = {
  name: string;
  initials: string;
  role: string;
  owns: string;
};

export const TEAM: TeamMember[] = [
  {
    name: "Tufayel Ahmed",
    initials: "TA",
    role: "Team lead · developer & designer",
    owns: "Product direction, the interface, the deterministic engine and the releases.",
  },
  {
    name: "Annapurna Das Protyasha",
    initials: "AP",
    role: "Researcher · concept",
    owns: "The health question, the literature and the wording that keeps claims honest.",
  },
  {
    name: "Rakthim Deb Rudro",
    initials: "RR",
    role: "Advisor · methodological review",
    owns: "Challenging the statistics, the baseline rules and what we are not allowed to claim.",
  },
  {
    name: "Mir Shahi Ahmad",
    initials: "MA",
    role: "Data scientist",
    owns: "NASA OSD-575 preparation, the data checks and the numbers behind the charts.",
  },
  {
    name: "Tonusri Deb Diggi",
    initials: "TD",
    role: "Video & photo editor",
    owns: "The pitch film, the judging film and the visual assets used across the dossiers.",
  },
];
