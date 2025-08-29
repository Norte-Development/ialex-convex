import DataBaseTable from "@/components/DataBase/DataBaseTable";

export default function DataBasePage() {

  return (
    <section
      className={`w-[70%] h-full min-h-screen mt-18 bg-white flex py-5 px-5 flex-col gap-5 `}
    >
      <DataBaseTable/>
    </section>
  );
}
