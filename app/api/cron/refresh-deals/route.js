//C:\Users\chobh\Desktop\DealDrop\smart-product-price-tracker\app\api\cron\refresh-deals\route.js
import { refreshTrendingDeals } from "@/app/actions";
import { NextResponse } from "next/server";

export async function GET(request) {
  // 1. Security Check: Ensure only Vercel can trigger this
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const categories = ["electronics", "apparel", "kitchen", "beauty", "books"];
  
  try {
    console.log("🚀 Starting Daily Cron Refresh...");
    
    // 1. Get the current day of the week (0 = Sunday, 1 = Monday, etc.)
    const currentDay = new Date().getDay();
    
    // 2. Use the modulo operator (%) to pick ONE category based on the day
    const categoryToScrape = categories[currentDay % categories.length];
    
    console.log(`Today is day ${currentDay}. Scraping ONLY: ${categoryToScrape}`);
    
    // 3. Only run the scraper for that single category
    await refreshTrendingDeals(categoryToScrape);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully refreshed ${categoryToScrape} deals.` 
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}