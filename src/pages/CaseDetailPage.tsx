import { useParams } from "react-router-dom";
import CaseDetailLayout from "../components/Cases/CaseDetailLayout";

export default function CaseDetailPage() {
  const { title } = useParams();

  return (
    <CaseDetailLayout>
      <div>
        <h1>Detalle del Caso</h1>
        <p>
          Mostrando información para el caso: <strong>{title}</strong>
        </p>
      </div>
    </CaseDetailLayout>
  );
}
