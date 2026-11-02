import { activeByCity, pastProjects, stats } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import BrandMarquee from "@/components/work/BrandMarquee";
import PhotoReel from "@/components/work/PhotoReel";
import ProjectGrid from "@/components/work/ProjectGrid";

/** All active jobs; the grid shows a curated, clearly named subset of them. */
const activeTotal = Object.values(activeByCity).reduce((a, b) => a + b, 0);
/** "As of …" for the job data, read from the stat that counts the same jobs (dropped if they diverge). */
const asOf = stats.find((s) => s.value === activeTotal)?.note;
const completed = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(pastProjects);

/**
 * 04 · Work. Current projects (all in progress) behind a sector filter, field photos on
 * a draggable reel with a lightbox, completed work, and the equipment brands we install.
 * Opaque, so it scrolls over the fixed 3D stage.
 */
export default function Work() {
  return (
    <section id="work" aria-labelledby="work-title" className="relative border-t border-hair bg-deep">
      <div
        aria-hidden
        className="blueprint pointer-events-none absolute inset-x-0 top-0 h-[36rem] opacity-50 [mask-image:linear-gradient(to_bottom,#000,transparent)]"
      />

      <div className="container-x relative pt-28 md:pt-36">
        <SectionHeader
          id="work-title"
          index="04"
          kicker="Work · Current projects"
          title="On site across the Bay, right now."
          intro={`A selection of the ${activeTotal} jobs our crews have in progress — hotels, stores, schools, housing, restaurants and civic work. Filter by sector.`}
        />
        <ProjectGrid asOf={asOf} />
        <Reveal className="mt-14 border-t border-hair pt-6 md:mt-16">
          <p className="text-[17px] leading-relaxed text-chalk">
            <span className="eyebrow mr-4 text-fog">Completed work includes</span>
            <span className="font-semibold">{completed}.</span>
          </p>
        </Reveal>
      </div>

      <PhotoReel />

      <div className="container-x relative pb-28 pt-20 md:pb-36 md:pt-24">
        <BrandMarquee />
      </div>
    </section>
  );
}
