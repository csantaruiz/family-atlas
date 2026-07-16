import { familyDatabase } from '../../data'

type AboutViewProps = {
  active: boolean
}

export function AboutView({ active }: AboutViewProps) {
  const stats = familyDatabase.stats
  const yearSpan = stats.latestYear - stats.earliestYear

  return (
    <section id="about" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="about">
        <div className="eyebrow">Version 4 · Family records with historical context</div>
        <h2>This is not a family tree. It is a way to experience the distance between generations.</h2>
        <p>
          Family Atlas transforms your genealogical records into a navigable landscape of time. Dates,
          places, and relationships come from the uploaded tree. Narrative context is offered carefully —
          documented facts are distinguished from inferred observations at every layer.
        </p>

        <h3 className="about-subhead">Documented facts and inferred context</h3>
        <p>
          Birth dates, death dates, places, and parent–child links are treated as archival facts drawn
          from your source tree. Historical world events, migration summaries, and pattern observations
          are contextual — they help you see lives against their era without claiming certainty the
          records do not support.
        </p>

        <h3 className="about-subhead">Atlas Thinking</h3>
        <p>
          Atlas Thinking surfaces patterns in the archive — repeated migrations, occupational clusters,
          unusually long lifespans — with explicit confidence levels. Each observation lists the records
          it draws from and the caveats that apply. It is a guide for curiosity, not a verdict.
        </p>

        <h3 className="about-subhead">Sources and confidence</h3>
        <p>
          Featured stories and event panels cite their sources where family research has attached them.
          When a detail is approximate — such as a migration placed between known regions — the Atlas
          says so. Confidence is shown as Low, Medium, or High based on how many independent records
          support an observation.
        </p>

        <h3 className="about-subhead">Finding your way</h3>
        <p>
          <strong>Journey</strong> is the timeline — drag to travel through centuries, scroll to zoom,
          and click any person or event to open the detail panel. <strong>People</strong> is a
          searchable directory of every life in the archive. <strong>Map</strong> shows where the
          family lived and moved. Use &ldquo;View on timeline&rdquo; from People or Map to return to
          Journey centered on relevant years.
        </p>

        <h3 className="about-subhead">Privacy</h3>
        <p>
          This prototype is built for a single family archive. Living people, private documents, and
          sensitive stories should be shared only with relatives you trust. The Atlas is a place for
          preservation and reflection — not public genealogy broadcasting.
        </p>

        <div className="about-grid">
          <div className="about-card">
            <strong>{yearSpan}</strong>
            <span>years represented</span>
          </div>
          <div className="about-card">
            <strong>{stats.people}</strong>
            <span>individual records</span>
          </div>
          <div className="about-card">
            <strong>{stats.earliestYear}</strong>
            <span>earliest recorded birth</span>
          </div>
        </div>
      </div>
    </section>
  )
}
