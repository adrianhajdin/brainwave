import { check } from "../assets";
import { pipeline } from "../constants";
import Heading from "./Heading";
import Section from "./Section";

const Pipeline = () => {
  return (
    <Section className="overflow-hidden" id="science">
      <div className="container relative z-2">
        <Heading
          tag="Our Pipeline"
          title="A Differentiated Approach to Neuroprotection"
        />

        <p className="body-1 max-w-3xl mx-auto mb-12 text-n-2 text-center lg:mb-16">
          Our platform is based on modulation of cellular pathways critical for
          neuronal survival under degenerative stress. Unlike symptomatic
          treatments, our therapeutic strategy addresses underlying disease
          biology with the potential to slow or halt disease progression.
        </p>

        <div className="flex gap-6 max-lg:flex-wrap">
          {pipeline.map((item) => (
            <div
              key={item.id}
              className="w-full lg:w-1/3 px-6 py-8 bg-n-8 border border-n-6 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="h4 text-color-1">{item.name}</h4>
                <span className="text-xs font-code font-bold uppercase tracking-wider px-3 py-1 bg-color-1/10 text-color-1 rounded-full">
                  {item.status}
                </span>
              </div>

              <p className="body-2 text-n-3 mb-2">
                <span className="font-semibold text-n-1">Indication:</span>{" "}
                {item.indication}
              </p>

              <p className="body-2 text-n-3 mb-6">
                <span className="font-semibold text-n-1">Route:</span>{" "}
                {item.route}
              </p>

              <ul>
                {item.highlights.map((highlight, index) => (
                  <li
                    key={index}
                    className="flex items-start py-3 border-t border-n-6"
                  >
                    <img
                      src={check}
                      width={24}
                      height={24}
                      alt="Check"
                      className="mt-0.5 shrink-0"
                    />
                    <p className="body-2 ml-4">{highlight}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

export default Pipeline;
