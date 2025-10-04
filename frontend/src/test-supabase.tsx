import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

async function testSupabase() {
  console.log("Testing Supabase connection...");

  try {
    const { data, error } = await supabase
      .from("restaurant_status")
      .select("*")
      .limit(5);

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log("Supabase data:", data);
    console.log("Row count:", data?.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

testSupabase();

export function TestSupabase() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Attempting to fetch data from Supabase...");
        const { data, error } = await supabase
          .from("restaurant_status")
          .select("*")
          .limit(5);

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        console.log("Data fetched successfully:", data);
        setData(data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Supabase Test Results</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
