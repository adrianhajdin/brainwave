import { valueProps } from "../constants";
import Heading from "./Heading";
import Section from "./Section";

const ValueProposition = () => {
  return (
    <Section id="about">
      <div className="container relative z-2">
        <Heading
          className="md:max-w-md lg:max-w-2xl"
          title="Targeting Neuronal Survival at the Cellular Level"
        />

        <div className="max-w-3xl mx-auto mb-12 lg:mb-16">
          <p className="body-1 text-n-2 mb-6">
            Neurons comprise the foundation of our sensory and cognitive
            capabilities. Unlike other cell types, 99.9% of neurons persist
            throughout our lifetime, making their preservation critical to human
            health and function.
          </p>
          <p className="body-1 text-n-2">
            Our research has identified key biological mechanisms that protect
            neurons from degeneration. Beginning with unmet needs in retinal
            disease, our approach addresses fundamental processes with broad
            applicability to conditions including Alzheimer&apos;s disease,
            Parkinson&apos;s disease, and amyotrophic lateral sclerosis.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {valueProps.map((item) => (
            <div
              key={item.id}
              className="p-8 bg-n-7 border border-n-6 rounded-2xl"
            >
              <h5 className="h5 mb-4">{item.title}</h5>
              <p className="body-2 text-n-3">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

export default ValueProposition;
