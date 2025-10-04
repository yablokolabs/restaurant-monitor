import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RestaurantStatus = {
  id: string;
  name: string;
  address: string;
  expected: boolean;
  actual: boolean;
  mismatch: boolean;
  opening_hours: string;
  last_checked_at: string;
  url: string;
};

export function useRestaurantStatus() {
  const [data, setData] = useState<RestaurantStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching data from Supabase...");
        const { data, error } = await supabase
          .from("restaurant_status")
          .select("id, name, address, expected, actual, mismatch, opening_hours, last_checked_at, url")
          .order("last_checked_at", { ascending: false });

        console.log("Supabase response:", { data, error });

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        console.log("Data fetched successfully:", data);
        setData(data || []);
      } catch (err) {
        console.error("Error fetching restaurant status:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel("restaurant-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_status" },
        (payload) => {
          console.log("Real-time update received:", payload);
          // Refresh the data when there are changes
          fetchData();
        },
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
      });

    return () => {
      console.log("Cleaning up Supabase channel");
      supabase.removeChannel(channel);
    };
  }, []);

  console.log("useRestaurantStatus hook returning:", { data, loading, error });
  return { data, loading, error };
}
