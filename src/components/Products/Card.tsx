import React from 'react';

export default function Card({ product }) {
  return (
    <div
      key={product.id}
      className="card w-full h-full p-3 bg-n-8 border border-n-6 rounded-xl flex flex-col justify-center cursor-pointer"
      onClick={() => window.open(product.url)}
    >
      <div className="flex justify-center">
        <img src={product.photo} alt="product" className="rounded-sm max-w-full object-fit: contain max-h-72" />
      </div>
      <div className="flex flex-col text-center">
        <h2 className="text-color-2 font-bold text-lg mt-4">{product.title}</h2>
        <p className="mt-2">{product.description}</p>
      </div>
    </div>
  );
}


