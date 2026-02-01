import Section from "./Section";
import { logo } from "../assets";
import { socials } from "../constants";

const Footer = () => {
  return (
    <Section className="!px-0 !py-0">
      <div className="bg-n-1 text-n-8">
        <div className="container py-16">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <img
                src={logo}
                width={190}
                height={40}
                alt="SunRegen Healthcare"
                className="mb-6 brightness-0 invert"
              />
              <p className="text-n-8/60 mb-6 max-w-sm text-sm leading-relaxed">
                Developing neuroprotective therapies for degenerative retinal
                diseases with potential applications across neurodegenerative
                conditions.
              </p>
              <ul className="flex gap-4">
                {socials.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    className="flex items-center justify-center w-10 h-10 bg-n-8/10 rounded-full transition-colors hover:bg-n-8/20"
                  >
                    <img
                      src={item.iconUrl}
                      width={16}
                      height={16}
                      alt={item.title}
                      className="brightness-0 invert"
                    />
                  </a>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4 text-n-8">Quick Links</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#hero" className="text-n-8/60 hover:text-n-8 transition-colors">Home</a></li>
                <li><a href="#about" className="text-n-8/60 hover:text-n-8 transition-colors">About</a></li>
                <li><a href="#science" className="text-n-8/60 hover:text-n-8 transition-colors">Science</a></li>
                <li><a href="#news" className="text-n-8/60 hover:text-n-8 transition-colors">News</a></li>
                <li><a href="#investors" className="text-n-8/60 hover:text-n-8 transition-colors">Investors</a></li>
                <li><a href="#contact" className="text-n-8/60 hover:text-n-8 transition-colors">Contact</a></li>
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">Careers</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4 text-n-8">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">Terms of Use</a></li>
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">Imprint</a></li>
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h4 className="font-semibold mb-4 text-n-8">Connect</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">LinkedIn</a></li>
                <li><a href="#" className="text-n-8/60 hover:text-n-8 transition-colors">Email Updates</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-n-8/10 mt-12 pt-8 text-sm text-n-8/40">
            <p className="mb-2">
              © {new Date().getFullYear()} SunRegen Healthcare AG. All rights reserved.
            </p>
            <p className="mb-4">
              SunRegen Healthcare AG | Basel, Switzerland
            </p>
            <p className="text-xs text-n-8/30 max-w-3xl">
              This website contains forward-looking statements regarding future
              products, development plans, and business strategies. Actual
              results may differ materially. Nothing on this site constitutes
              medical or investment advice.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default Footer;
