import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, TrendingUp, Star, Clock, Eye, Heart,
  ArrowRight, Globe, LayoutGrid, Flame, Zap
} from "lucide-react";

interface App {
  id: string;
  name: string;
  description: string;
  creator: string;
  category: string;
  thumbnail_url?: string;
  view_count: number;
  like_count: number;
  created_at: string;
  preview_html?: string;
  prompt?: string;
}

interface Props {
  apps: App[];
  onOpenApp: (app: App) => void;
  onLikeApp: (appId: string) => void;
  onCloneApp: (app: App) => void;
}

const categories = [
  { id: "featured", label: "Featured", icon: Star },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "new", label: "New", icon: Clock },
  { id: "most_viewed", label: "Most Viewed", icon: Eye },
  { id: "most_liked", label: "Most Liked", icon: Heart },
];

export default function MarketplacePage({ apps, onOpenApp, onLikeApp, onCloneApp }: Props) {
  const [activeCategory, setActiveCategory] = useState("featured");
  const [searchQuery, setSearchQuery] = useState("");
  const [likedApps, setLikedApps] = useState<Set<string>>(new Set());

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    switch (activeCategory) {
      case "featured": return true;
      case "trending": return app.view_count > 50;
      case "new": return true;
      case "most_viewed": return true;
      case "most_liked": return true;
      default: return true;
    }
  });

  const sortedApps = [...filteredApps].sort((a, b) => {
    switch (activeCategory) {
      case "trending": return b.view_count - a.view_count;
      case "most_viewed": return b.view_count - a.view_count;
      case "most_liked": return b.like_count - a.like_count;
      case "new": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default: return b.like_count - a.like_count;
    }
  });

  const handleLike = (appId: string) => {
    const newLiked = new Set(likedApps);
    if (newLiked.has(appId)) {
      newLiked.delete(appId);
    } else {
      newLiked.add(appId);
      onLikeApp(appId);
    }
    setLikedApps(newLiked);
  };

  return (
    <div className="flex-1 overflow-auto bg-[#080810]">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/80 via-[#0a0a12] to-purple-950/60 border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoOTksMTAyLDI0MSwwLjA4KSIvPjwvc3ZnPg==')] opacity-40" />
        <div className="max-w-7xl mx-auto px-6 py-12 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold tracking-wider uppercase mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              AI App Marketplace
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
              Discover & Launch Amazing
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> AI-Built Apps</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Explore apps built by the community. Clone, customize, and launch your own versions in seconds.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search & Categories */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps by name or description..."
              className="w-full bg-[#0F0F12] border border-slate-800 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
            />
            <LayoutGrid className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                    : "bg-[#0F0F12] text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* App Grid */}
        {sortedApps.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm">No apps found. Be the first to publish one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedApps.map((app, idx) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-[#0F0F12] border border-slate-800/80 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-900/10"
              >
                {/* Thumbnail */}
                <div className="relative h-40 bg-gradient-to-br from-slate-800/50 to-slate-900/50 overflow-hidden">
                  {app.preview_html ? (
                    <iframe
                      srcDoc={app.preview_html}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts"
                      title={app.name}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Zap className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-bold text-slate-300 border border-white/10">
                      {app.category || "General"}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-white mb-1 truncate">{app.name}</h3>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{app.description}</p>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {app.creator || "Anonymous"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3 text-xs">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Eye className="h-3 w-3" />
                      {app.view_count}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Heart className="h-3 w-3" />
                      {app.like_count}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenApp(app)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <ArrowRight className="h-3 w-3" />
                      Open App
                    </button>
                    <button
                      onClick={() => handleLike(app.id)}
                      className={`p-2 rounded-lg border transition-all ${
                        likedApps.has(app.id)
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-[#0a0a12] border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/30"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${likedApps.has(app.id) ? "fill-red-400" : ""}`} />
                    </button>
                    <button
                      onClick={() => onCloneApp(app)}
                      className="p-2 rounded-lg bg-[#0a0a12] border border-slate-700 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                      title="Clone to workspace"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
