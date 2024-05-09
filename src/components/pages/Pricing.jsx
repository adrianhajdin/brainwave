import ButtonGradient from "../../assets/svg/ButtonGradient";
import Footer from "../Footer";
import Header from "../Header";
import Pricing from "../Pricing";
import PricingPlans from "../pricing/PricingPlans";
import PricingAccordion from "../pricing/PricingAccordion";

export default function PricingPage() {
    return (
        <>
            <div className="pt-[4.75rem] lg:pt-[5.25rem] ">
                <Header />
                <Pricing />
                <PricingPlans />
                <PricingAccordion />
                <Footer />
            </div>

            <ButtonGradient />
        </>
    );
}
