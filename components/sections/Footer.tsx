import { BUILD_YEAR, company, contact, credentials } from "@/lib/content";
import { BrandMark } from "@/components/shell/BrandMark";
import { SECTION_LINKS, STREAM_FILLS } from "@/components/shell/site";

const credential = (label: string) => credentials.find((c) => c.label === label)?.value ?? "";
const LICENSE_LINE = `CA License ${credential("CA Contractor License")} · DIR ${credential("DIR Registration")}`;
const link = "rounded-sm text-mist transition-colors hover:text-chalk";

/** Opaque footer: it scrolls over the fixed 3D stage, so it stacks above it. */
export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-hair bg-void">
      <div className="container-x py-16 md:py-24">
        {/* Two columns on tablets (a 12-column split left the email a 4-column cell it broke inside), 12 from lg. */}
        <div className="grid gap-12 md:grid-cols-2 md:gap-8 lg:grid-cols-12">
          <div className="md:col-span-2 lg:col-span-5">
            <BrandMark className="block h-14 w-auto" />
            <p className="mt-6 text-lg font-bold text-chalk">{company.name}</p>
            <p className="mt-1 text-mist">{company.certification}</p>
            <p className="hud mt-4 text-fog">{LICENSE_LINE}</p>
          </div>

          <nav aria-label="Footer" className="lg:col-span-3">
            <p className="eyebrow text-fog">Sections</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 font-semibold lg:grid-cols-1">
              {SECTION_LINKS.map((l) => (
                <li key={l.id}>
                  <a href={`#${l.id}`} className={link}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <address className="not-italic lg:col-span-4">
            <p className="eyebrow text-fog">Office</p>
            <p className="mt-5 text-chalk">
              {contact.street}
              <br />
              {contact.city}
            </p>
            <p className="mt-4 flex flex-col items-start gap-1 font-semibold">
              <a href={contact.phoneHref} className={link}>
                {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`} className={`${link} [overflow-wrap:anywhere]`}>
                {contact.email}
              </a>
            </p>
          </address>
        </div>

        <div className="mt-14 flex flex-wrap items-end justify-between gap-6 border-t border-hair pt-6">
          <div className="text-sm text-fog">
            <p>
              © {BUILD_YEAR} {company.name}
            </p>
            {/* Required until AAM approves this page for publication. */}
            <p className="mt-1">Concept draft — not an official website of {company.name}</p>
          </div>
          <a href="#top" className={`group hud inline-flex items-center gap-3 ${link}`}>
            <span aria-hidden className="flex flex-col gap-[3px]">
              {STREAM_FILLS.map((fill) => (
                <span
                  key={fill}
                  className={`block h-[2px] w-5 ${fill} transition-transform ease-out group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5`}
                />
              ))}
            </span>
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
