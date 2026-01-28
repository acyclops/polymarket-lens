import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import Market from "./pages/Market";
import Volatility from "./pages/Volatility";
import Status from "./pages/Status";
import Search from "./pages/Search";
import Layout from "./components/Layout";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="topnav">
        <div className="topnav-inner">
          <Link to="/" className="brand">Polymarket Lens</Link>

          <div className="navlinks">
            <NavLink to="/" end className="navlink">Home</NavLink>
            <NavLink to="/status" className="navlink">Status</NavLink>
          </div>
        </div>
      </nav>

      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Volatility />} />
          <Route path="/markets/:slug" element={<Market />} />
          <Route path="/status" element={<Status />} />
          <Route path="/search" element = {<Search />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
