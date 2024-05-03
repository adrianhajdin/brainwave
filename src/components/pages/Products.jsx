import Card from "../Products/Card";
import { products } from "../../constants/products";

export default function Products() {
    return (
        <div className="overflow-hidden">
            <div className="grid grid-cols-4 gap-6 m-4">
                {products.map((item) => (
                    <Card key={item.id} product={item} />
                ))}
            </div>
        </div>
    );
}
