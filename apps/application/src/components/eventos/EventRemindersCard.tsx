import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EventRemindersCardProps {
  reminderMinutes: number[];
}

export default function EventRemindersCard({
  reminderMinutes,
}: EventRemindersCardProps) {
  const formatReminder = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutos antes`;
    } else if (minutes < 1440) {
      return `${Math.floor(minutes / 60)} horas antes`;
    } else {
      return `${Math.floor(minutes / 1440)} días antes`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recordatorios</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {reminderMinutes.map((minutes, index) => (
            <li key={index} className="text-sm text-gray-700">
              • {formatReminder(minutes)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
