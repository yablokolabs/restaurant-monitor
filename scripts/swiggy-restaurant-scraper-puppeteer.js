import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Function to clean address prefixes
function cleanAddress(address) {
  if (!address || typeof address !== "string") return address;

  // Remove prefixes like "LocationUnit.No." and "Location"
  return address
    .replace(/^Location\s*/i, "")
    .trim();
}

/**
 * Fetches restaurant information from a Swiggy URL using Puppeteer
 * @param {string} url - The Swiggy restaurant URL
 * @returns {Promise<Object>} Restaurant information
 */
async function fetchRestaurantInfo(url) {
  let browser;
  try {
    // Launch the browser
    browser = await puppeteer.launch({
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
      const name = nameElement ? nameElement.textContent.trim() : "Unknown Restaurant";

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
        const elements = document.querySelectorAll(addressSelectors[i]);
        for (let j = 0; j < elements.length; j++) {
          const text = elements[j].textContent.trim();
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
          const text = allDivs[i].textContent.trim();
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
      const openingHours = hoursElement ? hoursElement.textContent.trim() : "Hours not available";

      // Determine if currently open
      let currently = "Status unknown";
      let isOpen = false;

      // Look for status indicators
      const allText = document.body.textContent.toLowerCase();
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
          const hoursData = {};

          // Look for text that contains day names and time ranges
          for (const element of hoursElements) {
            const text = element.textContent.trim();
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

// Main execution
async function main() {
  const urls = [
    "https://www.swiggy.com/restaurants/bk-cafe-global-mall-malleshwaram-560656/dineout",
    "https://www.swiggy.com/restaurants/burger-king-koramangala-5934/dineout",
    "https://www.swiggy.com/restaurants/burger-king-ascends-park-square-itpl-whitefield-65769/dineout",
    "https://www.swiggy.com/restaurants/burger-king-ground-floor-hsr-layout-sectror-3-hsr-57283/dineout",
    "https://www.swiggy.com/restaurants/burger-king-jayanagar-5936/dineout",
  ];

  console.log("Fetching restaurant information for", urls.length, "restaurants...");
  console.log("---");

  // Array to store all restaurant information
  const allRestaurantsInfo = [];

  // Loop through each URL and fetch restaurant info
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`Processing restaurant ${i + 1}/${urls.length}:`, url);

    const restaurantInfo = await fetchRestaurantInfo(url);
    allRestaurantsInfo.push(restaurantInfo);

    console.log("Restaurant Information:");
    console.log("Name:", restaurantInfo.name);
    console.log("Address:", restaurantInfo.address);
    console.log("Opening Hours:", restaurantInfo.openingHours);
    console.log("Currently:", restaurantInfo.currently);
    console.log("Is Open:", restaurantInfo.isOpen);

    if (restaurantInfo.detailedHours) {
      console.log("Detailed Hours:");
      for (const [day, hours] of Object.entries(restaurantInfo.detailedHours)) {
        console.log(`${day}: ${hours}`);
      }
    }

    if (restaurantInfo.error) {
      console.log("Error:", restaurantInfo.error);
    }

    console.log("---");

    // Add a small delay between requests to be respectful to the server
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log("Summary:");
  console.log("Successfully processed", allRestaurantsInfo.length, "restaurants");

  const openRestaurants = allRestaurantsInfo.filter(r => r.isOpen);
  console.log("Open restaurants:", openRestaurants.length);

  return allRestaurantsInfo;
}

// Run the script if executed directly
if (
  typeof process !== "undefined" && process.argv && process.argv[1]
  && (typeof import.meta === "undefined" || import.meta.url === `file://${process.argv[1]}`)
) {
  main();
}

export { fetchRestaurantInfo };
