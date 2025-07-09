export default function CaseSidebar() {
  return (
    <div className="w-1/3 h-full  bg-red-500 ">
      <h2 className="text-lg font-bold mb-4">Menú del Caso</h2>
      <ul>
        <li className="mb-2">
          <a href="#" className="text-gray-700 hover:text-black">
            Resumen
          </a>
        </li>
        <li className="mb-2">
          <a href="#" className="text-gray-700 hover:text-black">
            Documentos
          </a>
        </li>
        <li className="mb-2">
          <a href="#" className="text-gray-700 hover:text-black">
            Eventos
          </a>
        </li>
      </ul>
    </div>
  );
}
