import Message from "../Products/Message";
import Header from "../Header";
import ProductsList from "../Products/ProductsList";
import Recommendations from "../Products/Recommendations";
import Footer from "../Footer";

export default function Products() {
    return (
        <div className="pt-[4.75rem] lg:pt-[5.25rem] overflow-hidden">
            <Header />
            <Message />
            <ProductsList />
            <Recommendations />
            <Footer />
        </div>
    );
}
