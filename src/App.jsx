import ButtonGradient from "./assets/svg/ButtonGradient";
import Benefits from "./components/Benefits";
import Collaboration from "./components/Collaboration";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Pricing from "./components/Pricing";
import Roadmap from "./components/Roadmap";
import Services from "./components/Services";
import CallToAction from "./components/CallToAction";

const App = () => {
  return (
    <>
      <div className="pt-[4.75rem] lg:pt-[5.25rem] overflow-hidden">
        <Header />
        <Hero />
        <Roadmap />
        <Benefits />
        {/* <Collaboration /> */}
        {/* <Services /> */}
        {/* <Pricing /> */}
        <CallToAction />
        <Footer />
      </div>

      <ButtonGradient />
    </>
  );
};

export default App;
