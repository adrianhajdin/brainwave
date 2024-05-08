import React from "react";
import { plans, tablesData } from "../../constants/plans";
import PlanCard from "./PlanCard";
import Table from "./Table";
import Section from "../Section";
import StickyBox from "react-sticky-box";

export default function PricingPlans() {
    return (
        <Section id="plans" className="sticky">
            <div className="container relative z-2">
                <StickyBox offsetTop={85} className="z-10">
                    <div className="grid grid-cols-4 gap-6 m-4 bg-white">
                        <div className="col-span-1 flex flex-col justify-end">
                            <div className="mt-auto text-color-1 ml-4 font-bold text-xl mb-2">Title</div>
                        </div>
                        <div className="col-span-3 grid grid-cols-3 gap-6 m-4">
                            {plans.map((item) => (
                                <PlanCard key={item.id} item={item} />
                            ))}
                        </div>
                    </div>
                </StickyBox>

                <div className="w-full">
                    {tablesData.map((table, index) => (
                        <Table key={table.id} data={table} />
                    ))}
                </div>
            </div>
        </Section>
    );
}
