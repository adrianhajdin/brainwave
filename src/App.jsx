import { Route, Routes } from "react-router-dom";
import Home from "./components/pages/Home";
import Products from "./components/pages/Products";
import Test from "./components/pages/Test";

const App = () => {
    return (
        <div className=" h-[100dvh] w-[100vw] font-primary bg-pageMainBackground overflow-x-hidden">
            <Routes>
                <Route path="/*" element={<Home />} />
                <Route path="/products" element={<Products />}></Route>
                <Route path="/test" element={<Test />}></Route>
            </Routes>
        </div>
    );
};

export default App;
