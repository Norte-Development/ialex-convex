import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import EventDateCard from "./EventDateCard";
import { Button } from "../ui/button";
import { Calendar } from "lucide-react";
import AllEventsDialog from "./AllEventsDialog";
import CaseCards from "./CaseCards";
import { useState } from "react";
import { ExistingUserHomeSkeleton } from "./Skeletons";
import { Link } from "react-router-dom";

const ExistingUserHome = () => {
  const casesResult = useQuery(api.functions.cases.getCases, {
    paginationOpts: { numItems: 5, cursor: null },
  });
  const upcomingEvents = useQuery(api.functions.events.getUpcomingEvents, {
    days: 30,
    paginationOpts: { numItems: 10, cursor: null }
  });

  // Show skeleton while loading
  const isLoadingCases = casesResult === undefined;
  const isLoadingEvents = upcomingEvents === undefined;
  const isLoading = isLoadingCases || isLoadingEvents;

  const cases = casesResult?.page || [];
  const events = upcomingEvents?.page || [];

  const [open, setOpen] = useState(false);

  // Show skeleton while data is loading
  if (isLoading) {
    return <ExistingUserHomeSkeleton />;
  }

  return (
    <>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-10"></div>
      <div className="flex flex-col justify-center items-start w-full">
        <p className="text-center font-[400] text-[15px] text-[#666666]">
          O acceda a los casos que visitó recientemente
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full gap-4 mb-10">
          {cases.length > 0 ? (
            cases.map((caseItem) => (
              <CaseCards
                key={caseItem._id}
                id={caseItem._id}
                name={caseItem.title}
              />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No tienes casos activos</p>
          )}
          <div className="flex justify-end col-span-full">
          <Button variant="ghost" >
            <Link to="/casos" className="text-blue-500 underline hover:no-underline hover:text-blue-600">Ver todos los casos</Link>
          </Button>
          </div>
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 mb-10 mt-10">
          {/* Columna 1: Texto y botón */}
          <div className="flex flex-col justify-start items-start gap-4">
            <p className="font-[400] text-[15px] text-[#666666]">
              Estos son tus próximos eventos
            </p>
            <Button
              variant="ghost"
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 underline"
            >
              Ir a calendario
            </Button>
          </div>

          {/* Columna 2: Grid de eventos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {events.length > 0 ? (
              events
                .slice(0, 4)
                .map((event) => <EventDateCard key={event._id} event={event} />)
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-8 text-gray-500">
                <Calendar size={48} className="mb-4 text-gray-300" />
                <p className="text-sm">No tienes eventos próximos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AllEventsDialog open={open} onOpenChange={() => setOpen(!open)} />
    </>
  );
};

export default ExistingUserHome;
