"use client";

import { useState } from "react";
// 👇 Import the actions we created/updated
import { deleteProduct, updateTargetPrice, refreshProduct } from "@/app/actions";
import PriceChart from "./PriceChart";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Trash2, TrendingDown, ChevronDown, ChevronUp, Tag, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner"; // Assuming you use sonner for toasts

export default function ProductCard({ product }) {
  const [showChart, setShowChart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [targetPrice, setTargetPrice] = useState(product.target_price || "");
  const [savingTarget, setSavingTarget] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Remove this product from tracking?")) return;
    setDeleting(true);
    await deleteProduct(product.id);
  };

  // ⚡ UPDATED: Now calls the Server Action to trigger instant email
  const handleSaveTarget = async () => {
    if (!targetPrice) return toast.error("Please enter a target price");
    setSavingTarget(true);
    
    const res = await updateTargetPrice(product.id, targetPrice);
    
    setSavingTarget(false);
    if (res.error) toast.error("Failed to save target");
    else toast.success("Target saved! Checking for alerts... 📧");
  };

  // ⚡ NEW: Manual refresh button for the demo
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    toast.info("Scraping live price...");
    const res = await refreshProduct(product.id);
    setIsRefreshing(false);
    if (res?.success) toast.success("Price updated!");
  };

  // 👇 AI BUY VERDICT LOGIC 👇
  let aiVerdict = { text: "Analyzing...", color: "bg-gray-100 text-gray-800", icon: AlertCircle };
  if (product.target_price) {
    if (parseFloat(product.current_price) <= parseFloat(product.target_price)) {
      aiVerdict = { text: "Buy Now! (Target Reached)", color: "bg-green-100 text-green-800 border-green-300", icon: ShieldCheck };
    } else {
      aiVerdict = { text: "Wait (Price is High)", color: "bg-red-100 text-red-800 border-red-300", icon: AlertCircle };
    }
  } else {
    aiVerdict = { text: "Set a target price for verdict", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: AlertCircle };
  }

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      
      {/* AI VERDICT BANNER */}
      <div className={`w-full p-2 flex items-center justify-center gap-2 text-sm font-semibold ${aiVerdict.color}`}>
        <aiVerdict.icon className="w-4 h-4" />
        {aiVerdict.text}
      </div>

      <CardHeader className="pb-3">
        <div className="flex gap-4">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-md border" />
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{product.name}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-3xl font-bold text-orange-500">
                {product.currency} {product.current_price}
              </span>
              <Badge variant={product.in_stock === false ? "destructive" : "secondary"}>
                {product.in_stock === false ? "Out of Stock" : "In Stock"}
              </Badge>
              
              {/* 🔄 REFRESH BUTTON */}
              <button 
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter bg-white border border-gray-200 px-2 py-1 rounded shadow-sm hover:bg-gray-50 active:scale-95 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Checking..." : "Check Now"}
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        
        {/* TRUE PRICE OFFERS */}
        {product.offers && (
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
            <Tag className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-0.5">True Price Offers</p>
              <p className="text-sm text-blue-800 line-clamp-2">{product.offers}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)} className="gap-1">
            {showChart ? <><ChevronUp className="w-4 h-4" /> Hide Chart</> : <><ChevronDown className="w-4 h-4" /> Show Chart</>}
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1">
            <Link href={product.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /> View Product</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1 ml-auto">
            <Trash2 className="w-4 h-4" /> Remove
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1 font-medium">Set Target Alert Price</p>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                placeholder="e.g. 15000" 
                value={targetPrice} 
                onChange={(e) => setTargetPrice(e.target.value)} 
                className="border rounded px-2 py-1 w-24 text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
              />
              <Button size="sm" onClick={handleSaveTarget} disabled={savingTarget} className="bg-black text-white hover:bg-gray-800">
                {savingTarget ? "..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {showChart && (
        <CardFooter className="pt-0 bg-gray-50 border-t mt-4 p-4">
          <PriceChart productId={product.id} />
        </CardFooter>
      )}
    </Card>
  );
}