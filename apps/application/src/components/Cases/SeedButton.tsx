import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function SeedButton() {
  const seedCases = useMutation(api.functions.seedCases.seedCases);

  const handleSeed = async () => {
    try {
      const result = await seedCases({});
      alert(result);
    } catch (error) {
      alert("Error: " + error);
    }
  };

  return <button onClick={handleSeed}>Crear casos de prueba</button>;
}
