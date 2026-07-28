import { useEffect, useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { apiClient } from "@/lib/api-client";
import { MonitorPlay, Users } from "lucide-react";
import "./arena.css";
import ArenaBattle from "./ArenaBattle";
import ArenaBaitView from "./ArenaBaitView";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments } from "@/hooks/hooks";

type ArenaMode = 'pvc' | 'pvp' | null;
type ArenaPhase = 'mode_selection' | 'course_selection' | 'baiting' | 'battle';

export default function ArenaDashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  
  const [mode, setMode] = useState<ArenaMode>(null);
  const [phase, setPhase] = useState<ArenaPhase>('mode_selection');
  const [baitedHp, setBaitedHp] = useState<number>(0);
  const [showPvpOpponents, setShowPvpOpponents] = useState(false);

  const { token } = useAuthStore();
  const { data: enrollmentsData } = useUserEnrollments(1, 100, !!token);
  const enrollments = enrollmentsData?.enrollments || [];

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get<any[]>('/arena/courses');
        const validCourses = response.data.filter(c => c.courseName && c.courseName !== "Unknown Course" && c.courseName.trim() !== "");
        
        // Strictly use real-time progress from enrollments without fallback
        const coursesWithProgress = validCourses.map(course => {
          const enrollment = enrollments.find((e: any) => e.courseId === course.courseId || e.course?.id === course.courseId);
          return {
            ...course,
            percentCompleted: enrollment?.percentCompleted ?? course.progressPercent ?? 0
          };
        });
        
        setCourses(coursesWithProgress);
        
        const baseHp = validCourses.length * 100;
        localStorage.setItem('arena_base_hp', baseHp.toString());
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error("Failed to load arena courses", err);
      } finally {
        setLoading(false);
      }
    };
    if (enrollmentsData) {
      fetchCourses();
    }
  }, [enrollmentsData]);

  const handleModeSelect = (selectedMode: ArenaMode) => {
    setMode(selectedMode);
    setPhase('course_selection');
    setShowPvpOpponents(false);
  };

  const handleEnterBattle = () => {
    if (mode === 'pvc') {
      setPhase('baiting');
    } else {
      setShowPvpOpponents(true);
    }
  };

  const handleStartGame = (finalBait: number) => {
    setBaitedHp(finalBait);
    setPhase('battle');
  };

  const globalTotalHp = (courses.length * 100) + Number(localStorage.getItem('arena_hp_delta') || 0);
  const pvcPoints = Number(localStorage.getItem('arena_pvc_highest') || 0);
  const pvpPoints = Number(localStorage.getItem('arena_pvp_highest') || 0);

  if (phase === 'battle' && selectedCourse) {
    return <ArenaBattle courseId={selectedCourse} baitedHp={baitedHp} onExit={() => setPhase('mode_selection')} />;
  }

  if (phase === 'baiting' && selectedCourse) {
    const selectedCourseData = courses.find(c => (c.courseId || c.cohortId) === selectedCourse);
    return (
      <ArenaBaitView 
        courseId={selectedCourse} 
        courseName={selectedCourseData?.courseName || "Unknown Course"}
        maxHp={globalTotalHp}
        onStartGame={handleStartGame}
        onBack={() => setPhase('course_selection')}
      />
    );
  }

  return (
    <div className="arena-container">
      <div className="arena-header">
        <h1 className="text-4xl font-bold mb-2">
          <AuroraText>Knowledge Clash Arena</AuroraText>
        </h1>
        <p className="text-slate-400">Put your knowledge to the test and earn Mastery.</p>
      </div>

      <div className="arena-content">
        {phase === 'mode_selection' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold mb-6 text-white text-center">Select Game Mode</h2>
            
            <div className="arena-mode-grid">
              {/* Player vs Computer Card */}
              <div className="arena-mode-card mode-pvc" onClick={() => handleModeSelect('pvc')}>
                <div className="card-content">
                  <div className="mode-icon">
                    <MonitorPlay size={48} />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-3 tracking-wide">Player vs AI</h3>
                  <p className="text-slate-300 font-medium px-4">Test your knowledge against an advanced AI opponent.</p>
                </div>
                <div className="mt-8 pt-6 border-t border-purple-500/30 w-full relative z-10">
                  <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">Highest Score</p>
                  <p className="text-4xl font-mono font-black text-white drop-shadow-md">{pvcPoints}</p>
                </div>
              </div>

              {/* Player vs Live Player Card */}
              <div className="arena-mode-card mode-pvp" onClick={() => handleModeSelect('pvp')}>
                <div className="card-content">
                  <div className="mode-icon">
                    <Users size={48} />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-3 tracking-wide">PvP Combat</h3>
                  <p className="text-slate-300 font-medium px-4">Challenge other students in real-time knowledge combat.</p>
                </div>
                <div className="mt-8 pt-6 border-t border-pink-500/30 w-full relative z-10">
                  <p className="text-xs text-pink-400 font-bold uppercase tracking-widest mb-1">Highest Score</p>
                  <p className="text-4xl font-mono font-black text-white drop-shadow-md">{pvpPoints}</p>
                </div>
              </div>
            </div>

            {/* Realtime HP Bar */}
            <div className="global-hp-container mt-12 animate-in fade-in duration-700 delay-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                  <span className="text-2xl">⚡</span> Global HP
                </span>
                <span className="text-xl font-bold text-white">
                  {loading ? "..." : globalTotalHp} HP
                </span>
              </div>
              <div className="hp-bar-wrapper">
                <div 
                  className="hp-bar-fill" 
                  style={{ width: `${Math.min(100, Math.max(5, (globalTotalHp / (globalTotalHp + 100)) * 100))}%` }}
                ></div>
              </div>
              <p className="text-sm text-slate-400 mt-3 text-center">
                This is your synced HP across all courses. Use it wisely in the Arena!
              </p>
            </div>
          </div>
        )}

        {phase === 'course_selection' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-white">
                Select Active Enrolled Course 
                <span className="text-sm ml-2 text-slate-400">({mode === 'pvc' ? 'vs Computer' : 'vs Player'})</span>
              </h2>
              <button onClick={() => setPhase('mode_selection')} className="text-purple-400 hover:text-purple-300">
                &larr; Change Mode
              </button>
            </div>

            {loading ? (
              <div className="arena-loader">Loading Courses...</div>
            ) : (
              <div className="arena-course-selection">
                {courses.length === 0 ? (
                  <div className="text-center p-12 bg-slate-900/50 rounded-xl border border-slate-800 col-span-full">
                    <p className="text-slate-400 text-lg">No active course enrolled to play.</p>
                  </div>
                ) : (
                  <div className="arena-course-grid">
                    {courses.map((course: any) => (
                      <div 
                        key={course.courseId || course.cohortId}
                        className={`arena-course-card ${selectedCourse === (course.courseId || course.cohortId) ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedCourse(course.courseId || course.cohortId);
                          setShowPvpOpponents(false);
                        }}
                      >
                        <div className="course-card-glow"></div>
                        <div className="course-card-content">
                          <h4 className="text-xl font-bold text-white mb-2">{course.courseName}</h4>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-md uppercase tracking-wider">
                              Status: ACTIVE
                            </span>
                            <span className={`inline-block px-2 py-1 ${(course.percentCompleted ?? 0) >= 30 ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-400'} text-xs font-bold rounded-md`}>
                              Progress: {course.percentCompleted ?? 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedCourse && (() => {
                  const selectedCourseData = courses.find(c => (c.courseId || c.cohortId) === selectedCourse);
                  const currentProgress = selectedCourseData?.percentCompleted ?? 0;
                  const isProgressInsufficient = currentProgress < 30;
                  const isHpInsufficient = globalTotalHp < 50;

                  return (
                    <>
                      <div className="arena-actions mt-8 flex flex-col items-center">
                        {isProgressInsufficient && (
                          <div className="text-amber-400 mb-3 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-center font-medium">
                            ⚠️ You must complete at least 30% of this course to play in the Arena. (Current Progress: {currentProgress}%)
                          </div>
                        )}
                        {isHpInsufficient && (
                          <div className="text-red-400 mb-3 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-center font-medium">
                            ⚡ You need at least 50 HP to enter the Arena. Complete more activities to earn HP!
                          </div>
                        )}
                        <div className="flex justify-center w-full mt-4">
                          <button 
                            onClick={handleEnterBattle} 
                            className="arena-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-xl py-4 px-12"
                            disabled={isProgressInsufficient || (isHpInsufficient && mode === 'pvc')}
                          >
                            <span>{mode === 'pvc' ? 'Enter Battle' : 'Find Opponent'}</span>
                          </button>
                        </div>
                      </div>

                      {/* PvP Opponents List Mockup */}
                      {mode === 'pvp' && showPvpOpponents && (
                        <div className="mt-12 w-full max-w-3xl bg-slate-900/80 rounded-2xl border border-pink-500/30 p-8 shadow-[0_0_40px_rgba(254,143,181,0.15)] animate-in fade-in slide-in-from-top-4 duration-500">
                          <h3 className="text-2xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                            <Users className="text-pink-400 w-8 h-8" />
                            Live Opponents Found
                          </h3>
                          <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center p-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
                              <div className="w-10 h-10 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin mb-4"></div>
                              <p className="text-slate-400 font-medium">Scanning for live opponents in this course...</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
