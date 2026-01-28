import { Outlet } from "react-router-dom";
import SearchBox from "./SearchBox";

export default function Layout() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>

        <div style={{ flex: 1 }}>
          <SearchBox />
        </div>
      </header>

      <Outlet />
    </div>
  );
}
