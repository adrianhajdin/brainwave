import React from "react";
import Section from "../Section";
import Heading from "../Heading";
import Card from "./Card";
import { products, requiredProducts } from "../../constants/products";

export default function ProductsList() {
    return (
        <Section className="overflow-hidden" id="productsList">
            <div className="container relative z-2 mt-32">
                <Heading tag="For a better experience" title={<strong>Mandatory products</strong>} />
            </div>
            <div className="container relative z-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 m-4">
                    {requiredProducts.map((item) => (
                        <Card key={item.id} product={item} />
                    ))}
                </div>
            </div>
            <div className="container relative z-2 mt-32">
                <Heading tag="The best for you" title={<strong>Our recommended products</strong>} />
            </div>
            <div className="container relative z-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 m-4">
                    {products.map((item) => (
                        <Card key={item.id} product={item} />
                    ))}
                </div>
            </div>
        </Section>
    );
}
