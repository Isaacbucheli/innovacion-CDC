import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import CatalogPage from "@/components/CatalogPage";
import CostsPage from "@/components/costs/CostsPage";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const [section, setSection] = useState<string>("alerts");
  return (
    <>
      <AuthGate>
        {section === "costos" ? (
          <CostsPage onNavigate={setSection} />
        ) : (
          <CatalogPage onNavigate={setSection} />
        )}
      </AuthGate>
      <Toaster position="top-right" />
    </>
  );
}
