import ButtonGradient from "./assets/svg/ButtonGradient";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ValueProposition from "./components/ValueProposition";
import Pipeline from "./components/Pipeline";
import Milestones from "./components/Milestones";

const App = () => {
  return (
    <>
      <div className="pt-[4.75rem] lg:pt-[5.25rem] overflow-hidden">
        <Header />
        <Hero />
        <ValueProposition />
        <Pipeline />
        <Milestones />
        <Footer />
      </div>

      <ButtonGradient />
    </>
  );
};

export default App;
