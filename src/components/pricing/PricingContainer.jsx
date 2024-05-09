import React, { useState, useEffect } from "react";
import PricingAccordion from "./PricingAccordion";
import PricingPlans from "./PricingPlans";

export default function PricingContainer() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 1024);
        };

        handleResize();

        window.addEventListener("resize", handleResize);

        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div>
            {isMobile ? (
                <>
                    <PricingAccordion />
                </>
            ) : (
                <>
                    <PricingPlans />
                </>
            )}
        </div>
    );
}
