import CaseCards from "./CaseCards";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Case } from "types/cases";
import NewCaseCard from "./NewCaseCard";
import EventDateCard from "./EventDateCard";
import { Button } from "../ui/button";
import { CircleArrowRight } from "lucide-react";

const eventsWithDate = [
  {
    _id: "1",
    name: "Evento 1",
    date: "2024-10-10",
    start: "10:00",
    end: "12:00",
  },
  {
    _id: "2",
    name: "Evento 2",
    date: "2024-11-15",
    start: "14:00",
    end: "16:00",
  },
  {
    _id: "3",
    name: "Evento 3",
    date: "2024-12-20",
    start: "09:00",
    end: "11:00",
  },
];

const ExistingUserHome = () => {
  const casesResult = useQuery(api.functions.cases.getCases, {});

  const cases = casesResult || [];

  return (
    <>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1  gap-10 "></div>
      <div className="flex flex-col justify-center  items-start w-full">
        <p className="text-center font-[400] text-[24px] text-tertiary">
          Vuelve a tu trabajo
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full  gap-4 mb-10 ">
          {cases.map((caseItem) => (
            <NewCaseCard key={caseItem._id} caseItem={caseItem} />
          ))}
        </div>
        <p className="text-center font-[400] text-[24px] text-tertiary">
          Proximos Eventos
        </p>
        <div className="mt-10 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {eventsWithDate.map((event) => (
            <EventDateCard key={event._id} event={event} />
          ))}
        </div>
        <div className="flex w-full justify-end  items-center mb-10">
          <Button variant={"secondary"} size={"lg"} className="text-black">
            Ver todos <CircleArrowRight className="inline text-primary" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default ExistingUserHome;
