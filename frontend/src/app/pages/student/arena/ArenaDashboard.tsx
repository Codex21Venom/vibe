import { useEffect, useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { apiClient } from "@/lib/api-client";
import { MonitorPlay, Users } from "lucide-react";
import { useHpStudentCohorts } from "@/hooks/hooks";
import "./arena.css";
import ArenaBattle from "./ArenaBattle";
import ArenaBaitView from "./ArenaBaitView";

type ArenaMode = 'pvc' | 'pvp' | null;
type ArenaPhase = 'mode_selection' | 'course_selection' | 'baiting' | 'battle';

export default function ArenaDashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  
  const [mode, setMode] = useState<ArenaMode>(null);
  const [phase, setPhase] = useState<ArenaPhase>('mode_selection');
  const [baitedHp, setBaitedHp] = useState<number>(0);

  const { totalHp: hookTotalHp, isLoading: hpLoading } = useHpStudentCohorts();
  const globalTotalHp = hookTotalHp ?? 0;

  useEffect(() => {
    // Fetch courses enrolled by the student
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get<any[]>('/arena/courses');
        setCourses(response.data);
      } catch (err) {
        console.error("Failed to load arena courses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const handleModeSelect = (selectedMode: ArenaMode) => {
    setMode(selectedMode);
    setPhase('course_selection');
  };

  const handleEnterBattle = () => {
    if (mode === 'pvc') {
      setPhase('baiting');
    } else {
      // PvP not fully implemented yet, just acknowledge
      alert("PvP mode battle logic is under construction.");
    }
  };

  const handleStartGame = (finalBait: number) => {
    setBaitedHp(finalBait);
    setPhase('battle');
  };

  if (phase === 'battle' && selectedCourse) {
    return <ArenaBattle courseId={selectedCourse} baitedHp={baitedHp} onExit={() => setPhase('mode_selection')} />;
  }

  if (phase === 'baiting' && selectedCourse) {
    const selectedCourseData = courses.find(c => c.courseId === selectedCourse);
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
                <div className="mode-icon">
                  <MonitorPlay size={48} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Player vs Computer</h3>
                <p className="text-slate-300">Test your knowledge against an AI opponent.</p>
              </div>

              {/* Player vs Live Player Card */}
              <div className="arena-mode-card mode-pvp" onClick={() => handleModeSelect('pvp')}>
                <div className="mode-icon">
                  <Users size={48} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Player vs Live Player</h3>
                <p className="text-slate-300">Challenge other students in real-time combat.</p>
              </div>
            </div>

            {/* Realtime HP Bar */}
            <div className="global-hp-container mt-12 animate-in fade-in duration-700 delay-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                  <span className="text-2xl">⚡</span> Global HP
                </span>
                <span className="text-xl font-bold text-white">
                  {hpLoading ? "..." : globalTotalHp} HP
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
                  <p className="text-slate-400">You are not enrolled in any active courses.</p>
                ) : (
                  <div className="arena-course-grid">
                    {courses.map((course) => (
                      <div 
                        key={course.courseId} 
                        className={`arena-course-card ${selectedCourse === course.courseId ? 'selected' : ''}`}
                        onClick={() => setSelectedCourse(course.courseId)}
                      >
                        <div className="course-card-content">
                          <h3 className="text-xl font-bold text-white mb-2">{course.courseName}</h3>
                          <p className="text-sm text-slate-300">Status: {course.status}</p>
                        </div>
                        <div className="course-card-glow"></div>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedCourse && (
                  <div className="arena-actions mt-8 flex-col items-center">
                    {globalTotalHp < 50 ? (
                      <div className="text-red-400 mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-center">
                        You need at least 50 HP to enter the Arena. Complete more activities to earn HP!
                      </div>
                    ) : null}
                    <div className="flex gap-4 justify-center w-full">
                      <button 
                        onClick={handleEnterBattle} 
                        className="arena-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={globalTotalHp < 50 && mode === 'pvc'}
                      >
                        <span>{mode === 'pvc' ? 'Enter Battle' : 'Find Opponent'}</span>
                      </button>
                      <button className="arena-btn-secondary">
                        Edit Deck
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
