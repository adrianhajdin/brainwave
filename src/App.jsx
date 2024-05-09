import { Route, Routes } from "react-router-dom";
import Home from "./components/pages/Home";
import Products from "./components/pages/Products";
import PricingPage from "./components/pages/Pricing";
/* import Test from "./components/pages/Test";
import ComponentView from "./components/pages/ComponentView"; */

const App = () => {
    return (
        <div className=" h-[100dvh] w-[100vw] font-primary bg-pageMainBackground overflow-x-hidden">
            <Routes>
                <Route path="/*" element={<Home />} />
                <Route path="/products" element={<Products />}></Route>
                <Route path="/pricing" element={<PricingPage />}></Route>
                {/* <Route path="/test" element={<Test />}></Route>
                <Route path="/component" element={<ComponentView />}></Route> */}
            </Routes>
        </div>
    );
};

export default App;
