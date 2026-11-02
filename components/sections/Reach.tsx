import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ReachExplorer } from "@/components/reach/ReachExplorer";
import { AS_OF, CITIES, HQ_CITY, NORTHMOST, SOUTHMOST, TOTAL } from "@/components/reach/data";
import { company } from "@/lib/content";

const FIGURE = "display text-[clamp(3rem,6vw,4.75rem)]";

/**
 * 03 · Reach — a 3D twin of the Bay at night: counties rise, a pillar grows at
 * every city with work in progress, and an arc runs from HQ to each one.
 */
export default function Reach() {
  const asOf = AS_OF.charAt(0).toLowerCase() + AS_OF.slice(1);
  return (
    <section id="reach" aria-labelledby="reach-title" className="relative border-t border-hair/60 bg-void py-24 md:py-32">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <SectionHeader
            className="lg:col-span-8"
            id="reach-title"
            index="03"
            kicker="Reach · Active work"
            title="Across the Bay Area."
            intro={`Headquartered in ${HQ_CITY} since ${company.founded}. Every arc on the map leaves our door and ends at work in progress — from ${NORTHMOST} in the north to ${SOUTHMOST} in the south.`}
          />
          {/* Reads as one line: "49 in progress · 23 cities · as of Aug 2026". */}
          <Reveal className="lg:col-span-4 lg:justify-self-end lg:pb-2">
            <p className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <span className="flex flex-col">
                <Counter to={TOTAL} className={`${FIGURE} text-blue-glow`} />
                <span className="eyebrow mt-2 text-fog">in progress</span>
              </span>
              <span className="sr-only"> · </span>
              <span className="flex flex-col">
                <Counter to={CITIES.length} className={`${FIGURE} text-green-glow`} />
                <span className="eyebrow mt-2 text-fog">cities</span>
              </span>
              <span className="sr-only"> · </span>
              <span className="eyebrow pb-1 text-fog">{asOf}</span>
            </p>
          </Reveal>
        </div>
        <ReachExplorer />
      </div>
    </section>
  );
}
