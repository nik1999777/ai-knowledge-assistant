import { Route, Routes } from "react-router-dom";
import { ArchitecturePage } from "./pages/architecture/ArchitecturePage";
import { DocumentDetailPage } from "./pages/document-detail/DocumentDetailPage";
import { DocumentsPage } from "./pages/documents/DocumentsPage";
import { EvalPage } from "./pages/eval/EvalPage";
import { HomePage } from "./pages/home/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/architecture" element={<ArchitecturePage />} />
      <Route path="/eval" element={<EvalPage />} />
      <Route path="/documents/:docId" element={<DocumentDetailPage />} />
    </Routes>
  );
}
