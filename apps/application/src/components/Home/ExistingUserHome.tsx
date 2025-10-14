import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import NewCaseCard from "./NewCaseCard";
import EventDateCard from "./EventDateCard";
import { Button } from "../ui/button";
import { CircleArrowRight, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ExistingUserHome = () => {
  const navigate = useNavigate();
  const casesResult = useQuery(api.functions.cases.getCases, {});
  const upcomingEvents = useQuery(api.functions.events.getUpcomingEvents, {
    days: 30,
  });

  const cases = casesResult || [];
  const events = upcomingEvents || [];

  console.log("cases", cases);
  console.log("events", events);

  return (
    <>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-10"></div>
      <div className="flex flex-col justify-center items-start w-full">
        <p className="text-center font-[400] text-[24px] text-tertiary">
          Vuelve a tu trabajo
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full gap-4 mb-10">
          {cases.length > 0 ? (
            cases.map((caseItem) => (
              <NewCaseCard key={caseItem._id} caseItem={caseItem} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No tienes casos activos</p>
          )}
        </div>

        <p className="text-center font-[400] text-[24px] text-tertiary">
          Próximos Eventos
        </p>
        <div className="mt-10 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {events.length > 0 ? (
            events
              .slice(0, 3)
              .map((event) => <EventDateCard key={event._id} event={event} />)
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-8 text-gray-500">
              <Calendar size={48} className="mb-4 text-gray-300" />
              <p className="text-sm">No tienes eventos próximos</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => navigate("/eventos")}
              >
                Crear evento
              </Button>
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="flex w-full justify-end items-center mb-10">
            <Button
              variant={"secondary"}
              size={"lg"}
              className="text-black"
              onClick={() => navigate("/eventos")}
            >
              Ver todos <CircleArrowRight className="inline text-primary" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default ExistingUserHome;
