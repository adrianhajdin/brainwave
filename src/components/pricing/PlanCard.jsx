import React from "react";
import Button from "../Button";
import PropTypes from "prop-types";

export default function PlanCard({ item }) {
    return (
        <div
            key={item.id}
            className="w-[19rem] max-lg:w-full h-full px-6 bg-n-8 border border-n-6 rounded-[2rem] lg:w-auto p-4 text-center [&>h4]:first:text-color-2 [&>h4]:even:text-color-1 [&>h4]:last:text-color-2"
        >
            <h4 className="text-[1.5rem] leading-normal">{item.title}</h4>

            <p className="min-h-[4rem] text-n-1">{item.description}</p>

            <div className="flex items-center h-[1.5rem] mb-2 text-center justify-center">
                {item.price1 && <div className="text-[1rem] leading-none font-bold">{item.price1}</div>}
            </div>
            <div className="flex items-center h-[1.5rem] mb-2 text-center justify-center">
                {item.price2 && <div className="text-[1rem] leading-none font-bold">{item.price2}</div>}
            </div>
            <div className="flex items-center h-[1.5rem] mb-2 text-center justify-center">
                {item.price3 && <div className="text-[1rem] leading-none font-bold">{item.price3}</div>}
            </div>

            <Button className="w-full mb-6 mt-8" href={item.price ? "/pricing" : "#contact"} white={!!item.price}>
                {item.price ? "Get started" : "Contact us"}
            </Button>
        </div>
    );
}

PlanCard.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.number.isRequired,
        title: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        price1: PropTypes.string,
        price2: PropTypes.string,
        price3: PropTypes.string,
        price: PropTypes.bool,
    }).isRequired,
};
