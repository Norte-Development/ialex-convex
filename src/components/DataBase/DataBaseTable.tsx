import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { AppSkeleton } from "../Skeletons";
import { NationalNormativeDocument, ProvinceNormativeDocument } from "../../../types/legal_database";

export default function DataBaseTable() {
  const fetchLegalDb = useAction(api.functions.legalDb.fetchLegalDb);

  const { data: documents = [], isLoading, error } = useQuery<NationalNormativeDocument[] | ProvinceNormativeDocument[], Error>({
    queryKey: ["legalDocuments"],
    queryFn: () => fetchLegalDb({}),
    staleTime: 5 * 60 * 1000,
  });

  const getDocumentCategory = (doc: NationalNormativeDocument | ProvinceNormativeDocument) => {
    return 'category' in doc ? doc.category : doc.type;
  };

  if (isLoading) {
    return <AppSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        Error loading legal documents: {error.message}
      </div>
    );
  }

  return (
    <Table className="bg-white">
      <TableHeader className="bg-gray-200 border-b border-gray-300">
        <TableRow>
          <TableHead>Titulo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Numero</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc: NationalNormativeDocument | ProvinceNormativeDocument, index: number) => (
          <TableRow key={doc.id || index}>
            <TableCell>{doc.title}</TableCell>
            <TableCell>{getDocumentCategory(doc)}</TableCell>
            <TableCell>{doc.number}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
