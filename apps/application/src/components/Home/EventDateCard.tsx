import { Link } from "react-router-dom";

export default function EventDateCard({ event }: { event: any }) {
  function getNameOfMonth(monthNumber: number) {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString("es-ES", { month: "long" });
  }
  // Cortamos el nombre del mes a 3 letras
  const eventDate = getNameOfMonth(new Date(event.date).getMonth() + 1).slice(
    0,
    3,
  );

  return (
    <Link
      to={`/eventos/${event._id}`}
      className="h-[91px] cursor-pointer flex justify-center items-end w-[233px] bg-[#F4F7FC] rounded-3xl"
    >
      <div className="w-[35%]  h-full  border-r-1 border-black flex flex-col justify-center items-center">
        <span className="text-tertiary text-[20px] font-[700] ">
          {new Date(event.date).getDate()}
        </span>
        <span className=" text-tertiary text-[20px] font-[700]">
          {eventDate}
        </span>
      </div>
      <div className="w-[65%]  h-full flex flex-col justify-center items-start pl-3">
        <span className="font-[700]"> {event.name} </span>
        <span className="text-xs text-gray-500 ">
          {" "}
          {event.start} - {event.end}{" "}
        </span>
      </div>
    </Link>
  );
}
