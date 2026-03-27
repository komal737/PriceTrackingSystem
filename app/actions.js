"use server";

import { getLiveAmazonDeals, scrapeProduct, searchCompetitorPrice } from "@/lib/firecrawl";
import { sendPriceDropAlert } from "@/lib/email"; 
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ==========================================
// 1. ADD PRODUCT (Upgraded with Smart Cache + DEMO EMAIL)
// ==========================================
export async function addProduct(formData) {
  const url = formData.get("url");

  if (!url) {
    return { error: "URL is required" };
  }

  // 👇 BACKEND URL VALIDATION 👇
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    const isValidStore = 
      hostname.includes('amazon') || 
      hostname.includes('amzn') || 
      hostname.includes('flipkart');

    if (!isValidStore) {
      return { error: "PriceScout currently only supports Amazon and Flipkart URLs." };
    }
  } catch (error) {
    return { error: "Please enter a valid URL format." };
  }
  // 👆 END VALIDATION 👆

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // ==========================================
    // 🧠 THE SMART CACHE LOGIC (Saves Credits!)
    // ==========================================
    let productData = null;
    let isCached = false;

    // 1. Check if ANY user has scraped this exact URL recently
    const { data: cachedProduct } = await supabase
      .from("products")
      .select("*")
      .eq("url", url)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedProduct) {
      const lastUpdated = new Date(cachedProduct.updated_at).getTime();
      const now = new Date().getTime();
      const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);

      // If the data is less than 24 hours old, reuse it!
      if (hoursSinceUpdate < 24 && false) {
        console.log("♻️ SMART CACHE HIT! Saving 1 Firecrawl credit.");
        productData = {
          productName: cachedProduct.name,
          currentPrice: cachedProduct.current_price,
          currencyCode: cachedProduct.currency,
          productImageUrl: cachedProduct.image_url,
          inStock: cachedProduct.in_stock,
          offers: cachedProduct.offers
        };
        isCached = true;
      }
    }

    // 2. If it's not in the cache (or it's older than 24 hours), call Firecrawl
    if (!isCached) {
      console.log("🔥 Cache miss or stale data. Calling Firecrawl...");
      productData = await scrapeProduct(url);

      if (!productData.productName || !productData.currentPrice) {
        console.log(productData, "productData");
        return { error: "Could not extract product information from this URL" };
      }
    }
    // ==========================================
    // END SMART CACHE LOGIC
    // ==========================================

    const newPrice = parseFloat(productData.currentPrice);
    const currency = productData.currencyCode || "USD";

    // Check if THIS user already has this product (for the UI message)
    const { data: existingUserProduct } = await supabase
      .from("products")
      .select("id, current_price")
      .eq("user_id", user.id)
      .eq("url", url)
      .maybeSingle();

    const isUpdate = !!existingUserProduct;

    // Upsert product (insert or update based on user_id + url)
    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        {
          user_id: user.id,
          url,
          name: productData.productName,
          current_price: newPrice,
          currency: currency,
          image_url: productData.productImageUrl,
          in_stock: productData.inStock !== false, 
          offers: productData.offers || "No special offers detected",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,url",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) throw error;

    // 1. We check if it's an update AND if the price actually dropped
    const priceDropped = isUpdate && newPrice < existingUserProduct.current_price;

    if (priceDropped) {
      console.log("🚨 PRICE DROP DETECTED! Attempting to send email...");
      
      try {
        await sendPriceDropAlert(
          user.email,            // The person logged in
          product,               // The product details
          existingUserProduct.current_price, // The high price you set in Supabase
          newPrice               // The real lower price found by scraper
        );
        console.log("✅ Email sent to:", user.email);
      } catch (emailErr) {
        // This catches if Resend is down or the API key is wrong
        console.error("❌ Email Send Failure:", emailErr.message);
      }
    }
    // --------------------------------------------------

    // Add to price history if it's a new product OR price changed
    const shouldAddHistory = !isUpdate || existingUserProduct.current_price !== newPrice;

    if (shouldAddHistory) {
      await supabase.from("price_history").insert({
        product_id: product.id,
        price: newPrice,
        currency: currency,
      });
    }

    revalidatePath("/");
    return {
      success: true,
      product,
      message: isUpdate
        ? "Product updated with latest price!"
        : "Product added successfully!",
    };
  } catch (error) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
  revalidatePath("/");
revalidatePath("/cart");
}

// ==========================================
// 2. DELETE PRODUCT
// ==========================================
export async function deleteProduct(productId) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) throw error;

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

// ==========================================
// 3. GET PRODUCTS
// ==========================================
export async function getProducts() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

// ==========================================
// 4. GET PRICE HISTORY
// ==========================================
export async function getPriceHistory(productId) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

// ==========================================
// 5. SIGN OUT
// ==========================================
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}

// ==========================================
// 6. GET PRODUCT BY ID
// ==========================================
export async function getProductById(productId) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Get product error:", error);
    return null;
  }
}

// ==========================================
// 7. SAVE TO CART
// ==========================================
export async function saveToCart(productId) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ in_cart: true })
      .eq("id", productId);

    if (error) throw error;
    
    revalidatePath("/cart");
    revalidatePath(`/product/${productId}`);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

// ==========================================
// 8. GET COMPETITOR PRICE (SMART NAME EXTRACTOR + GUARDRAILS)
// ==========================================
export async function getCompetitor(productName, store) {
  try {
    // 1. Remove bracketed specs like (WA80BG4441BGTL, Light Gray)
    let baseName = productName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

    // 2. Keep only the first 4 words (Usually Brand + Series/Model)
    let cleanName = baseName.split(' ').slice(0, 4).join(' ').replace(/,/g, '');

    // 3. THE SMART CATEGORY INJECTOR 🧠
    // If the original title has these words, force them into the search term!
    const importantCategories = [
      "washing machine", "phone", "smartphone", "laptop", "tv", "television", 
      "refrigerator", "fridge", "microwave", "watch", "earbuds", "headphones", 
      "tablet", "monitor", "camera"
    ];

    const origNameLower = productName.toLowerCase();
    
    for (const cat of importantCategories) {
      if (origNameLower.includes(cat) && !cleanName.toLowerCase().includes(cat)) {
        cleanName += ` ${cat}`; // Append the category back on!
        break; // Stop after finding the first matching category
      }
    }

    console.log(`Original Name: ${productName}`);
    console.log(`Smart Cleaned Search: ${cleanName}`);

    // 4. Fetch the competitor result
    const competitorResult = await searchCompetitorPrice(cleanName, store);

    // If Firecrawl timed out or found nothing, safely return null
    if (!competitorResult || !competitorResult.url) {
      return null; 
    }

    // 5. THE URL GUARDRAIL 🛡️ (Prevents showing a Phone when searching for a TV)
    const compUrlLower = competitorResult.url.toLowerCase(); 

    for (const cat of importantCategories) {
      if (origNameLower.includes(cat)) {
        const urlCategory1 = cat.replace(' ', '-'); 
        const urlCategory2 = cat.replace(' ', ''); 
        
        // If it's supposed to be a washing machine, but the URL doesn't say washing machine...
        if (!compUrlLower.includes(urlCategory1) && !compUrlLower.includes(urlCategory2)) {
          console.log(`🚨 Mismatch Prevented! Expected '${cat}', but got wrong item on ${store}.`);
          return null; // Safely trigger "Currently unavailable" UI
        }
      }
    }

    return competitorResult;

  } catch (error) {
    // If Firecrawl throws a network timeout, catch it so the app doesn't crash!
    console.error("Competitor Search Failed gracefully:", error.message);
    return null;
  }
}
// ==========================================
// 9. REFRESH TRENDING DEALS (WITH QUEUE RATE LIMITER)
// ==========================================
export async function refreshTrendingDeals(categoryInput = null) {
  try {
    const supabase = await createClient();
    
    // If a specific category is passed from the UI, scrape just that one.
    // Otherwise, loop through all of them safely.
    const categoriesToScrape = categoryInput 
      ? [categoryInput] 
      : ['electronics', 'kitchen', 'apparel', 'beauty', 'books'];

    const summary = [];

    // 🚦 Loop through them one by one to prevent Amazon 408 Timeouts
    for (const category of categoriesToScrape) {
      console.log(`⏳ Scraping category: ${category}...`);
      
      try {
        const freshDeals = await getLiveAmazonDeals(category);
        
        if (freshDeals && freshDeals.length > 0) {
          // Sort by highest discount first
          const sortedDeals = freshDeals.sort((a, b) => {
            const getDiscount = (d) => parseInt(d?.match(/\d+/)?.[0] || 0);
            return getDiscount(b.discount) - getDiscount(a.discount);
          });

          // Delete old stale deals for this category
          await supabase.from("trending_deals").delete().eq("category", category);
          
          // Prepare new data
          const dealsToSave = sortedDeals.map(deal => ({
            category,
            name: deal.name,
            price: deal.price,
            original_price: deal.original_price || "",
            discount: deal.discount || "",
            image_url: deal.image_url,
            url: deal.url,
            updated_at: new Date().toISOString()
          }));
          
          // Insert new data
          const { error } = await supabase.from("trending_deals").insert(dealsToSave);
          if (error) throw error;
          
          console.log(`✅ Successfully updated: ${category}`);
          summary.push({ category, status: "success" });
        }
      } catch (scrapeErr) {
        console.error(`🚨 Failed to scrape ${category}:`, scrapeErr.message);
        summary.push({ category, status: "failed", error: scrapeErr.message });
      }

      // 🛑 THE MAGIC FIX: If we are scraping multiple categories, wait 3 seconds between them
      if (categoriesToScrape.length > 1) {
        console.log(`⏱️ Waiting 3 seconds before next category to prevent rate-limits...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return { success: true, summary };
  } catch (error) {
    console.error("Global Refresh failed:", error);
    return { error: error.message };
  }
}