import React from "react";
import Section from "../Section";
import Heading from "../Heading";
import Card from "./Card";
import { products } from "../../constants/products";

export default function ProductsList() {
    return (
        <Section className="overflow-hidden" id="productsList">
            <div className="container relative z-2">
                <Heading tag="Get started" title={<strong>Our recommended products</strong>} />
            </div>
            <div className="container relative z-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 m-4">
                    {products.map((item) => (
                        <Card key={item.id} product={item} />
                    ))}
                </div>
            </div>
        </Section>
    );
}
