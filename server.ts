import cors from "@fastify/cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Fastify from "fastify";
import fetch from "node-fetch";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add stealth plugin to avoid detection
(puppeteer as any).use(StealthPlugin());

// Load environment variables from .env file
dotenv.config();

// 🔑 Use your Supabase URL and Anon Key from environment variables
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || "";

const supabase = createClient(supabaseUrl, supabaseKey);

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: ["http://localhost:3001", "http://localhost:3002", "http://127.0.0.1:3001", "http://127.0.0.1:3002"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

// Function to clean address prefixes
function cleanAddress(address: string): string {
  if (!address || typeof address !== "string") return address;

  // Remove prefixes like "LocationUnit.No." and "Location"
  return address
    .replace(/^Location\s*/i, "")
    .trim();
}

// Utility function to send Slack alerts for mismatches
async function sendSlackAlert(restaurant: any) {
  try {
    if (!slackWebhookUrl) {
      console.warn("Slack webhook URL not configured. Skipping Slack notification.");
      return;
    }

    // Format the timestamp
    const now = new Date();
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // IST is UTC+5:30
    const formattedTime = istTime.toISOString().replace("T", " ").substring(0, 19) + " IST";

    // Create the message payload
    const message = {
      text: `⚠️ Mismatch detected!
Restaurant: ${restaurant.name}
Expected: ${restaurant.expected ? "OPEN" : "CLOSED"}
Actual: ${restaurant.actual ? "OPEN" : "CLOSED"}
Address: ${restaurant.address}
Time: ${formattedTime}`,
    };

    // Send the POST request to Slack
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with status ${response.status}`);
    }

    console.log(`✅ Slack alert sent for restaurant: ${restaurant.name}`);
  } catch (error) {
    console.error(`❌ Failed to send Slack alert for restaurant ${restaurant.name}:`, error);
  }
}

// Enhanced function to determine if a restaurant should be open based on detailed hours
function getExpectedFromDetailedHours(detailedHours: { [key: string]: string }): boolean {
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayIndex = now.getDay();
  const currentDay = dayNames[currentDayIndex];

  // Check if detailedHours has the current day as a key
  if (!detailedHours || !currentDay || !(currentDay in detailedHours)) {
    return false;
  }

  // Get today's hours
  const todayHours = detailedHours[currentDay];
  if (!todayHours) return false;

  // Parse the opening hours string (e.g., "11:00AM - 11:59PM")
  const parts = todayHours.split(" - ");
  if (parts.length !== 2) return false;

  const openTime = parts[0] || "";
  const closeTime = parts[1] || "";
  const currentTime = now.getHours() * 100 + now.getMinutes(); // e.g., 13:30 becomes 1330

  // Convert times to 24-hour format numbers
  const parseTime = (timeStr: string): number => {
    const isPM = timeStr.includes("PM");
    const timeParts = timeStr.replace(/(AM|PM)/, "").split(":");
    let hours = parseInt(timeParts[0] || "0", 10);
    let minutes = parseInt(timeParts[1] || "0", 10);

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    return hours * 100 + minutes;
  };

  const openTime24 = parseTime(openTime);
  const closeTime24 = parseTime(closeTime);

  // Handle overnight hours (e.g., 11:00AM - 11:59PM)
  if (closeTime24 < openTime24) {
    // Restaurant is open overnight
    return currentTime >= openTime24 || currentTime < closeTime24;
  } else {
    // Normal hours
    return currentTime >= openTime24 && currentTime < closeTime24;
  }
}

// Function to determine if a restaurant should be open based on hours text or detailed hours
function getExpectedFromHoursText(detailedHours?: { [key: string]: string }): boolean {
  // Use detailed hours if available
  if (detailedHours && Object.keys(detailedHours).length > 0) {
    return getExpectedFromDetailedHours(detailedHours);
  }

  // Fallback to simple time check if no detailed hours available
  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes();

  // Default business hours (11:00 AM to 11:00 PM)
  const businessStart = 1100;
  const businessEnd = 2300;

  return currentTime >= businessStart && currentTime < businessEnd;
}

/**
 * Fetches restaurant information from a Swiggy URL using Puppeteer
 * @param {string} url - The Swiggy restaurant URL
 * @returns {Promise<Object>} Restaurant information
 */
async function fetchRestaurantInfo(url: string) {
  let browser: any;
  try {
    // Launch the browser
    browser = await (puppeteer as any).launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );

    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for the restaurant info to load
    await page.waitForSelector("h1", { timeout: 10000 });

    // Extract restaurant information
    const restaurantInfo = await page.evaluate(() => {
      // Get restaurant name
      const nameElement = document.querySelector("h1")
        || document.querySelector("[data-testid*=\"restaurant-name\"]")
        || document.querySelector("[class*=\"Name\"]");
      const name = nameElement ? nameElement.textContent!.trim() : "Unknown Restaurant";

      // Get address - try multiple selectors and approaches
      let address = "Unknown Address";
      const addressSelectors = [
        "[class*=\"Address\"]",
        "[data-testid*=\"address\"]",
        "[class*=\"Location\"]",
        "[class*=\"location\"]",
        "[class*=\"address\"]",
      ];

      // Try each selector
      for (let i = 0; i < addressSelectors.length; i++) {
        const elements = document.querySelectorAll(addressSelectors[i]!);
        for (let j = 0; j < elements.length; j++) {
          const text = elements[j]!.textContent!.trim();
          // Filter out placeholder text
          if (text && !text.includes("Setup your precise location") && text.length > 10) {
            address = text;
            break;
          }
        }
        if (address !== "Unknown Address" && !address.includes("Setup your precise location")) {
          break;
        }
      }

      // If still not found, try looking for divs with location-like text
      if (address === "Unknown Address" || address.includes("Setup your precise location")) {
        const allDivs = document.querySelectorAll("div");
        for (let i = 0; i < allDivs.length; i++) {
          const text = allDivs[i]!.textContent!.trim();
          // Look for text that looks like an address (contains street, number, etc.)
          if (
            text && text.length > 15
            && (text.includes("Bangalore") || text.includes("Karnataka")
              || text.includes("Mall") || text.includes("Global") || text.match(/\d+/))
          ) {
            address = text;
            break;
          }
        }
      }

      // Get opening hours
      const hoursElement = document.querySelector("[class*=\"Timing\"]")
        || document.querySelector("[data-testid*=\"timing\"]")
        || document.querySelector("[class*=\"Hours\"]");
      const openingHours = hoursElement ? hoursElement.textContent!.trim() : "Hours not available";

      // Determine if currently open
      let currently = "Status unknown";
      let isOpen = false;

      // First try to get status from the serviceability status message
      const statusElement = document.querySelector('[data-testid="rdp_serviceability_status_message"]');
      if (statusElement) {
        const statusText = statusElement.textContent?.trim().toLowerCase() || '';
        // Check for 'closed' first to handle cases like 'CLOSED, OPENS AT 10AM' correctly
        if (statusText.includes('close')) {
          currently = "Closed";
          isOpen = false;
        } else if (statusText.includes('open')) {
          currently = "Open";
          isOpen = true;
        }
      }

      // Fallback to text-based detection if specific element not found
      if (currently === "Status unknown") {
        const allText = document.body.textContent!.toLowerCase();
        if (
          allText.includes("currently open") || allText.includes("open now")
          || (allText.includes("open") && !allText.includes("closed"))
        ) {
          currently = "Open";
          isOpen = true;
        } else if (
          allText.includes("currently closed") || allText.includes("closed now")
          || allText.includes("closed")
        ) {
          currently = "Closed";
          isOpen = false;
        }
      }

      // Return basic info
      return {
        name,
        address,
        openingHours,
        currently,
        isOpen,
      };
    });

    // Clean the address
    restaurantInfo.address = cleanAddress(restaurantInfo.address);

    // Now try to click the timing button to get detailed hours
    try {
      // Wait a bit for all elements to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for a timing or hours button and click it
      const timingButtonSelectors = [
        "[class*=\"Timing\"]",
        "[class*=\"Hours\"]",
        "[data-testid*=\"timing\"]",
        "button[class*=\"Timing\"]",
        "button[class*=\"Hours\"]",
        "div[class*=\"Timing\"]",
        "div[class*=\"Hours\"]",
      ];

      let timingButton = null;
      for (const selector of timingButtonSelectors) {
        try {
          timingButton = await page.$(selector);
          if (timingButton) {
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (timingButton) {
        // Click the timing button
        await timingButton.click();

        // Wait for the popup to appear
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract detailed hours from the popup
        const detailedHours = await page.evaluate(() => {
          // Look for elements that contain detailed hours information
          const hoursElements = Array.from(document.querySelectorAll("div, span, p"));
          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const hoursData: { [key: string]: string } = {};

          // Look for text that contains day names and time ranges
          for (const element of hoursElements) {
            const text = element.textContent!.trim();
            // Check if this element contains a day name
            for (const day of days) {
              if (text.includes(day) && text.match(/\d+/)) {
                // Extract the time range
                const timeMatch = text.match(/(\d{1,2}[A-Z]{2}\s*-\s*\d{1,2}[:\d]*[A-Z]{2})/i);
                if (timeMatch) {
                  hoursData[day] = timeMatch[1];
                }
              }
            }
          }

          // If we didn't find structured data, try to get all text from a popup-like element
          if (Object.keys(hoursData).length === 0) {
            const popupElements = document.querySelectorAll(
              "[class*=\"popup\"], [class*=\"modal\"], [role=\"dialog\"]",
            );
            for (const popup of popupElements) {
              const popupText = popup.textContent;
              // Look for day-time patterns
              const lines = popupText.split("\n");
              for (const line of lines) {
                const trimmedLine = line.trim();
                for (const day of days) {
                  if (trimmedLine.includes(day) && trimmedLine.match(/\d+/)) {
                    const timeMatch = trimmedLine.match(/(\d{1,2}[A-Z]{2}\s*-\s*\d{1,2}[:\d]*[A-Z]{2})/i);
                    if (timeMatch) {
                      hoursData[day] = timeMatch[1];
                    }
                  }
                }
              }
            }
          }

          return Object.keys(hoursData).length > 0 ? hoursData : null;
        });

        if (detailedHours) {
          restaurantInfo.detailedHours = detailedHours;
        }
      }
    } catch (clickError) {
      // If we can't click or extract detailed hours, that's okay
      console.log("Could not extract detailed hours:", clickError.message);
    }

    return restaurantInfo;
  } catch (error) {
    console.error("Error fetching restaurant info:", error);
    return {
      name: "Error",
      address: "Error",
      openingHours: "Error",
      currently: "Error",
      isOpen: false,
      error: error.message,
    };
  } finally {
    // Close the browser
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function to retry a function with a specified number of attempts
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = baseDelay * attempt; // Linear backoff
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`All ${maxAttempts} attempts failed`);
  throw lastError;
};

// Add a new function to scrape data from Swiggy using Puppeteer
async function scrapeSwiggyData() {
  console.log("Scraping data from Swiggy using Puppeteer...");

  // Store results in an array
  const scrapedResults: any[] = [];

  // Bangalore restaurant locations for Swiggy
  const urls = [
    "https://www.swiggy.com/restaurants/bk-cafe-global-mall-malleshwaram-560656/dineout",
    "https://www.swiggy.com/restaurants/burger-king-koramangala-5934/dineout",
    "https://www.swiggy.com/restaurants/burger-king-ascends-park-square-itpl-whitefield-65769/dineout",
    "https://www.swiggy.com/restaurants/burger-king-ground-floor-hsr-layout-sectror-3-hsr-57283/dineout",
    "https://www.swiggy.com/restaurants/burger-king-jayanagar-5936/dineout",
  ];

  // Process each URL
  for (const url of urls) {
    try {
      console.log(`Scraping ${url}`);
      const restaurantInfo = await withRetry(
        () => fetchRestaurantInfo(url),
        3, // max attempts
        2000, // initial delay of 2 seconds
      );

      // Only add restaurants without errors
      if (!(restaurantInfo as any).error) {
        // Determine expected status based on available hours data
        let expectedStatus;
        if ((restaurantInfo as any).detailedHours) {
          // Use detailed hours if available
          expectedStatus = getExpectedFromDetailedHours((restaurantInfo as any).detailedHours);
        } else {
          // Fall back to basic hours parsing
          expectedStatus = getExpectedFromHoursText((restaurantInfo as any).openingHours);
        }

        scrapedResults.push({
          name: (restaurantInfo as any).name,
          address: (restaurantInfo as any).address,
          openingHours: (restaurantInfo as any).openingHours,
          detailedHours: (restaurantInfo as any).detailedHours,
          expected: expectedStatus,
          actual: (restaurantInfo as any).isOpen,
          mismatch: expectedStatus !== (restaurantInfo as any).isOpen,
          url: url, // Add the URL to the scraped data
        });
      } else {
        console.error(`Error scraping ${url}:`, (restaurantInfo as any).error);
      }

      // Add a small delay between requests to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }

  console.log(`Scraped ${scrapedResults.length} restaurants from Swiggy`);
  return scrapedResults;
}

app.get("/", async () => {
  return { message: "✅ Scraper service is up! Use /scrape to fetch data." };
});

// Replace the /scrape endpoint to focus only on our hardcoded restaurants
app.get("/scrape", async () => {
  console.log("🚀 Starting scraping approach with live Swiggy data using Puppeteer...");

  try {
    // Use the live scraping function instead of the hardcoded one
    const scrapedData = await scrapeSwiggyData();

    // Process results for database insertion
    const dbResults = scrapedData.map(result => {
      // Determine which opening hours to display (detailed if available, otherwise basic)
      const displayHours = result.detailedHours || result.openingHours;

      return {
        name: `Swiggy - ${result.name}`,
        address: result.address,
        opening_hours: typeof displayHours === "string" ? displayHours : JSON.stringify(displayHours),
        expected: result.expected,
        actual: result.actual,
        mismatch: result.mismatch,
        url: result.url, // Include the URL in the database results
      };
    });

    // ✅ Use upsert with proper handling of unique constraint
    const { error } = await supabase
      .from("restaurant_status")
      .upsert(
        dbResults.map(r => ({
          name: r.name,
          address: r.address,
          opening_hours: r.opening_hours,
          expected: r.expected,
          actual: r.actual,
          mismatch: r.mismatch,
          url: r.url,
          last_checked_at: new Date().toISOString(),
        })),
        {
          onConflict: "name,address", // Specify the columns for conflict resolution
        },
      );

    if (error) {
      console.error("Supabase upsert error:", error);
      return { success: false, error: error.message };
    }

    // Send Slack alerts for any mismatches
    for (const restaurant of scrapedData) {
      if (restaurant.mismatch) {
        await sendSlackAlert(restaurant);
      }
    }

    return { success: true, count: scrapedData.length, results: scrapedData };
  } catch (error: any) {
    console.error(`❌ Error scraping restaurants:`, error);
    return { success: false, error: error.message || String(error) };
  }
});

app.listen({ port: 3000 }, () => {
  console.log("✅ Fastify scraper running on /scrape");
});
