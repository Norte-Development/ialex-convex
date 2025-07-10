import CaseDetailLayout from "../components/Cases/CaseDetailLayout";

export default function CaseDetailPage() {
  return (
    <CaseDetailLayout>
      <section className="flex w-full h-full justify-center items-center   gap-2">
        <div className="flex flex-col gap-2 justify-center items-center  max-w-[500px]">
          <h1 className="text-2xl font-bold">Bienvenido/a a iAlex</h1>
          <div className="flex flex-col gap-0 text-sm text-gray-500 text-center">
            <p>
              Abri o crea un documento para que iAlex, tu asistente legal con IA
              pueda ayudarte!
            </p>
            <p>
              Si todavia no sabes como empezar, apreta la opcion que mas se
              adapte a tu necesidad
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-[11px] mt-4">
            <button className="bg-white text-gray-500 px-4 py-2 rounded-full cursor-pointer shadow-md hover:shadow-lg transition-shadow">
              Crear un documento
            </button>
            <button className="bg-white text-gray-500 px-4 py-2 rounded-full cursor-pointer shadow-md hover:shadow-lg transition-shadow">
              quiero subir un documento y analizarlo
            </button>
            <button className="bg-white text-gray-500 px-4 py-2 rounded-full cursor-pointer shadow-md hover:shadow-lg transition-shadow">
              Quiero analizar un documento ya subido
            </button>
            <button className="bg-white text-gray-500 px-4 py-2 rounded-full cursor-pointer shadow-md hover:shadow-lg transition-shadow">
              Crear un documento
            </button>
          </div>
        </div>
      </section>
    </CaseDetailLayout>
  );
}
