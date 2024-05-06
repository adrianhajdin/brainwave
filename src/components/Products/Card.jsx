import React from "react";
import PropTypes from "prop-types";

export default function Card({ product }) {
    return (
        <div
            key={product.id}
            className="card w-full h-full p-5 bg-n-8 border border-n-6 rounded-xl flex flex-col justify-center cursor-pointer"
            onClick={() => window.open(product.url)}
        >
            <div className="flex justify-center">
                <img src={product.photo} alt="product" className="rounded-sm max-w-full object-fit: contain max-h-56" />
            </div>
            <div className="flex flex-col text-center items-center">
                {" "}
                <h2 className="text-color-2 font-bold text-lg mt-4">{product.title}</h2>
                <p className="mt-2">{product.description}</p>
            </div>
        </div>
    );
}

Card.propTypes = {
    product: PropTypes.shape({
        id: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired,
        photo: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
    }).isRequired,
};
