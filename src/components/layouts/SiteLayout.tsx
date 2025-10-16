import Header from "@/components/Header";
import { Outlet } from "react-router-dom";

const SiteLayout = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default SiteLayout;
