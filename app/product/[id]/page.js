//C:\Users\chobh\Desktop\DealDrop\smart-product-price-tracker\app\product\[id]\page.js
"use client";

import { useEffect, useState } from "react";
import { getProductById, getPriceHistory, saveToCart, getCompetitor } from "@/app/actions";
import PriceChart from "@/components/PriceChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// 👇 Added 'Tag' icon here
import { ExternalLink, ShoppingCart, CheckCircle, ShieldCheck, AlertCircle, Tag } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { use } from "react";

export default function ProductPage({ params }) {
  const resolvedParams = use(params);
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Competitor States
  const [competitorData, setCompetitorData] = useState(null);
  const [loadingCompetitor, setLoadingCompetitor] = useState(true);

  useEffect(() => {
    async function loadData() {
      const p = await getProductById(resolvedParams.id);
      const h = await getPriceHistory(resolvedParams.id);
      setProduct(p);
      setHistory(h);

      // Trigger the background competitor search!
      if (p) {
        // Now checks for uppercase and shortened amzn.to links!
        const isAmazon = p.url.toLowerCase().includes("amazon") || p.url.toLowerCase().includes("amzn"); 
        const storeToSearch = isAmazon ? "flipkart" : "amazon";
        const compData = await getCompetitor(p.name, storeToSearch);
        setCompetitorData(compData);
        setLoadingCompetitor(false);
      }
    }
    loadData();
  }, [resolvedParams.id]);

  if (!product) return <div className="text-center py-20">Loading...</div>;

  const handleSaveToCart = async () => {
    setSaving(true);
    const res = await saveToCart(product.id);
    if (res.success) {
      toast.success("Added to your Cart!");
      setProduct({ ...product, in_cart: true });
    }
    setSaving(false);
  };

  const isAmazon = product.url.toLowerCase().includes("amazon") || product.url.toLowerCase().includes("amzn");
  const compStoreName = isAmazon ? "Flipkart" : "Amazon";
// 👇 SMARTER AI BUY VERDICT LOGIC 👇
  let aiVerdict = { 
    title: "Analyzing Data...", 
    text: "Please wait while we check historical prices.",
    color: "bg-gray-50 border-gray-300", 
    textColor: "text-gray-800",
    iconBg: "bg-gray-200 text-gray-600",
    icon: AlertCircle 
  };

  if (history.length > 0) {
    // 1. Safely clean the numbers (Removes any accidental commas like "12,999" -> 12999)
    const cleanPrice = (val) => parseFloat(String(val).replace(/,/g, ''));
    
    const pastPrices = history.map(h => cleanPrice(h.price));
    const current = cleanPrice(product.current_price);
    
    // 2. Find the absolute lowest price in history
    const lowestHistoricalPrice = Math.min(...pastPrices);
    
    if (history.length === 1) {
      // If there is only 1 dot on the chart, we don't have enough history to make a judgment!
      aiVerdict = { 
        title: "Tracking Started 🕒", 
        text: "We just started tracking this item today. Check back later to see if the price drops!",
        color: "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-500", 
        textColor: "text-blue-900",
        iconBg: "bg-blue-500 text-white",
        icon: ShieldCheck 
      };
    } else if (current > lowestHistoricalPrice) {
      // Current price is HIGHER than the past lowest price -> WAIT
      aiVerdict = { 
        title: "Wait! (Price has been lower) 📉", 
        text: `Our AI detected this item was previously priced at ₹${lowestHistoricalPrice}. Don't overpay—wait for a drop!`,
        color: "bg-gradient-to-br from-red-50 to-rose-100 border-red-500", 
        textColor: "text-red-900",
        iconBg: "bg-red-500 text-white",
        icon: AlertCircle 
      };
    } else {
      // Current price is EQUAL to or LOWER than the historical lowest -> BUY
      aiVerdict = { 
        title: "Buy Now! (Lowest Price Tracked) 🚀", 
        text: "This is the lowest price we've tracked for this item. It's a great time to buy!",
        color: "bg-gradient-to-br from-green-50 to-emerald-100 border-green-500", 
        textColor: "text-green-900",
        iconBg: "bg-green-500 text-white",
        icon: ShieldCheck 
      };
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>
        {product.in_cart ? (
          <Button disabled variant="outline" className="text-green-600 border-green-600 bg-green-50 shrink-0">
            <CheckCircle className="w-4 h-4 mr-2" /> Saved in Cart
          </Button>
        ) : (
          <Button onClick={handleSaveToCart} disabled={saving} className="bg-orange-500 hover:bg-orange-600 shrink-0">
            <ShoppingCart className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save to Cart"}
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Column: Image & AI Verdict */}
        <div className="col-span-1 flex flex-col items-center">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full flex justify-center h-72 mb-6">
            {product.image_url ? (
              <img src={product.image_url} alt="Product" className="max-h-full object-contain" />
            ) : (
              <div className="text-gray-400">No Image</div>
            )}
          </div>
          
          {/* --- UPGRADED PRICESCOUT AI ALERT --- */}
          <div className={`w-full p-5 border-l-4 rounded-r-xl shadow-sm ${aiVerdict.color}`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 p-3 rounded-full shadow-md ${aiVerdict.iconBg}`}>
                <aiVerdict.icon className="w-6 h-6" />
              </div>
              
              <div>
                <h3 className={`text-lg font-extrabold flex items-center gap-2 tracking-tight ${aiVerdict.textColor}`}>
                  ✨ PriceScout AI
                </h3>
                <p className={`mt-1 text-md font-bold ${aiVerdict.textColor}`}>
                  {aiVerdict.title}
                </p>
                <p className={`mt-1 text-sm leading-relaxed ${aiVerdict.textColor} opacity-90`}>
                  {aiVerdict.text}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Competitor */}
        <div className="col-span-2 space-y-6">
          
          {/* Tracked Store */}
<div className={`p-6 mt-4 rounded-xl border-2 relative ${isAmazon ? 'border-orange-400 bg-orange-50/50' : 'border-blue-400 bg-blue-50/50'}`}>
  
  {/* --- UPGRADED BIG STOCK BADGE --- */}
  <div className={`absolute -top-5 right-4 px-5 py-2 rounded-full font-black text-sm uppercase tracking-wider shadow-md flex items-center gap-2 border-2 ${
    product.in_stock === false 
      ? "bg-red-50 text-red-700 border-red-500" 
      : "bg-green-50 text-green-700 border-green-500"
  }`}>
    {product.in_stock === false ? (
      <><AlertCircle className="w-5 h-5" /> Out of Stock</>
    ) : (
      <><CheckCircle className="w-5 h-5 text-green-600" /> In Stock</>
    )}
  </div>

  <h3 className="font-bold text-xl mb-4 mt-2">{isAmazon ? 'Amazon' : 'Flipkart'} (Tracked)</h3>
            {/* --- UPGRADED OFFERS SECTION --- */}
            {product.offers && product.offers !== "No special offers detected" && (
              <div className="mt-4 mb-6 p-4 bg-white/80 border border-orange-200 rounded-xl shadow-sm">
                <h4 className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-2 uppercase tracking-wide">
                  <Tag className="w-4 h-4" /> Available Offers
                </h4>
                <p className="text-sm text-gray-800 leading-relaxed font-medium">
                  {product.offers}
                </p>
              </div>
            )}
            
            <Button asChild className={isAmazon ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"}>
              <Link href={product.url} target="_blank">View on Store <ExternalLink className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>

          {/* Competitor Auto-Search Store */}
          <div className="p-6 rounded-xl border border-gray-200 bg-white flex flex-col justify-center shadow-sm">
            <h3 className="font-bold text-gray-500 mb-2">{compStoreName} Price</h3>
            
            {loadingCompetitor ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500">Searching {compStoreName}...</p>
              </div>
            ) : competitorData ? (
              <div className="flex items-center justify-between">
                <p className="text-3xl font-extrabold text-gray-800">₹ {competitorData.price}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={competitorData.url} target="_blank">View on {compStoreName} <ExternalLink className="w-3 h-3 ml-2" /></Link>
                </Button>
              </div>
            ) : (
              <p className="text-red-500 font-medium">Currently unavailable on {compStoreName}</p>
            )}
          </div>

        </div>
      </div>

      <div className="mt-12 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6">Price History</h2>
        <div className="h-80 w-full">
          <PriceChart productId={product.id} />
        </div>
      </div>
    </div>
  );
}