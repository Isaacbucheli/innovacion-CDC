import AuthGate from "@/components/AuthGate";
import CatalogPage from "@/components/CatalogPage";

export default function App() {
  return (
    <AuthGate>
      <CatalogPage />
    </AuthGate>
  );
}
