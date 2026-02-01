import { milestones } from "../constants";
import Heading from "./Heading";
import Section from "./Section";

const Milestones = () => {
  return (
    <Section className="overflow-hidden" id="news">
      <div className="container relative z-2">
        <Heading
          tag="Company History"
          title="Key Milestones"
        />

        <div className="max-w-3xl mx-auto">
          {milestones.map((item) => (
            <div
              key={item.id}
              className="flex gap-6 md:gap-10 mb-8 last:mb-0"
            >
              <div className="shrink-0 w-24 md:w-32 text-right">
                <span className="font-code text-sm font-bold text-color-1 uppercase tracking-wider">
                  {item.date}
                </span>
              </div>

              <div className="relative pb-8 border-l border-n-6 pl-6 md:pl-10 last:pb-0">
                <div className="absolute -left-[0.3125rem] top-1 w-2.5 h-2.5 rounded-full bg-color-1" />

                <div className="flex items-center gap-3 mb-2">
                  <h4 className="h5">{item.title}</h4>
                  <span
                    className={`text-xs font-code font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      item.status === "done"
                        ? "bg-color-4/10 text-color-4"
                        : "bg-color-2/10 text-color-2"
                    }`}
                  >
                    {item.status === "done" ? "Complete" : "In Progress"}
                  </span>
                </div>

                <p className="body-2 text-n-3">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

export default Milestones;
