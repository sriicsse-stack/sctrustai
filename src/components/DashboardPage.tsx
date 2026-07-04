import React from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid, Globe, Coins, Rocket, Eye, Heart, Users,
  GraduationCap, Folder, TrendingUp, Award, ArrowRight
} from "lucide-react";

interface Props {
  user: any;
  userState: any;
  projects: any[];
  marketplaceApps: any[];
  stats: {
    totalViews: number;
    totalLikes: number;
    totalReferrals: number;
    referralEarnings: number;
  };
  onNavigate: (tab: string) => void;
}

const StatCard = ({ icon: Icon, label, value, color, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-[#0F0F12] border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/30 transition-all"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="text-2xl font-extrabold text-white mb-1">{value}</div>
    <div className="text-xs text-slate-500 font-medium">{label}</div>
  </motion.div>
);

export default function DashboardPage({ user, userState, projects, marketplaceApps, stats, onNavigate }: Props) {
  const displayName = user?.name || user?.email?.split("@")[0] || "Developer";
  const avatar = user?.picture;

  return (
    <div className="flex-1 overflow-auto bg-[#080810]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-950/50 via-[#0F0F12] to-purple-950/40 border border-slate-800/80 rounded-2xl p-6 mb-8 flex items-center gap-5"
        >
          <div className="relative">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-16 h-16 rounded-full border-2 border-indigo-500/30" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border-2 border-indigo-500/30 flex items-center justify-center">
                <span className="text-xl font-bold text-indigo-400">{displayName[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0F0F12]" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <p className="text-xs text-slate-400">{user?.email}</p>
            <div className="flex gap-2 mt-2">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                {userState.plan} Plan
              </span>
              {userState.student_discount_active && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  Verified Student
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-white">{userState.credits}</div>
            <div className="text-xs text-slate-500">Credits Available</div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Folder} label="Projects" value={projects.length} color="bg-blue-500/10 text-blue-400" delay={0} />
          <StatCard icon={Globe} label="Published Apps" value={marketplaceApps.length} color="bg-emerald-500/10 text-emerald-400" delay={0.05} />
          <StatCard icon={Eye} label="Total Views" value={stats.totalViews} color="bg-purple-500/10 text-purple-400" delay={0.1} />
          <StatCard icon={Heart} label="Total Likes" value={stats.totalLikes} color="bg-red-500/10 text-red-400" delay={0.15} />
          <StatCard icon={Rocket} label="Deployments" value={userState.deploymentsCount || 0} color="bg-amber-500/10 text-amber-400" delay={0.2} />
          <StatCard icon={Users} label="Referrals" value={stats.totalReferrals} color="bg-cyan-500/10 text-cyan-400" delay={0.25} />
          <StatCard icon={Coins} label="Referral Earnings" value={`+${stats.referralEarnings}`} color="bg-yellow-500/10 text-yellow-400" delay={0.3} />
          <StatCard icon={TrendingUp} label="App Creations" value={userState.appCreationsCount || 0} color="bg-pink-500/10 text-pink-400" delay={0.35} />
        </div>

        {/* Recent Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0F0F12] border border-slate-800/80 rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Folder className="h-4 w-4 text-indigo-400" />
              Recent Projects
            </h2>
            <button
              onClick={() => onNavigate("workspace")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No projects yet. Start building in the workspace!</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((project: any) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-[#0a0a12] border border-slate-800/50 hover:border-slate-700 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-600/10 flex items-center justify-center">
                    <LayoutGrid className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{project.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {project.is_published && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Globe className="h-3 w-3" />
                        Live
                      </span>
                    )}
                    <span>{new Date(project.created_at || project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <button
            onClick={() => onNavigate("workspace")}
            className="bg-[#0F0F12] border border-slate-800/80 rounded-2xl p-5 text-left hover:border-indigo-500/30 transition-all group"
          >
            <Rocket className="h-6 w-6 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-white mb-1">Build New App</h3>
            <p className="text-xs text-slate-500">Generate a new app with AI from a prompt</p>
          </button>
          <button
            onClick={() => onNavigate("marketplace")}
            className="bg-[#0F0F12] border border-slate-800/80 rounded-2xl p-5 text-left hover:border-emerald-500/30 transition-all group"
          >
            <Globe className="h-6 w-6 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-white mb-1">Explore Marketplace</h3>
            <p className="text-xs text-slate-500">Discover apps built by the community</p>
          </button>
          <button
            onClick={() => onNavigate("referral")}
            className="bg-[#0F0F12] border border-slate-800/80 rounded-2xl p-5 text-left hover:border-amber-500/30 transition-all group"
          >
            <Award className="h-6 w-6 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-white mb-1">Invite & Earn</h3>
            <p className="text-xs text-slate-500">Share your referral link to earn credits</p>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
