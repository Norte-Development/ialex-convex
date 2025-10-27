import EscritoCard from "./EscritoCard";

interface EscritosGridViewProps {
  escritos: any[] | undefined | null;
}

export default function EscritosGridView({ escritos }: EscritosGridViewProps) {
  if (!escritos || escritos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay escritos para mostrar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {escritos.map((escrito) => (
        <EscritoCard key={escrito._id} escrito={escrito} />
      ))}
    </div>
  );
}
