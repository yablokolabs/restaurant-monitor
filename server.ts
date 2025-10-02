import { createClient } from "@supabase/supabase-js";
import Fastify from "fastify";
import fetch from "node-fetch";
import OpeningHours from "opening_hours";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// 🔑 Use your Supabase URL and Anon Key from environment variables
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

const app = Fastify();

function getExpected(opening: string | undefined): boolean {
  if (!opening) return false;
  try {
    const oh = new OpeningHours(opening);
    return oh.getState(new Date()); // true=open, false=closed
  } catch {
    return false;
  }
}

function getActual(expected: boolean): boolean {
  // 80% chance actual = expected, 20% mismatch (for demo realism)
  return Math.random() < 0.8 ? expected : !expected;
}

app.get("/", async () => {
  return { message: "✅ Scraper service is up! Use /scrape to fetch data." };
});

app.get("/scrape", async () => {
  const query = `
    [out:json][timeout:25];
    node["amenity"="restaurant"](51.3,-0.5,51.7,0.3);
    out 5;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error("Overpass API did not return JSON:", text.slice(0, 200));
    throw new Error("Invalid Overpass API response");
  }

  const results = (data.elements || []).map((el: any) => {
    const expected = getExpected(el.tags.opening_hours);
    const actual = getActual(expected);

    return {
      name: el.tags.name,
      address: `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"] || ""}`.trim(),
      opening_hours: el.tags.opening_hours || "Unknown",
      expected,
      actual,
      mismatch: expected !== actual,
      lat: el.lat,
      lon: el.lon,
    };
  });

  // ✅ Use upsert instead of insert
  const { error } = await supabase
    .from("restaurant_status")
    .upsert(results, {
      onConflict: "name,address",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("Supabase upsert error:", error);
    return { success: false, error };
  }

  return { success: true, count: results.length, results };
});

app.listen({ port: 3000 }, () => {
  console.log("✅ Fastify scraper running on /scrape");
});
