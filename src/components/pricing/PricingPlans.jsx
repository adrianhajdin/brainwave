import React from "react";
import { pricing } from "../../constants";
import PlanCard from "./PlanCard";
import Table from "./Table";
import { tablesData } from "../../constants/plans";
import Section from "../Section";

export default function PricingPlans() {
    return (
        <Section className="overflow-hidden" id="plans">
            <div className="container relative z-2">
                <div className="grid grid-cols-4 gap-6 m-4">
                    <div className="col-span-1 flex flex-col justify-end">
                        <div className="mt-auto text-color-1 ml-4 font-bold">Title</div>
                    </div>
                    <div className="col-span-3 grid grid-cols-3 gap-6 m-4">
                        {pricing.map((item) => (
                            <PlanCard key={item.id} item={item} />
                        ))}
                    </div>
                </div>
                <div className="w-full">
                    {tablesData.map((table, index) => (
                        <Table key={index} data={table} />
                    ))}
                </div>
            </div>
        </Section>
    );
}
